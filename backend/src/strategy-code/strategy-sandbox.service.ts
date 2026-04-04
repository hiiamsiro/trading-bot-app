import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { WORKER_SCRIPT } from './worker-script';
import { SandboxResult, SandboxContext } from './strategy-code.entity';

export const EXECUTION_TIMEOUT_MS = 2000;

type WorkerMessage =
  | { ok: true; timedOut: boolean; result?: SandboxResult }
  | { ok: false; timedOut: boolean; error: string };

function createWorker(): Worker {
  return new Worker(WORKER_SCRIPT, {
    eval: true,
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
}

@Injectable()
export class StrategySandboxService implements OnModuleDestroy {
  /** Lazily initialized on first execute() call. */
  private worker: Worker | null = null;

  async onModuleDestroy() {
    await this.worker?.terminate();
    this.worker = null;
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = createWorker();
    }
    return this.worker;
  }

  async execute(code: string, context: SandboxContext): Promise<SandboxResult> {
    return new Promise<SandboxResult>((resolve) => {
      const worker = this.getWorker();
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.terminate().catch(() => {});
          // Restart so a crashed worker doesn't handle the next request.
          this.worker = createWorker();
          resolve(null);
        }
      }, EXECUTION_TIMEOUT_MS + 100);

      const handler = (msg: WorkerMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeListener('message', handler);
        if (msg.timedOut) {
          resolve(null);
        } else if (msg.ok) {
          resolve(msg.result ?? null);
        } else {
          throw new Error(`Sandbox execution failed: ${msg.error}`);
        }
      };

      worker.on('message', handler);

      worker.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeListener('message', handler);
        throw new Error(`Sandbox worker error: ${err.message}`);
      });

      worker.on('exit', (code: number) => {
        if (!settled && code !== 0) {
          settled = true;
          clearTimeout(timer);
          worker.removeListener('message', handler);
          this.worker = createWorker();
          resolve(null);
        }
      });

      worker.postMessage({ code, context, timeoutMs: EXECUTION_TIMEOUT_MS });
    });
  }
}
