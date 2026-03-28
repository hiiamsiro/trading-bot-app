// Shared types for the visual strategy builder.
// Kept in a separate file to avoid circular imports between
// the strategy-builder service and the bots/create-bot-from-builder dto.

export type LogicalOperator = 'AND' | 'OR';

export type ComparisonOperator =
  | 'CROSSES_ABOVE'
  | 'CROSSES_BELOW'
  | 'ABOVE'
  | 'BELOW';

export type IndicatorType = 'RSI' | 'MA';

export interface IndicatorParams {
  period?: number;
  oversold?: number;
  overbought?: number;
  shortPeriod?: number;
  longPeriod?: number;
}

export interface Condition {
  id: string;
  indicator: IndicatorType;
  params: IndicatorParams;
  comparison: ComparisonOperator;
  value: number;
}

export interface BuilderEntryCondition {
  type: 'CONDITION';
  condition: Condition;
}

export interface BuilderGroupCondition {
  type: 'GROUP';
  operator: LogicalOperator;
  conditions: (BuilderEntryCondition | BuilderGroupCondition)[];
}

export type BuilderCondition = BuilderEntryCondition | BuilderGroupCondition;

export interface BuilderConfig {
  version: 1;
  conditions: BuilderCondition[];
  entryOperator: LogicalOperator;
  risk: {
    stopLossPercent?: number;
    takeProfitPercent?: number;
    maxDailyLoss?: number;
    quantity: number;
  };
}

export interface CompiledResult {
  strategy: 'rsi' | 'sma_crossover';
  params: Record<string, unknown>;
}

// ─── Type guards (must live here so TypeScript can narrow types) ──────────────

export function isGroupCondition(c: BuilderCondition): c is BuilderGroupCondition {
  return c.type === 'GROUP';
}

export function isEntryCondition(c: BuilderCondition): c is BuilderEntryCondition {
  return c.type === 'CONDITION';
}
