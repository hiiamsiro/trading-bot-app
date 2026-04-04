import { test, describe, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { StrategySandboxService } from './strategy-sandbox.service';
import { SandboxContext } from './strategy-code.entity';
import { EXECUTION_TIMEOUT_MS } from './strategy-sandbox.service';

const DEFAULT_CONTEXT: SandboxContext = {
  symbol: 'BTCUSD',
  interval: '1h',
  candles: Array.from({ length: 50 }, (_, i) => ({
    open: 50000 + i * 100,
    high: 50200 + i * 100,
    low: 49800 + i * 100,
    close: 50100 + i * 100,
    volume: 1000,
  })),
  position: null,
  balance: 10000,
  entryPrice: null,
};

// Cast to any to handle execute()'s Promise<SandboxResult | null> return type
// where TypeScript can't infer that these calls will throw
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertThrowsAsync(
  fn: () => Promise<any>,
  pattern: string | RegExp,
): Promise<void> {
  try {
    await fn();
    assert.fail('Expected function to throw, but it did not');
  } catch (err) {
    const msg = (err as Error).message;
    if (typeof pattern === 'string') {
      assert.ok(msg.includes(pattern), `Expected "${pattern}" in message but got: ${msg}`);
    } else {
      assert.ok(pattern.test(msg), `Expected ${pattern} to match message: ${msg}`);
    }
  }
}

describe('StrategySandboxService', () => {
  let service: StrategySandboxService;

  beforeEach(() => {
    service = new StrategySandboxService();
  });

  // ─── Valid signal tests ──────────────────────────────────────────────────────

  test('returns BUY signal for valid code calling signal(BUY, ...)', async () => {
    const result = await service.execute(
      `signal('BUY', 0.8, 'Test buy signal');`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.strictEqual(result!.confidence, 0.8);
    assert.strictEqual(result!.reason, 'Test buy signal');
  });

  test('returns SELL signal for valid code calling signal(SELL, ...)', async () => {
    const result = await service.execute(
      `signal('SELL', 0.6, 'Test sell signal');`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'SELL');
    assert.strictEqual(result!.confidence, 0.6);
    assert.strictEqual(result!.reason, 'Test sell signal');
  });

  test('returns HOLD signal when signal(HOLD, ...) is called', async () => {
    const result = await service.execute(
      `signal('HOLD', 0.1, 'No signal');`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'HOLD');
    assert.strictEqual(result!.confidence, 0.1);
    assert.strictEqual(result!.reason, 'No signal');
  });

  test('returns null (HOLD) when no signal is called at all', async () => {
    const result = await service.execute(
      `const x = 1 + 1; // no signal`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result, null);
  });

  test('clamps confidence to [0, 1] range', async () => {
    const r1 = await service.execute(
      `signal('BUY', 1.5, 'clamped high');`,
      DEFAULT_CONTEXT,
    );
    assert.strictEqual(r1!.confidence, 1);

    const r2 = await service.execute(
      `signal('BUY', -0.5, 'clamped low');`,
      DEFAULT_CONTEXT,
    );
    assert.strictEqual(r2!.confidence, 0);
  });

  test('normalizes action string to uppercase', async () => {
    const result = await service.execute(
      `signal('buy', 0.9, 'lowercase action');`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result!.action, 'BUY');
  });

  test('ignores invalid action strings and returns null', async () => {
    const result = await service.execute(
      `signal('invalid', 0.9, 'invalid action');`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result, null);
  });

  // ─── Timeout tests ───────────────────────────────────────────────────────────

  test(`times out and returns null (HOLD) after ${EXECUTION_TIMEOUT_MS}ms`, async () => {
    const result = await service.execute(
      `while (true) { } signal('BUY', 1, 'never reached');`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result, null);
  });

  // ─── Escape attempt / security tests ────────────────────────────────────────

  test('blocks eval() escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`eval('signal("BUY", 1, "escaped")')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks Function constructor escape attempt', async () => {
    await assertThrowsAsync(
      async () =>
        service.execute(
          `(new Function('signal("BUY", 1, "Function constructor")'))()`,
          DEFAULT_CONTEXT,
        ),
      /Sandbox execution failed/,
    );
  });

  test('blocks require() escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`require('child_process').execSync('echo pwned')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks process.exit() escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`process.exit(0)`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks import() dynamic import escape attempt', async () => {
    await assertThrowsAsync(
      async () =>
        service.execute(
          `import('fs').then(m => m.writeFileSync('/tmp/pwned', 'pwned'))`,
          DEFAULT_CONTEXT,
        ),
      /Sandbox execution failed/,
    );
  });

  test('blocks global object escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`global.signal('BUY', 1, 'global escape')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks globalThis object escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`globalThis.signal('BUY', 1, 'globalThis escape')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks constructor escape attempt', async () => {
    await assertThrowsAsync(
      async () =>
        service.execute(
          `(void 0).constructor.constructor('signal("BUY",1,"constructor escape")')()`,
          DEFAULT_CONTEXT,
        ),
      /Sandbox execution failed/,
    );
  });

  test('blocks setTimeout escape attempt', async () => {
    await assertThrowsAsync(
      async () =>
        service.execute(
          `setTimeout(() => signal('BUY', 1, 'setTimeout escape'), 0)`,
          DEFAULT_CONTEXT,
        ),
      /Sandbox execution failed/,
    );
  });

  test('blocks arguments.callee escape attempt', async () => {
    await assertThrowsAsync(
      async () =>
        service.execute(
          `(() => { const f = arguments.callee; signal('BUY',1,'callee escape'); })()`,
          DEFAULT_CONTEXT,
        ),
      /Sandbox execution failed/,
    );
  });

  test('blocks __dirname escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`const d = __dirname; signal('BUY', 1, d)`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks __filename escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`const f = __filename; signal('BUY', 1, f)`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks window escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`window.signal('BUY', 1, 'window escape')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks document escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`const c = document.cookie`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('blocks fetch escape attempt', async () => {
    await assertThrowsAsync(
      async () => service.execute(`fetch('http://evil.com')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  // ─── Syntax / compilation error tests ────────────────────────────────────────

  test('throws for invalid syntax', async () => {
    await assertThrowsAsync(
      async () => service.execute(`signal('BUY', 1, unterminated string`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  test('throws for undefined variable reference', async () => {
    await assertThrowsAsync(
      async () => service.execute(`someUnknownVariable.signal('BUY', 1, 'x')`, DEFAULT_CONTEXT),
      /Sandbox execution failed/,
    );
  });

  // ─── Indicator tests ─────────────────────────────────────────────────────────

  test('correctly computes sma indicator', async () => {
    const result = await service.execute(
      `const closes = context.candles.map(c => c.close);
       const s = indicators.sma(closes, 20);
       signal('BUY', s / 100000, 'SMA value: ' + s.toFixed(2));`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.ok(result!.confidence > 0);
    assert.ok(result!.reason.includes('SMA value:'));
  });

  test('correctly computes rsi indicator', async () => {
    const result = await service.execute(
      `const closes = context.candles.map(c => c.close);
       const r = indicators.rsi(closes, 14);
       signal(r < 50 ? 'BUY' : 'SELL', 0.8, 'RSI: ' + r.toFixed(1));`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.ok(['BUY', 'SELL'].includes(result!.action));
    assert.ok(result!.reason.match(/RSI: \d+\.\d+/));
  });

  test('correctly computes ema indicator', async () => {
    const result = await service.execute(
      `const closes = context.candles.map(c => c.close);
       const e = indicators.ema(closes, 20);
       signal('BUY', 0.8, 'EMA: ' + e.toFixed(2));`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.ok(result!.reason.includes('EMA:'));
  });

  test('correctly computes macd indicator with custom periods', async () => {
    const result = await service.execute(
      `const closes = context.candles.map(c => c.close);
       const m = indicators.macd(closes, 12, 26, 9);
       signal('BUY', 0.8, 'MACD: ' + m.macd.toFixed(2) + ' Signal: ' + m.signal.toFixed(2));`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.ok(result!.reason.includes('MACD:'));
  });

  test('correctly computes bollingerBands indicator', async () => {
    const result = await service.execute(
      `const closes = context.candles.map(c => c.close);
       const bb = indicators.bollingerBands(closes, 20, 2);
       signal('BUY', 0.8, 'BB Upper: ' + bb.upper.toFixed(2));`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.ok(result!.reason.includes('BB Upper:'));
  });

  test('has access to context.candles', async () => {
    const result = await service.execute(
      `const count = context.candles.length;
       const lastClose = context.candles[context.candles.length - 1].close;
       signal('BUY', 0.9, 'Candles: ' + count + ', last close: ' + lastClose);`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.ok(result!.reason.includes('Candles: 50'));
    assert.ok(result!.reason.includes('last close:'));
  });

  test('has access to context.position', async () => {
    const result = await service.execute(
      `const pos = context.position;
       signal(pos === null ? 'BUY' : 'HOLD', 0.9, 'Position: ' + pos);`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.action, 'BUY');
    assert.ok(result!.reason.includes('Position: null'));
  });

  test('has access to context.balance and context.symbol', async () => {
    const result = await service.execute(
      `signal('BUY', 0.9, context.symbol + ' balance: ' + context.balance);`,
      DEFAULT_CONTEXT,
    );

    assert.notStrictEqual(result, null);
    assert.ok(result!.reason.includes('BTCUSD'));
    assert.ok(result!.reason.includes('10000'));
  });

  test('only uses first signal when multiple are called', async () => {
    const result = await service.execute(
      `signal('SELL', 0.5, 'second');
       signal('BUY', 0.9, 'first wins');`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result!.action, 'SELL');
    assert.strictEqual(result!.reason, 'second');
  });

  test('provides Math globals', async () => {
    const result = await service.execute(
      `const val = Math.max(1, 2, 3) + Math.min(4, 5);
       signal('BUY', 0.9, 'Math result: ' + val);`,
      DEFAULT_CONTEXT,
    );

    assert.ok(result!.reason.includes('Math result: 6'));
  });

  test('handles NaN from indicators gracefully', async () => {
    const result = await service.execute(
      `const s = indicators.sma([1, 2], 100); // not enough data
       if (Number.isNaN(s)) {
         signal('HOLD', 0.1, 'Insufficient data for SMA');
       } else {
         signal('BUY', 0.9, 'SMA: ' + s);
       }`,
      DEFAULT_CONTEXT,
    );

    assert.strictEqual(result!.action, 'HOLD');
    assert.ok(result!.reason.includes('Insufficient data'));
  });
});
