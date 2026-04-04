export class StrategyCode {
  id: string;
  userId: string;
  name: string;
  description?: string;
  code: string;
  language: string;
  isValid: boolean;
  lastValidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sandbox types ──────────────────────────────────────────────────────────────

export type SandboxSignal = 'BUY' | 'SELL' | 'HOLD';

export type SandboxResult =
  | { action: SandboxSignal; confidence: number; reason: string }
  | null;

export type SandboxContext = {
  symbol: string;
  interval: string;
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
  position: 'long' | 'short' | null;
  balance: number;
  entryPrice: number | null;
};
