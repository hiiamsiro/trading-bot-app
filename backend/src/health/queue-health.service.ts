import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const QUEUE_NAMES = ['bot-execution', 'market-data', 'instrument-sync'] as const;

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface WorkerMetrics {
  workerId: string;
  queueName: string;
  status: 'active' | 'idle' | 'stopped';
}

export interface QueueHealthReport {
  queues: QueueMetrics[];
  workers: WorkerMetrics[];
  totalJobsWaiting: number;
  totalJobsActive: number;
  totalJobsFailed: number;
  isHealthy: boolean;
}

const FAILED_THRESHOLD = 50;

/** Worker ID → last-seen timestamp. Pruned on every getReport() call. */
const observedWorkers = new Map<string, number>();

@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);

  constructor(
    @InjectQueue('bot-execution') private readonly botExecutionQueue: Queue,
    @InjectQueue('market-data') private readonly marketDataQueue: Queue,
    @InjectQueue('instrument-sync') private readonly instrumentSyncQueue: Queue,
  ) {}

  private queueByName(name: (typeof QUEUE_NAMES)[number]): Queue {
    switch (name) {
      case 'bot-execution':
        return this.botExecutionQueue;
      case 'market-data':
        return this.marketDataQueue;
      case 'instrument-sync':
        return this.instrumentSyncQueue;
    }
  }

  async getReport(): Promise<QueueHealthReport> {
    await this.refreshWorkerActivity();

    // Prune stale entries so the Map never grows beyond observed cardinality.
    const staleCutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, ts] of observedWorkers) {
      if (ts < staleCutoff) observedWorkers.delete(key);
    }

    const queueResults = await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        try {
          const queue = this.queueByName(name);
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          const isPaused = await queue.isPaused();
          return {
            queueName: name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
            paused: isPaused,
          } satisfies QueueMetrics;
        } catch (err) {
          this.logger.error(
            `Failed to read queue=${name}: ${err instanceof Error ? err.message : String(err)}`,
          );
          // Return a degraded entry so the overall report still resolves.
          return {
            queueName: name,
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: false,
          } satisfies QueueMetrics;
        }
      }),
    );

    const now = Date.now();
    const workers: WorkerMetrics[] = [];
    for (const [key, lastSeen] of observedWorkers) {
      const sepIdx = key.indexOf('|');
      if (sepIdx === -1) continue;
      const workerId = key.slice(0, sepIdx);
      const queueName = key.slice(sepIdx + 1);
      const isRecent = now - lastSeen < 30_000;
      workers.push({ workerId, queueName, status: isRecent ? 'active' : 'idle' });
    }

    const totalWaiting = queueResults.reduce((s, q) => s + q.waiting, 0);
    const totalActive = queueResults.reduce((s, q) => s + q.active, 0);
    const totalFailed = queueResults.reduce((s, q) => s + q.failed, 0);
    const isHealthy = queueResults.every((q) => !q.paused) && totalFailed < FAILED_THRESHOLD;

    return {
      queues: queueResults,
      workers,
      totalJobsWaiting: totalWaiting,
      totalJobsActive: totalActive,
      totalJobsFailed: totalFailed,
      isHealthy,
    };
  }

  /**
   * Reads worker activity by querying BullMQ's internal `bullmq:${name}:workers` hash.
   *
   * The queue is already connected by the time this method is called (injected singleton),
   * so no `waitUntilReady()` call is needed — we read directly from the shared Redis client.
   *
   * NOTE: `bullmq:*:workers` is an internal BullMQ key. If the hash grows large
   * (> 50 replicas), switch from `HGETALL` to `HSCAN` cursor iteration.
   */
  private async refreshWorkerActivity(): Promise<void> {
    await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        const queue = this.queueByName(name);
        try {
          const redis = await queue.client;
          const workers = await redis.hgetall(`bullmq:${name}:workers`);
          for (const workerId of Object.keys(workers ?? {})) {
            observedWorkers.set(`${workerId}|${name}`, Date.now());
          }
        } catch (err) {
          // Log at error level: Redis failures are infrastructure outages, not warnings.
          this.logger.error(
            `Failed to read worker activity for queue=${name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }
}
