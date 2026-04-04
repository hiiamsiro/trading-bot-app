export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'sma-crossover-template',
    name: 'SMA Crossover',
    description: 'Buy when short SMA crosses above long SMA, sell on reverse cross',
    language: 'javascript',
    code: `// SMA Crossover Strategy
// Buys when short SMA crosses above long SMA, sells on reverse

const shortPeriod = 10;
const longPeriod = 30;

const closes = context.candles.map(c => c.close);
const shortMA = indicators.sma(closes, shortPeriod);
const longMA = indicators.sma(closes, longPeriod);

const prevCandles = context.candles.slice(0, -1);
const prevShortMA = indicators.sma(prevCandles.map(c => c.close), shortPeriod);
const prevLongMA = indicators.sma(prevCandles.map(c => c.close), longPeriod);

// Bullish crossover
if (prevShortMA <= prevLongMA && shortMA > longMA && context.position !== 'long') {
  signal('BUY', 0.8, \`Short MA (\${shortMA.toFixed(4)}) crossed above Long MA (\${longMA.toFixed(4)})\`);
}
// Bearish crossover
else if (prevShortMA >= prevLongMA && shortMA < longMA && context.position !== 'short') {
  signal('SELL', 0.8, \`Short MA (\${shortMA.toFixed(4)}) crossed below Long MA (\${longMA.toFixed(4)})\`);
}
else {
  signal('HOLD', 0.1, 'No crossover detected');
}`,
  },
  {
    id: 'rsi-mean-reversion-template',
    name: 'RSI Mean Reversion',
    description: 'Buy when RSI drops below oversold threshold, sell when overbought',
    language: 'javascript',
    code: `// RSI Mean Reversion Strategy
// Buys RSI < oversold threshold, sells RSI > overbought threshold

const period = 14;
const oversoldThreshold = 30;
const overboughtThreshold = 70;

const closes = context.candles.map(c => c.close);
const rsiValue = indicators.rsi(closes, period);

if (Number.isNaN(rsiValue)) {
  signal('HOLD', 0.1, 'RSI not yet available');
  return;
}

if (rsiValue < oversoldThreshold) {
  signal('BUY', 0.7, \`RSI = \${rsiValue.toFixed(1)} (oversold < \${oversoldThreshold})\`);
}
else if (rsiValue > overboughtThreshold) {
  signal('SELL', 0.7, \`RSI = \${rsiValue.toFixed(1)} (overbought > \${overboughtThreshold})\`);
}
else {
  signal('HOLD', 0.5, \`RSI = \${rsiValue.toFixed(1)} (neutral zone)\`);
}`,
  },
  {
    id: 'macd-momentum-template',
    name: 'MACD Momentum',
    description: 'Buy when MACD line crosses above signal line (bullish momentum)',
    language: 'javascript',
    code: `// MACD Momentum Strategy
// Buys when MACD line crosses above signal line

const closes = context.candles.map(c => c.close);
const macdResult = indicators.macd(closes, 12, 26, 9);

if (Number.isNaN(macdResult.macd) || Number.isNaN(macdResult.signal)) {
  signal('HOLD', 0.1, 'MACD not yet available');
  return;
}

// Compute previous MACD to detect crossover
const prevCloses = context.candles.slice(0, -1).map(c => c.close);
const prevMacd = indicators.macd(prevCloses, 12, 26, 9);

if (Number.isNaN(prevMacd.macd) || Number.isNaN(prevMacd.signal)) {
  // Not enough history for crossover detection
  signal('HOLD', 0.3, 'MACD crossover not yet determinable');
  return;
}

const prevHistogram = prevMacd.macd - prevMacd.signal;
const currHistogram = macdResult.macd - macdResult.signal;

if (prevHistogram <= 0 && currHistogram > 0 && context.position !== 'long') {
  signal('BUY', 0.75, \`MACD crossed above signal (histogram \${currHistogram.toFixed(4)})\`);
}
else if (prevHistogram >= 0 && currHistogram < 0 && context.position !== 'short') {
  signal('SELL', 0.75, \`MACD crossed below signal (histogram \${currHistogram.toFixed(4)})\`);
}
else {
  signal('HOLD', 0.2, 'No MACD crossover');
}`,
  },
  {
    id: 'bollinger-breakout-template',
    name: 'Bollinger Breakout',
    description: 'Buy when price breaks above upper Bollinger Band (volatility breakout)',
    language: 'javascript',
    code: `// Bollinger Bands Breakout Strategy
// Buys when price breaks above upper band, sells on lower band break

const period = 20;
const stdDevMultiplier = 2;

const closes = context.candles.map(c => c.close);
const latestClose = closes[closes.length - 1];
const bb = indicators.bollingerBands(closes, period, stdDevMultiplier);

if (Number.isNaN(bb.upper) || Number.isNaN(bb.lower)) {
  signal('HOLD', 0.1, 'Bollinger Bands not yet available');
  return;
}

if (latestClose > bb.upper && context.position !== 'long') {
  signal('BUY', 0.7, \`Price (\${latestClose.toFixed(4)}) broke above upper band (\${bb.upper.toFixed(4)})\`);
}
else if (latestClose < bb.lower && context.position !== 'short') {
  signal('SELL', 0.7, \`Price (\${latestClose.toFixed(4)}) broke below lower band (\${bb.lower.toFixed(4)})\`);
}
else {
  signal('HOLD', 0.3, \`Price within bands (upper: \${bb.upper.toFixed(4)}, lower: \${bb.lower.toFixed(4)})\`);
}`,
  },
  {
    id: 'multi-timeframe-template',
    name: 'Multi-Timeframe Trend',
    description: 'Trend filter on 1H, entry signals on 15m (if context.candles has multi-timeframe data)',
    language: 'javascript',
    code: `// Multi-Timeframe Trend Strategy
// Buys when short EMA is above long EMA (bullish trend) with RSI confirmation

const shortEmaPeriod = 9;
const longEmaPeriod = 21;
const rsiPeriod = 14;
const rsiConfirmation = 50;

const closes = context.candles.map(c => c.close);

// If extra candles exist for trend (from different interval), use last part of candles array
// The backend should inject higher-timeframe candles as additional entries
const trendCandles = context.candles.slice(0, Math.floor(context.candles.length / 2));
const entryCandles = context.candles;

const trendShortEMA = indicators.ema(trendCandles.map(c => c.close), shortEmaPeriod);
const trendLongEMA = indicators.ema(trendCandles.map(c => c.close), longEmaPeriod);

const entryShortEMA = indicators.ema(entryCandles.map(c => c.close), shortEmaPeriod);
const entryLongEMA = indicators.ema(entryCandles.map(c => c.close), longEmaPeriod);
const entryRSI = indicators.rsi(entryCandles.map(c => c.close), rsiPeriod);

const trendBullish = trendShortEMA > trendLongEMA;
const entryBullish = entryShortEMA > entryLongEMA;
const rsiConfirm = !Number.isNaN(entryRSI) && entryRSI < rsiConfirmation;

if (trendBullish && entryBullish && rsiConfirm && context.position !== 'long') {
  signal('BUY', 0.85, \`Multi-TF bullish: trend EMA \${trendShortEMA.toFixed(2)} > \${trendLongEMA.toFixed(2)}, RSI \${entryRSI.toFixed(1)} < \${rsiConfirmation}\`);
}
else if (!trendBullish && !entryBullish && context.position !== 'short') {
  signal('SELL', 0.8, 'Multi-TF bearish: trend EMA confirmed downtrend');
}
else {
  signal('HOLD', 0.2, \`Trend: \${trendBullish ? 'bullish' : 'bearish'}, Entry: \${entryBullish ? 'bullish' : 'bearish'}\`);
}`,
  },
];