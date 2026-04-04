/**
 * Worker script run inside a Worker thread for sandboxed strategy execution.
 * Initialized once per worker — indicator functions and BLOCKED list are
 * compiled once at worker startup, not re-created per message.
 */
export const WORKER_SCRIPT = `'use strict';
const { parentPort } = require('worker_threads');
const vm = require('vm');

// ── Indicators (same pure implementations as the main thread) ────────────────
function sma(values, period) {
  if (values.length < period || period < 1) return Number.NaN;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}
function rsi(closes, period) {
  if (closes.length < period + 1 || period < 1) return Number.NaN;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function ema(values, period) {
  if (values.length < period || period < 1) return Number.NaN;
  const k = 2 / (period + 1);
  let ev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) ev = values[i] * k + ev * (1 - k);
  return ev;
}
function macd(values, fp = 12, sp = 26, sigP = 9) {
  if (values.length < sp + sigP) return { macd: Number.NaN, signal: Number.NaN, histogram: Number.NaN };
  const fe = ema(values, fp), se = ema(values, sp), ml = fe - se;
  const mvs = [];
  for (let i = sp; i < values.length; i++) {
    const f = ema(values.slice(0, i + 1), fp), s = ema(values.slice(0, i + 1), sp);
    if (!Number.isNaN(f) && !Number.isNaN(s)) mvs.push(f - s);
  }
  const sl = mvs.length >= sigP ? ema(mvs, sigP) : Number.NaN;
  return { macd: ml, signal: sl, histogram: Number.isNaN(sl) ? Number.NaN : ml - sl };
}
function bollingerBands(values, period = 20, stdDev = 2) {
  const mid = sma(values, period);
  if (Number.isNaN(mid)) return { upper: Number.NaN, middle: Number.NaN, lower: Number.NaN };
  const slice = values.slice(-period);
  const variance = slice.reduce((acc, v) => acc + Math.pow(v - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mid + stdDev * std, middle: mid, lower: mid - stdDev * std };
}

// ── Blocked globals — all set to undefined so user code cannot escape ────────
// NOTE: Symbol is also blocked to prevent prototype-chain traversal attacks.
const BLOCKED = [
  'eval','Function','constructor','process','require','import',
  'global','globalThis','window','document','fetch','XMLHttpRequest',
  'WebSocket','setTimeout','setInterval','clearTimeout','clearInterval',
  'setImmediate','execSync','spawn','spawnSync','__dirname','__filename',
  'module','exports','arguments','this','Symbol',
];

parentPort.on('message', ({ code, context: ctx, timeoutMs: tm }) => {
  let signalAction = null, signalConfidence = 0, signalReason = '';

  const signal = (action, confidence, reason) => {
    if (signalAction !== null) return;
    const a = String(action).toUpperCase();
    if (a === 'BUY' || a === 'SELL' || a === 'HOLD') {
      signalAction = a;
      signalConfidence = Math.max(0, Math.min(1, Number(confidence) || 0));
      signalReason = String(reason);
    }
  };

  const sandbox = {
    indicators: { sma, rsi, ema, macd, bollingerBands },
    context: ctx,
    signal,
    Math, Number, String, Boolean, Array, Object, JSON, Date,
    Map, Set, WeakMap, WeakSet, Promise, BigInt,
    undefined, NaN, Infinity,
    'Number.isNaN': Number.isNaN, 'Number.isFinite': Number.isFinite,
    'Number.isInteger': Number.isInteger, 'Number.parseFloat': Number.parseFloat,
    'Number.parseInt': Number.parseInt,
    'Math.abs': Math.abs, 'Math.max': Math.max, 'Math.min': Math.min,
    'Math.pow': Math.pow, 'Math.sqrt': Math.sqrt,
    'Math.floor': Math.floor, 'Math.ceil': Math.ceil,
    'Math.round': Math.round, 'Math.log': Math.log, 'Math.exp': Math.exp,
  };
  for (const name of BLOCKED) sandbox[name] = undefined;

  const vmCtx = vm.createContext(sandbox);
  try {
    vm.runInContext(code, vmCtx, { timeout: tm, displayErrors: true });
    if (signalAction === null) {
      parentPort.postMessage({ ok: true, timedOut: false, result: null });
    } else {
      parentPort.postMessage({
        ok: true, timedOut: false,
        result: { action: signalAction, confidence: signalConfidence, reason: signalReason },
      });
    }
  } catch (err) {
    if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      parentPort.postMessage({ ok: true, timedOut: true, result: null });
    } else {
      parentPort.postMessage({ ok: false, timedOut: false, error: err.message });
    }
  }
});
`;
