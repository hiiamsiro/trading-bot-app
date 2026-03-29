import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LOG_RETENTION_INFO_DEBUG_DAYS,
  LOG_RETENTION_WARNING_ERROR_DAYS,
  TRADE_RETENTION_DAYS,
  NOTIFICATION_RETENTION_DAYS,
  BACKTEST_RETENTION_DAYS,
  EXECUTION_SESSION_RETENTION_DAYS,
  RETENTION_BATCH_SIZE,
} from './data-retention.constants';

/** Helper: subtract `days` from `date`. Avoids adding date-fns as a dep. */
function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

const now = () => new Date();

interface RetentionResult {
  table: string;
  phase: 'soft-delete' | 'hard-delete';
  deleted: number;
}

/**
 * DataRetentionService
 *
 * Implements configurable retention policies across all high-volume and archival tables.
 *
 * bot_logs uses a two-phase approach:
 *   1. soft-delete  — set deletedAt on records past retention
 *   2. hard-delete — permanently remove records soft-deleted > 1 day ago
 *
 * The 24-hour gap between phases means:
 *   a) an accidental double-run within 24 h is recoverable
 *   b) an operator has a full day to pull logs before they're gone
 *
 * Invariants — these MUST hold regardless of env configuration:
 *   - Open positions (closedAt = NULL) are NEVER deleted.
 *   - Unread notifications (isRead = false) are NEVER deleted.
 *   - Running/Pending backtests are NEVER deleted.
 *   - Bots with status RUNNING are excluded from log archival.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runRetention(): Promise<RetentionResult[]> {
    const results: RetentionResult[] = [];

    const softDeleted = await this.softDeleteOldBotLogs();
    results.push({ table: 'bot_logs', phase: 'soft-delete', deleted: softDeleted });

    const hardDeletedLogs = await this.hardDeleteSoftDeletedBotLogs();
    results.push({ table: 'bot_logs', phase: 'hard-delete', deleted: hardDeletedLogs });

    const closedTrades = await this.deleteClosedTrades();
    results.push({ table: 'trades', phase: 'hard-delete', deleted: closedTrades });

    const notifications = await this.deleteOldNotifications();
    results.push({ table: 'notifications', phase: 'hard-delete', deleted: notifications });

    const backtests = await this.deleteOldBacktests();
    results.push({ table: 'backtests', phase: 'hard-delete', deleted: backtests });

    const sessions = await this.deleteOldExecutionSessions();
    results.push({ table: 'execution_sessions', phase: 'hard-delete', deleted: sessions });

    return results;
  }

  // -------------------------------------------------------------------------
  // bot_logs — soft-delete phase
  //
  // Bot IDs are fetched first (plain indexed read) so the UPDATE can use
  // botId IN [...] instead of an implicit JOIN.  This avoids holding row locks
  // on the bots table.
  //
  // deletedAt IS NOT filtered in the WHERE because a partial covering index
  // (WHERE deletedAt IS NULL) handles that — see the migration.  Keeping
  // deletedAt = null in the WHERE would block that index.
  // -------------------------------------------------------------------------

  private async softDeleteOldBotLogs(): Promise<number> {
    const inactiveBotIds = (
      await this.prisma.bot.findMany({
        where: { status: { not: 'RUNNING' } },
        select: { id: true },
      })
    ).map((b) => b.id);

    if (inactiveBotIds.length === 0) {
      this.logger.debug('No inactive bots — skipping bot_log soft-delete');
      return 0;
    }

    let totalDeleted = 0;

    // Chunk inactive bots so each updateMany stays within PostgreSQL's parameter limit
    // and avoids a seq-scan on the derived ID list.  Chunks are processed sequentially
    // (not in parallel) to avoid lock contention with other writers.
    const infoDebugCutoff = subtractDays(now(), LOG_RETENTION_INFO_DEBUG_DAYS);
    for (let i = 0; i < inactiveBotIds.length; i += RETENTION_BATCH_SIZE) {
      const chunk = inactiveBotIds.slice(i, i + RETENTION_BATCH_SIZE);
      const result = await this.prisma.botLog.updateMany({
        where: {
          level: { in: ['INFO', 'DEBUG'] },
          createdAt: { lt: infoDebugCutoff },
          botId: { in: chunk },
        },
        data: { deletedAt: new Date() },
      });
      totalDeleted += result.count;
    }
    this.logger.debug(`Soft-deleted INFO/DEBUG bot_log rows across ${Math.ceil(inactiveBotIds.length / RETENTION_BATCH_SIZE)} chunk(s)`);

    const warnErrorCutoff = subtractDays(now(), LOG_RETENTION_WARNING_ERROR_DAYS);
    for (let i = 0; i < inactiveBotIds.length; i += RETENTION_BATCH_SIZE) {
      const chunk = inactiveBotIds.slice(i, i + RETENTION_BATCH_SIZE);
      const result = await this.prisma.botLog.updateMany({
        where: {
          level: { in: ['WARNING', 'ERROR'] },
          createdAt: { lt: warnErrorCutoff },
          botId: { in: chunk },
        },
        data: { deletedAt: new Date() },
      });
      totalDeleted += result.count;
    }
    this.logger.debug(`Soft-deleted WARNING/ERROR bot_log rows across ${Math.ceil(inactiveBotIds.length / RETENTION_BATCH_SIZE)} chunk(s)`);

    return totalDeleted;
  }

  // -------------------------------------------------------------------------
  // bot_logs — hard-delete phase
  //
  // Cursor = createdAt.  We advance lastCreatedAt BEFORE deleteMany so that
  // a crash between cursor-advance and delete-commit causes rows to be
  // re-scanned on retry rather than silently skipped.
  // -------------------------------------------------------------------------

  private async hardDeleteSoftDeletedBotLogs(): Promise<number> {
    // Cutoff is relative to method-entry time, not re-evaluated per batch.  This means
    // the window is "1 day before this run started" — records soft-deleted during this
    // same run are safely outside the window and will be cleaned up on tomorrow's run.
    const hardDeleteCutoff = subtractDays(now(), 1);
    let totalDeleted = 0;
    let lastCreatedAt: Date | undefined;

    while (true) {
      const rows = await this.prisma.botLog.findMany({
        where: {
          // deletedAt < 1-day-ago is both the safety window and the pure range seek.
          // Using lt (not {not:null, lt}) keeps this on the deletedAt B-tree index.
          deletedAt: { lt: hardDeleteCutoff },
          ...(lastCreatedAt ? { createdAt: { gt: lastCreatedAt } } : {}),
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      lastCreatedAt = rows[rows.length - 1].createdAt;
      const result = await this.prisma.botLog.deleteMany({ where: { id: { in: ids } } });
      totalDeleted += result.count;
    }

    return totalDeleted;
  }

  // -------------------------------------------------------------------------
  // trades
  //
  // EXECUTED: trade filled on exchange — financially terminal, safe to delete.
  // CLOSED:   position fully exited — financially terminal, safe to delete.
  // CANCELLED / FAILED: no financial value, safe to delete.
  // PENDING:  live order — NEVER deleted.
  // -------------------------------------------------------------------------

  private async deleteClosedTrades(): Promise<number> {
    const cutoff = subtractDays(now(), TRADE_RETENTION_DAYS);
    let totalDeleted = 0;
    let lastCreatedAt: Date | undefined;

    while (true) {
      const rows = await this.prisma.trade.findMany({
        where: {
          closedAt: { not: null, lt: cutoff },
          status: { in: ['CLOSED', 'EXECUTED', 'CANCELLED', 'FAILED'] },
          ...(lastCreatedAt ? { createdAt: { gt: lastCreatedAt } } : {}),
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      lastCreatedAt = rows[rows.length - 1].createdAt;
      const result = await this.prisma.trade.deleteMany({ where: { id: { in: ids } } });
      totalDeleted += result.count;
    }

    return totalDeleted;
  }

  // -------------------------------------------------------------------------
  // notifications
  // -------------------------------------------------------------------------

  private async deleteOldNotifications(): Promise<number> {
    const cutoff = subtractDays(now(), NOTIFICATION_RETENTION_DAYS);
    let totalDeleted = 0;
    let lastCreatedAt: Date | undefined;

    while (true) {
      const rows = await this.prisma.notification.findMany({
        where: {
          isRead: true,
          createdAt: { lt: cutoff },
          ...(lastCreatedAt ? { createdAt: { gt: lastCreatedAt } } : {}),
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      lastCreatedAt = rows[rows.length - 1].createdAt;
      const result = await this.prisma.notification.deleteMany({ where: { id: { in: ids } } });
      totalDeleted += result.count;
    }

    return totalDeleted;
  }

  // -------------------------------------------------------------------------
  // backtests — batched to avoid holding locks on large result sets
  // -------------------------------------------------------------------------

  private async deleteOldBacktests(): Promise<number> {
    const cutoff = subtractDays(now(), BACKTEST_RETENTION_DAYS);
    let totalDeleted = 0;
    let lastId: string | undefined;

    while (true) {
      const rows = await this.prisma.backtest.findMany({
        where: {
          createdAt: { lt: cutoff },
          status: { in: ['COMPLETED', 'FAILED'] },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: RETENTION_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      lastId = ids[ids.length - 1];
      const result = await this.prisma.backtest.deleteMany({ where: { id: { in: ids } } });
      totalDeleted += result.count;
    }

    return totalDeleted;
  }

  // -------------------------------------------------------------------------
  // execution_sessions — ended sessions older than retention window.
  // Only one session exists per bot (botId is @unique).  Sessions with endedAt = NULL
  // are the active session for each bot and are always preserved.
  // -------------------------------------------------------------------------

  private async deleteOldExecutionSessions(): Promise<number> {
    const cutoff = subtractDays(now(), EXECUTION_SESSION_RETENTION_DAYS);
    let totalDeleted = 0;
    let lastId: string | undefined;

    while (true) {
      const rows = await this.prisma.executionSession.findMany({
        where: {
          endedAt: { not: null, lt: cutoff },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: RETENTION_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      lastId = ids[ids.length - 1];
      const result = await this.prisma.executionSession.deleteMany({ where: { id: { in: ids } } });
      totalDeleted += result.count;
    }

    return totalDeleted;
  }
}
