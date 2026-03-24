import { Injectable } from '@nestjs/common';

export type StrategySignal = 'BUY' | 'SELL' | 'HOLD';

function sma(values: number[], period: number): number {
  if (values.length < period || period < 1) {
    return Number.NaN;
  }
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(closes: number[], period: number): number {
  if (closes.length < period + 1 || period < 1) {
    return Number.NaN;
  }
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) {
    return 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

@Injectable()
export class StrategyService {
  evaluate(
    strategyKey: string,
    params: Record<string, unknown>,
    closes: number[],
  ): StrategySignal {
    const key = strategyKey.toLowerCase().replace(/-/g, '_');
    if (key === 'ma_crossover' || key === 'sma_crossover') {
      return this.maCrossover(params, closes);
    }
    if (key === 'rsi') {
      return this.rsiStrategy(params, closes);
    }
    return 'HOLD';
  }

  private maCrossover(
    params: Record<string, unknown>,
    closes: number[],
  ): StrategySignal {
    const shortPeriod = Number(params.shortPeriod) || 10;
    const longPeriod = Number(params.longPeriod) || 20;
    if (shortPeriod >= longPeriod) {
      return 'HOLD';
    }
    const min = longPeriod + 2;
    if (closes.length < min) {
      return 'HOLD';
    }
    const prevShort = sma(closes.slice(0, -1), shortPeriod);
    const prevLong = sma(closes.slice(0, -1), longPeriod);
    const currShort = sma(closes, shortPeriod);
    const currLong = sma(closes, longPeriod);
    if (
      [prevShort, prevLong, currShort, currLong].some((v) => Number.isNaN(v))
    ) {
      return 'HOLD';
    }
    if (prevShort <= prevLong && currShort > currLong) {
      return 'BUY';
    }
    if (prevShort >= prevLong && currShort < currLong) {
      return 'SELL';
    }
    return 'HOLD';
  }

  private rsiStrategy(
    params: Record<string, unknown>,
    closes: number[],
  ): StrategySignal {
    const period = Number(params.period) || 14;
    const oversold =
      params.oversold != null && !Number.isNaN(Number(params.oversold))
        ? Number(params.oversold)
        : 30;
    const overbought =
      params.overbought != null && !Number.isNaN(Number(params.overbought))
        ? Number(params.overbought)
        : 70;
    if (closes.length < period + 2) {
      return 'HOLD';
    }
    const prevR = rsi(closes.slice(0, -1), period);
    const currR = rsi(closes, period);
    if (Number.isNaN(prevR) || Number.isNaN(currR)) {
      return 'HOLD';
    }
    if (prevR > oversold && currR <= oversold) {
      return 'BUY';
    }
    if (prevR < overbought && currR >= overbought) {
      return 'SELL';
    }
    return 'HOLD';
  }
}
