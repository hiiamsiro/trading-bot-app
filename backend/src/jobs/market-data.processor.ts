import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import {
  MARKET_DATA_CONCURRENCY,
  BOT_EXECUTION_MAX_RETRIES,
  BOT_EXECUTION_BACKOFF_BASE,
} from './worker.constants';

/**
 * Native semaphore: limits how many async operations run concurrently.
 *
 * Back-pressure policy: when the wait queue exceeds `maxConcurrency * 10`, new
 * calls are rejected rather than queued indefinitely.  This prevents unbounded
 * memory growth if Redis is slow and new work keeps arriving.
 */
function createThrottle(maxConcurrency: number, maxWaiting = maxConcurrency * 10) {
  let running = 0;
  const waiting: Array<() => void> = [];

  return <T>(fn: () => Promise<T>): Promise<T> => {
    if (waiting.length >= maxWaiting) {
      return Promise.reject(new Error(`Throttle capacity reached: ${maxWaiting} queued tasks`));
    }
    return new Promise<T>((resolve, reject) => {
      const exec = async () => {
        running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          running--;
          const next = waiting.shift();
          if (next) next();
        }
      };
      if (running < maxConcurrency) {
        exec();
      } else {
        waiting.push(() => exec());
      }
    });
  };
}

@Processor('market-data', { concurrency: MARKET_DATA_CONCURRENCY })
export class MarketDataProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketDataProcessor.name);

  /**
   * Fan-out cap: max tick jobs queued per market-data cycle.
   * Guard against negative or NaN env values — a bad env var must not silently
   * disable all processing.
   */
  private readonly BOT_TICK_MAX_PER_CYCLE = (() => {
    const raw = parseInt(process.env.BOT_TICK_MAX_PER_CYCLE ?? '100', 10);
    return Number.isNaN(raw) ? 100 : Math.max(1, raw);
  })();

  /** Throttles concurrent queue.add() calls to avoid a Redis write burst. */
  private readonly enqueue = createThrottle(20);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly gateway: MarketDataGateway,
    @InjectQueue('bot-execution') private readonly botExecutionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<Record<string, never>, void, string>): Promise<void> {
    void job;
    const subscriptions = this.gateway.getActiveMarketSubscriptions();
    for (const { symbol, interval } of subscriptions) {
      try {
        const snapshot = await this.marketData.getMarketSnapshot(symbol, interval);
        if (snapshot) this.gateway.emitMarketData(snapshot);
      } catch {
        // Skip individual subscription failures — continue processing remaining subscriptions
      }
    }

    const bots = await this.prisma.bot.findMany({
      where: { status: 'RUNNING' },
      select: { id: true },
      take: this.BOT_TICK_MAX_PER_CYCLE,
    });

    // Enqueue tick jobs through the throttle to avoid a Redis write burst.
    // The async/try inside the callback makes rejection-safety explicit rather
    // than relying on a swallowed Promise.
    await Promise.all(
      bots.map((b) =>
        this.enqueue(async () => {
          try {
            await this.botExecutionQueue.add(
              `tick-${b.id}`,
              { botId: b.id },
              {
                removeOnComplete: 1000,
                removeOnFail: 5000,
                attempts: BOT_EXECUTION_MAX_RETRIES,
                backoff: { type: 'exponential', delay: BOT_EXECUTION_BACKOFF_BASE },
              },
            );
          } catch (err) {
            this.logger.warn(
              `Failed to enqueue tick for bot=${b.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }).catch((err) => {
          // Throttle rejection — bot will be picked up on the next cycle.
          // Log at debug to avoid noise during normal load spikes.
          this.logger.debug?.(
            `Throttle capacity reached, skipping bot=${b.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }),
      ),
    );
  }
}

export { MARKET_DATA_CONCURRENCY, BOT_EXECUTION_MAX_RETRIES, BOT_EXECUTION_BACKOFF_BASE };
