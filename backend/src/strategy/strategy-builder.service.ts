import { Injectable } from '@nestjs/common';
import {
  type LogicalOperator,
  type ComparisonOperator,
  type IndicatorType,
  type Condition,
  type BuilderCondition,
  type BuilderConfig,
  type CompiledResult,
  isGroupCondition,
  isEntryCondition,
} from './strategy-builder.schema';

// Re-export so existing consumers (controllers, other services) don't break
export {
  type LogicalOperator,
  type ComparisonOperator,
  type IndicatorType,
  type Condition,
  type BuilderCondition,
  type BuilderConfig,
  type CompiledResult,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateIndicatorParams(cond: Condition, path: string): void {
  if (cond.indicator === 'RSI') {
    const period = cond.params.period;
    if (period == null || !Number.isInteger(period) || period < 2) {
      throw new Error(`${path}: RSI period must be an integer >= 2`);
    }
    if (cond.value < 0 || cond.value > 100) {
      throw new Error(`${path}: RSI threshold value must be between 0 and 100`);
    }
    if (cond.params.oversold != null && (cond.params.oversold < 0 || cond.params.oversold > 100)) {
      throw new Error(`${path}: RSI oversold must be between 0 and 100`);
    }
    if (
      cond.params.overbought != null &&
      (cond.params.overbought < 0 || cond.params.overbought > 100)
    ) {
      throw new Error(`${path}: RSI overbought must be between 0 and 100`);
    }
  } else if (cond.indicator === 'MA') {
    const short = cond.params.shortPeriod;
    const long = cond.params.longPeriod;
    if (cond.comparison === 'CROSSES_ABOVE' || cond.comparison === 'CROSSES_BELOW') {
      if (short == null || !Number.isInteger(short) || short < 1) {
        throw new Error(`${path}: MA short period must be an integer >= 1`);
      }
      if (long == null || !Number.isInteger(long) || long < 2) {
        throw new Error(`${path}: MA long period must be an integer >= 2`);
      }
      if (short >= long) {
        throw new Error(`${path}: MA short period must be smaller than long period`);
      }
    } else {
      // Absolute price comparison — no period needed
      if (cond.value <= 0) {
        throw new Error(`${path}: MA price threshold must be > 0`);
      }
    }
  }
}

function validateCondition(c: BuilderCondition, path: string, depth: number): void {
  if (depth > 3) {
    throw new Error(`${path}: Maximum nesting depth of 3 exceeded`);
  }
  if (isGroupCondition(c)) {
    if (!c.operator || !['AND', 'OR'].includes(c.operator)) {
      throw new Error(`${path}: Group operator must be AND or OR`);
    }
    if (!Array.isArray(c.conditions) || c.conditions.length < 2) {
      throw new Error(`${path}: Group must have at least 2 conditions`);
    }
    c.conditions.forEach((child, i) => validateCondition(child, `${path}[${i}]`, depth + 1));
  } else if (isEntryCondition(c)) {
    const cond = c.condition;
    if (!cond || typeof cond !== 'object') {
      throw new Error(`${path}: Condition must be an object`);
    }
    if (!cond.id) {
      throw new Error(`${path}: Condition must have an id`);
    }
    if (!['RSI', 'MA'].includes(cond.indicator)) {
      throw new Error(`${path}: Indicator must be RSI or MA`);
    }
    if (!['CROSSES_ABOVE', 'CROSSES_BELOW', 'ABOVE', 'BELOW'].includes(cond.comparison)) {
      throw new Error(
        `${path}: Comparison must be one of CROSSES_ABOVE, CROSSES_BELOW, ABOVE, BELOW`,
      );
    }
    if (typeof cond.value !== 'number' || !Number.isFinite(cond.value)) {
      throw new Error(`${path}: Condition value must be a finite number`);
    }
    validateIndicatorParams(cond, `${path}.condition`);
  } else {
    throw new Error(`${path}: Unknown condition type`);
  }
}

// ─── Compilation ───────────────────────────────────────────────────────────────

function flattenConditions(
  conditions: BuilderCondition[],
  topOperator: LogicalOperator,
): Condition[] {
  if (conditions.length === 0) return [];

  if (conditions.length === 1) {
    const c = conditions[0];
    if (isGroupCondition(c)) {
      return flattenConditions(c.conditions, c.operator);
    }
    return [c.condition];
  }

  // Multiple top-level conditions: combine with topOperator
  const all: Condition[] = [];
  for (const c of conditions) {
    if (isGroupCondition(c)) {
      const nested = flattenConditions(c.conditions, c.operator);
      all.push(...nested);
    } else {
      all.push(c.condition);
    }
  }
  return all;
}

function inferStrategy(conditions: Condition[]): 'rsi' | 'sma_crossover' {
  const hasRsi = conditions.some((c) => c.indicator === 'RSI');
  const hasMa = conditions.some(
    (c) =>
      c.indicator === 'MA' &&
      (c.comparison === 'CROSSES_ABOVE' || c.comparison === 'CROSSES_BELOW'),
  );

  if (hasRsi && !hasMa) return 'rsi';
  if (hasMa && !hasRsi) return 'sma_crossover';

  // Default to MA crossover if mixed or unknown
  if (hasMa) return 'sma_crossover';
  return 'rsi';
}

function compileRsi(conditions: Condition[], risk: BuilderConfig['risk']): Record<string, unknown> {
  const rsiConds = conditions.filter((c) => c.indicator === 'RSI');
  if (rsiConds.length === 0) {
    throw new Error('No RSI conditions found for RSI strategy');
  }

  // For BUY signal: look for RSI crossing above or below oversold threshold
  // For SELL signal: look for RSI crossing above or below overbought threshold
  // Infer from first condition
  const first = rsiConds[0];
  let oversold = 30;
  let overbought = 70;

  if (first.comparison === 'CROSSES_BELOW' || first.comparison === 'BELOW') {
    // Likely a BUY signal — value is oversold threshold
    oversold = first.value;
  } else {
    overbought = first.value;
  }

  // Use the first condition's period as reference
  const period = first.params.period ?? 14;

  const params: Record<string, unknown> = {
    period,
    oversold,
    overbought,
    quantity: risk.quantity,
  };
  if (risk.stopLossPercent != null) params.stopLossPercent = risk.stopLossPercent;
  if (risk.takeProfitPercent != null) params.takeProfitPercent = risk.takeProfitPercent;
  if (risk.maxDailyLoss != null) params.maxDailyLoss = risk.maxDailyLoss;

  return params;
}

function compileMaCrossover(
  conditions: Condition[],
  risk: BuilderConfig['risk'],
): Record<string, unknown> {
  const maConds = conditions.filter(
    (c) =>
      c.indicator === 'MA' &&
      (c.comparison === 'CROSSES_ABOVE' || c.comparison === 'CROSSES_BELOW'),
  );
  if (maConds.length === 0) {
    throw new Error('No MA crossover conditions found for MA Crossover strategy');
  }

  // Find the shortest and longest periods across conditions
  const shorts = maConds.map((c) => c.params.shortPeriod ?? 10).filter((n) => n > 0);
  const longs = maConds.map((c) => c.params.longPeriod ?? 20).filter((n) => n > 0);

  const shortPeriod = shorts.length > 0 ? Math.min(...shorts) : 10;
  const longPeriod = longs.length > 0 ? Math.max(...longs) : 20;

  const params: Record<string, unknown> = {
    shortPeriod,
    longPeriod,
    quantity: risk.quantity,
  };
  if (risk.stopLossPercent != null) params.stopLossPercent = risk.stopLossPercent;
  if (risk.takeProfitPercent != null) params.takeProfitPercent = risk.takeProfitPercent;
  if (risk.maxDailyLoss != null) params.maxDailyLoss = risk.maxDailyLoss;

  return params;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class StrategyBuilderService {
  /**
   * Validate a builder config — throws if the config is malformed.
   * Used by the API to check user input before saving.
   */
  validateConfig(config: unknown): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Builder config must be an object');
    }
    const cfg = config as Record<string, unknown>;

    if (cfg.version !== 1) {
      throw new Error('Builder config version must be 1');
    }
    if (!Array.isArray(cfg.conditions)) {
      throw new Error('Builder config must have a conditions array');
    }
    if (cfg.conditions.length === 0) {
      throw new Error('Builder config must have at least one condition');
    }
    if (!cfg.entryOperator || !['AND', 'OR'].includes(cfg.entryOperator as string)) {
      throw new Error('entryOperator must be AND or OR');
    }
    if (!cfg.risk || typeof cfg.risk !== 'object') {
      throw new Error('Builder config must have a risk object');
    }
    const risk = cfg.risk as Record<string, unknown>;
    const quantity = Number(risk.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('risk.quantity must be a number > 0');
    }
    if (risk.stopLossPercent != null) {
      const sl = Number(risk.stopLossPercent);
      if (!Number.isFinite(sl) || sl <= 0 || sl >= 100) {
        throw new Error('risk.stopLossPercent must be > 0 and < 100');
      }
    }
    if (risk.takeProfitPercent != null) {
      const tp = Number(risk.takeProfitPercent);
      if (!Number.isFinite(tp) || tp <= 0 || tp >= 100) {
        throw new Error('risk.takeProfitPercent must be > 0 and < 100');
      }
    }

    (cfg.conditions as BuilderCondition[]).forEach((c, i) =>
      validateCondition(c, `conditions[${i}]`, 0),
    );
  }

  /**
   * Compile a validated builder config into the existing strategy+params format
   * so it can be executed by DemoTradingService without any runtime changes.
   */
  compileConfig(config: BuilderConfig): CompiledResult {
    const flat = flattenConditions(config.conditions, config.entryOperator);
    const strategy = inferStrategy(flat);

    let params: Record<string, unknown>;
    if (strategy === 'rsi') {
      params = compileRsi(flat, config.risk);
    } else {
      params = compileMaCrossover(flat, config.risk);
    }

    return { strategy, params };
  }

  /**
   * Return a human-readable description of the compiled strategy.
   */
  describeConfig(config: BuilderConfig): string {
    try {
      const compiled = this.compileConfig(config);
      if (compiled.strategy === 'rsi') {
        const p = compiled.params;
        return (
          `RSI strategy (period ${p.period}, ` +
          `oversold ${p.oversold}, overbought ${p.overbought})`
        );
      }
      const p = compiled.params;
      return `SMA Crossover strategy (short ${p.shortPeriod}, long ${p.longPeriod})`;
    } catch {
      return 'Custom condition strategy';
    }
  }

  /**
   * Create a default empty builder config with one RSI BUY condition.
   * Used as the starting point for the visual builder.
   */
  createDefault(): BuilderConfig {
    return {
      version: 1,
      entryOperator: 'AND',
      conditions: [
        {
          type: 'CONDITION',
          condition: {
            id: uuid(),
            indicator: 'RSI',
            params: { period: 14 },
            comparison: 'CROSSES_BELOW',
            value: 30,
          },
        },
      ],
      risk: {
        quantity: 0.01,
      },
    };
  }
}
