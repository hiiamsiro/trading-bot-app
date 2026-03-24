import { Injectable } from '@nestjs/common';
import { MarketKlineInterval } from '../market-data/providers/market-data-provider.types';

export type StrategySignal = 'BUY' | 'SELL' | 'HOLD';
export type StrategyDecision = {
  signal: StrategySignal;
  reason: string;
  metadata: Record<string, unknown>;
};

type StrategyInput = {
  strategyKey: string;
  instrument: string;
  interval: MarketKlineInterval;
  params: Record<string, unknown>;
  closes: number[];
};

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
  evaluate(input: StrategyInput): StrategyDecision {
    const key = this.normalizeStrategyKey(input.strategyKey);
    if (key === 'ma_crossover' || key === 'sma_crossover') {
      return this.maCrossover(input);
    }
    if (key === 'rsi') {
      return this.rsiStrategy(input);
    }
    return {
      signal: 'HOLD',
      reason: `Unsupported strategy: ${input.strategyKey}`,
      metadata: {
        strategy: input.strategyKey,
        instrument: input.instrument,
        interval: input.interval,
      },
    };
  }

  getRequiredCandles(strategyKey: string, params: Record<string, unknown>): number {
    const key = this.normalizeStrategyKey(strategyKey);
    if (key === 'ma_crossover' || key === 'sma_crossover') {
      const shortPeriod = Number(params.shortPeriod) || 10;
      const longPeriod = Number(params.longPeriod) || 20;
      return Math.max(longPeriod + 2, shortPeriod + 2);
    }
    if (key === 'rsi') {
      const period = Number(params.period) || 14;
      return period + 2;
    }
    return 2;
  }

  private normalizeStrategyKey(strategyKey: string): string {
    return strategyKey.toLowerCase().replace(/-/g, '_');
  }

  private maCrossover(input: StrategyInput): StrategyDecision {
    const { params, closes, instrument, interval } = input;
    const shortPeriod = Number(params.shortPeriod) || 10;
    const longPeriod = Number(params.longPeriod) || 20;
    if (shortPeriod >= longPeriod) {
      return {
        signal: 'HOLD',
        reason: 'Invalid MA periods: shortPeriod must be smaller than longPeriod',
        metadata: {
          strategy: 'sma_crossover',
          instrument,
          interval,
          shortPeriod,
          longPeriod,
          closesCount: closes.length,
        },
      };
    }
    const min = longPeriod + 2;
    if (closes.length < min) {
      return {
        signal: 'HOLD',
        reason: `Insufficient candle history for SMA crossover (${closes.length}/${min})`,
        metadata: {
          strategy: 'sma_crossover',
          instrument,
          interval,
          shortPeriod,
          longPeriod,
          requiredCandles: min,
          closesCount: closes.length,
        },
      };
    }
    const prevShort = sma(closes.slice(0, -1), shortPeriod);
    const prevLong = sma(closes.slice(0, -1), longPeriod);
    const currShort = sma(closes, shortPeriod);
    const currLong = sma(closes, longPeriod);
    if ([prevShort, prevLong, currShort, currLong].some((v) => Number.isNaN(v))) {
      return {
        signal: 'HOLD',
        reason: 'Unable to compute SMA values',
        metadata: {
          strategy: 'sma_crossover',
          instrument,
          interval,
          shortPeriod,
          longPeriod,
          closesCount: closes.length,
        },
      };
    }
    if (prevShort <= prevLong && currShort > currLong) {
      return {
        signal: 'BUY',
        reason: 'Bullish SMA crossover detected',
        metadata: {
          strategy: 'sma_crossover',
          instrument,
          interval,
          shortPeriod,
          longPeriod,
          prevShort,
          prevLong,
          currShort,
          currLong,
        },
      };
    }
    if (prevShort >= prevLong && currShort < currLong) {
      return {
        signal: 'SELL',
        reason: 'Bearish SMA crossover detected',
        metadata: {
          strategy: 'sma_crossover',
          instrument,
          interval,
          shortPeriod,
          longPeriod,
          prevShort,
          prevLong,
          currShort,
          currLong,
        },
      };
    }
    return {
      signal: 'HOLD',
      reason: 'No SMA crossover signal on this candle',
      metadata: {
        strategy: 'sma_crossover',
        instrument,
        interval,
        shortPeriod,
        longPeriod,
        prevShort,
        prevLong,
        currShort,
        currLong,
      },
    };
  }

  private rsiStrategy(input: StrategyInput): StrategyDecision {
    const { params, closes, instrument, interval } = input;
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
      return {
        signal: 'HOLD',
        reason: `Insufficient candle history for RSI (${closes.length}/${period + 2})`,
        metadata: {
          strategy: 'rsi',
          instrument,
          interval,
          period,
          oversold,
          overbought,
          requiredCandles: period + 2,
          closesCount: closes.length,
        },
      };
    }
    const prevR = rsi(closes.slice(0, -1), period);
    const currR = rsi(closes, period);
    if (Number.isNaN(prevR) || Number.isNaN(currR)) {
      return {
        signal: 'HOLD',
        reason: 'Unable to compute RSI values',
        metadata: {
          strategy: 'rsi',
          instrument,
          interval,
          period,
          oversold,
          overbought,
          closesCount: closes.length,
        },
      };
    }
    if (prevR > oversold && currR <= oversold) {
      return {
        signal: 'BUY',
        reason: 'RSI crossed into oversold zone',
        metadata: {
          strategy: 'rsi',
          instrument,
          interval,
          period,
          oversold,
          overbought,
          prevRsi: prevR,
          currRsi: currR,
        },
      };
    }
    if (prevR < overbought && currR >= overbought) {
      return {
        signal: 'SELL',
        reason: 'RSI crossed into overbought zone',
        metadata: {
          strategy: 'rsi',
          instrument,
          interval,
          period,
          oversold,
          overbought,
          prevRsi: prevR,
          currRsi: currR,
        },
      };
    }
    return {
      signal: 'HOLD',
      reason: 'RSI thresholds were not crossed',
      metadata: {
        strategy: 'rsi',
        instrument,
        interval,
        period,
        oversold,
        overbought,
        prevRsi: prevR,
        currRsi: currR,
      },
    };
  }
}
