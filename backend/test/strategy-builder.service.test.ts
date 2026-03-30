import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { StrategyBuilderService } = require('../src/strategy/strategy-builder.service.ts');

function makeService() {
  return new StrategyBuilderService();
}

/** Throws-helper that avoids the assert.throws(fn, cb) → assert.re-throws pitfall. */
function assertThrows(fn: () => void, pattern: string | RegExp) {
  try {
    fn();
    assert.fail('Expected function to throw, but it did not');
  } catch (err) {
    const msg = (err as Error).message;
    if (typeof pattern === 'string') {
      assert.ok(msg.includes(pattern), `Expected message to include "${pattern}" but got: ${msg}`);
    } else {
      assert.ok(pattern.test(msg), `Expected message to match ${pattern} but got: ${msg}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// createDefault
// ─────────────────────────────────────────────────────────

test('createDefault returns a valid config', () => {
  const svc = makeService();
  const cfg = svc.createDefault();
  assert.equal(cfg.version, 1);
  assert.equal(cfg.entryOperator, 'AND');
  assert.equal(cfg.conditions.length, 1);
  assert.equal(cfg.conditions[0].type, 'CONDITION');
  assert.equal(cfg.conditions[0].condition.indicator, 'RSI');
  assert.equal(cfg.conditions[0].condition.params.period, 14);
  assert.equal(cfg.conditions[0].condition.comparison, 'CROSSES_BELOW');
  assert.equal(cfg.conditions[0].condition.value, 30);
  assert.equal(cfg.risk.quantity, 0.01);
});

test('createDefault condition has a valid id', () => {
  const svc = makeService();
  const cfg = svc.createDefault();
  assert.ok(typeof cfg.conditions[0].condition.id === 'string');
  assert.ok(cfg.conditions[0].condition.id.length > 0);
});

// ─────────────────────────────────────────────────────────
// validateConfig — valid configs
// ─────────────────────────────────────────────────────────

test('validateConfig accepts a valid RSI condition config', () => {
  const svc = makeService();
  assert.doesNotThrow(() =>
    svc.validateConfig({
      version: 1,
      entryOperator: 'AND',
      conditions: [
        {
          type: 'CONDITION',
          condition: {
            id: 'abc',
            indicator: 'RSI',
            params: { period: 14 },
            comparison: 'CROSSES_BELOW',
            value: 30,
          },
        },
      ],
      risk: { quantity: 0.01 },
    }),
  );
});

test('validateConfig accepts a valid MA crossover config', () => {
  const svc = makeService();
  assert.doesNotThrow(() =>
    svc.validateConfig({
      version: 1,
      entryOperator: 'OR',
      conditions: [
        {
          type: 'CONDITION',
          condition: {
            id: 'abc',
            indicator: 'MA',
            params: { shortPeriod: 5, longPeriod: 20 },
            comparison: 'CROSSES_ABOVE',
            value: 50,
          },
        },
      ],
      risk: { quantity: 0.05 },
    }),
  );
});

test('validateConfig accepts config with optional risk fields', () => {
  const svc = makeService();
  assert.doesNotThrow(() =>
    svc.validateConfig({
      version: 1,
      entryOperator: 'AND',
      conditions: [
        {
          type: 'CONDITION',
          condition: {
            id: 'abc',
            indicator: 'RSI',
            params: { period: 14 },
            comparison: 'CROSSES_BELOW',
            value: 30,
          },
        },
      ],
      risk: { quantity: 0.01, stopLossPercent: 2, takeProfitPercent: 5, maxDailyLoss: 10 },
    }),
  );
});

// ─────────────────────────────────────────────────────────
// validateConfig — invalid configs
// ─────────────────────────────────────────────────────────

test('validateConfig throws when config is not an object', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig(null), 'must be an object');
  assertThrows(() => svc.validateConfig(undefined), 'must be an object');
  assertThrows(() => svc.validateConfig('foo'), 'must be an object');
});

test('validateConfig throws when version is not 1', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 2,
        entryOperator: 'AND',
        conditions: [],
        risk: { quantity: 0.01 },
      }),
    'version must be 1',
  );
});

test('validateConfig throws when version is missing', () => {
  const svc = makeService();
  assertThrows(
    () => svc.validateConfig({ entryOperator: 'AND', conditions: [], risk: { quantity: 0.01 } }),
    'version must be 1',
  );
});

test('validateConfig throws when conditions is not an array', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: 'foo',
        risk: { quantity: 0.01 },
      }),
    'must have a conditions array',
  );
});

test('validateConfig throws when conditions is empty', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [],
        risk: { quantity: 0.01 },
      }),
    'at least one condition',
  );
});

test('validateConfig throws when entryOperator is invalid', () => {
  const svc = makeService();
  // conditions.length check runs before entryOperator check, so must provide valid condition
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'XOR',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'a',
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'entryOperator must be AND or OR',
  );
});

test('validateConfig throws when entryOperator is missing', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'a',
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'entryOperator must be AND or OR',
  );
});

test('validateConfig throws when risk is missing', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'a',
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
      }),
    'must have a risk object',
  );
});

test('validateConfig throws when risk.quantity is missing or invalid', () => {
  const svc = makeService();
  const cond = {
    type: 'CONDITION' as const,
    condition: {
      id: 'a',
      indicator: 'RSI' as const,
      params: { period: 14 },
      comparison: 'CROSSES_BELOW' as const,
      value: 30,
    },
  };
  assertThrows(
    () => svc.validateConfig({ version: 1, entryOperator: 'AND', conditions: [cond], risk: {} }),
    'risk.quantity must be a number > 0',
  );
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: 0 },
      }),
    'risk.quantity must be a number > 0',
  );
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: -1 },
      }),
    'risk.quantity must be a number > 0',
  );
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: 'abc' as unknown as number },
      }),
    'risk.quantity must be a number > 0',
  );
});

test('validateConfig throws when stopLossPercent is out of range', () => {
  const svc = makeService();
  const cond = {
    type: 'CONDITION' as const,
    condition: {
      id: 'a',
      indicator: 'RSI' as const,
      params: { period: 14 },
      comparison: 'CROSSES_BELOW' as const,
      value: 30,
    },
  };
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: 0.01, stopLossPercent: 100 },
      }),
    '> 0 and < 100',
  );
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: 0.01, stopLossPercent: 0 },
      }),
    '> 0 and < 100',
  );
});

test('validateConfig throws when takeProfitPercent is out of range', () => {
  const svc = makeService();
  const cond = {
    type: 'CONDITION' as const,
    condition: {
      id: 'a',
      indicator: 'RSI' as const,
      params: { period: 14 },
      comparison: 'CROSSES_BELOW' as const,
      value: 30,
    },
  };
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [cond],
        risk: { quantity: 0.01, takeProfitPercent: 100 },
      }),
    '> 0 and < 100',
  );
});

test('validateConfig throws for unknown condition type', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [{ type: 'UNKNOWN' }],
        risk: { quantity: 0.01 },
      } as unknown as Parameters<typeof svc.validateConfig>[0]),
    'Unknown condition type',
  );
});

test('validateConfig throws for condition missing id', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'must have an id',
  );
});

test('validateConfig throws for unknown indicator', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'MACD',
              params: {},
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'Indicator must be RSI or MA',
  );
});

test('validateConfig throws for unknown comparison', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'EQUALS',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'Comparison must be one of',
  );
});

test('validateConfig throws for RSI period < 2', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'RSI',
              params: { period: 1 },
              comparison: 'CROSSES_BELOW',
              value: 30,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'RSI period must be an integer >= 2',
  );
});

test('validateConfig throws for RSI value out of 0-100', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'RSI',
              params: { period: 14 },
              comparison: 'CROSSES_BELOW',
              value: 150,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'RSI threshold value must be between 0 and 100',
  );
});

test('validateConfig throws for MA shortPeriod < 1', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'MA',
              params: { shortPeriod: 0, longPeriod: 20 },
              comparison: 'CROSSES_ABOVE',
              value: 50,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'MA short period must be an integer >= 1',
  );
});

test('validateConfig throws for MA longPeriod < 2', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'MA',
              params: { shortPeriod: 5, longPeriod: 1 },
              comparison: 'CROSSES_ABOVE',
              value: 50,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'MA long period must be an integer >= 2',
  );
});

test('validateConfig throws for MA shortPeriod >= longPeriod', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'CONDITION',
            condition: {
              id: 'abc',
              indicator: 'MA',
              params: { shortPeriod: 10, longPeriod: 10 },
              comparison: 'CROSSES_ABOVE',
              value: 50,
            },
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'short period must be smaller than long period',
  );
});

test('validateConfig throws for GROUP without operator', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [{ type: 'GROUP', conditions: [] }],
        risk: { quantity: 0.01 },
      } as unknown as Parameters<typeof svc.validateConfig>[0]),
    'Group operator must be AND or OR',
  );
});

test('validateConfig throws for GROUP with < 2 children', () => {
  const svc = makeService();
  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [
          {
            type: 'GROUP',
            operator: 'AND',
            conditions: [
              {
                type: 'CONDITION',
                condition: {
                  id: 'abc',
                  indicator: 'RSI',
                  params: { period: 14 },
                  comparison: 'CROSSES_BELOW',
                  value: 30,
                },
              },
            ],
          },
        ],
        risk: { quantity: 0.01 },
      }),
    'Group must have at least 2 conditions',
  );
});

test('validateConfig throws when nesting depth exceeds 3', () => {
  const svc = makeService();
  const leafA = {
    type: 'CONDITION' as const,
    condition: {
      id: 'a',
      indicator: 'RSI' as const,
      params: { period: 14 },
      comparison: 'CROSSES_BELOW' as const,
      value: 30,
    },
  };
  const leafB = {
    type: 'CONDITION' as const,
    condition: {
      id: 'b',
      indicator: 'RSI' as const,
      params: { period: 14 },
      comparison: 'CROSSES_BELOW' as const,
      value: 25,
    },
  };

  const g4 = { type: 'GROUP' as const, operator: 'AND' as const, conditions: [leafA, leafB] }; // depth 4 children
  const g3 = { type: 'GROUP' as const, operator: 'AND' as const, conditions: [g4, leafA] }; // depth 3
  const g2 = { type: 'GROUP' as const, operator: 'AND' as const, conditions: [g3, leafB] }; // depth 2
  const g1 = { type: 'GROUP' as const, operator: 'AND' as const, conditions: [g2, leafA] }; // depth 1

  assertThrows(
    () =>
      svc.validateConfig({
        version: 1,
        entryOperator: 'AND',
        conditions: [g1],
        risk: { quantity: 0.01 },
      } as unknown as Parameters<typeof svc.validateConfig>[0]),
    'Maximum nesting depth of 3 exceeded',
  );
});

// ─────────────────────────────────────────────────────────
// compileConfig
// ─────────────────────────────────────────────────────────

test('compileConfig returns rsi strategy for RSI condition', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.strategy, 'rsi');
  assert.equal(result.params.period, 14);
  assert.equal(result.params.quantity, 0.01);
});

test('compileConfig infers oversold from CROSSES_BELOW RSI', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.05 },
  });
  assert.equal(result.params.oversold, 30);
  assert.equal(result.params.overbought, 70);
});

test('compileConfig infers overbought from CROSSES_ABOVE RSI', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 7 },
          comparison: 'CROSSES_ABOVE',
          value: 70,
        },
      },
    ],
    risk: { quantity: 0.1 },
  });
  assert.equal(result.params.oversold, 30);
  assert.equal(result.params.overbought, 70);
});

test('compileConfig infers BELOW RSI as oversold signal', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'BELOW',
          value: 25,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.params.oversold, 25);
});

test('compileConfig returns sma_crossover for MA condition', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'MA',
          params: { shortPeriod: 5, longPeriod: 20 },
          comparison: 'CROSSES_ABOVE',
          value: 50,
        },
      },
    ],
    risk: { quantity: 0.02 },
  });
  assert.equal(result.strategy, 'sma_crossover');
  assert.equal(result.params.shortPeriod, 5);
  assert.equal(result.params.longPeriod, 20);
  assert.equal(result.params.quantity, 0.02);
});

test('compileConfig picks min shortPeriod and max longPeriod across multiple MA conditions', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'a',
          indicator: 'MA',
          params: { shortPeriod: 5, longPeriod: 20 },
          comparison: 'CROSSES_ABOVE',
          value: 50,
        },
      },
      {
        type: 'CONDITION',
        condition: {
          id: 'b',
          indicator: 'MA',
          params: { shortPeriod: 10, longPeriod: 50 },
          comparison: 'CROSSES_BELOW',
          value: 50,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.params.shortPeriod, 5); // min
  assert.equal(result.params.longPeriod, 50); // max
});

test('compileConfig passes optional risk fields when present', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.01, stopLossPercent: 2.5, takeProfitPercent: 5, maxDailyLoss: 10 },
  });
  assert.equal(result.params.stopLossPercent, 2.5);
  assert.equal(result.params.takeProfitPercent, 5);
  assert.equal(result.params.maxDailyLoss, 10);
});

test('compileConfig does not include optional risk fields when absent', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.ok(!('stopLossPercent' in result.params));
  assert.ok(!('takeProfitPercent' in result.params));
  assert.ok(!('maxDailyLoss' in result.params));
});

test('compileConfig defaults period to 14 when missing in RSI', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: {},
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.params.period, 14);
});

test('compileConfig defaults MA periods when missing', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'MA',
          params: {},
          comparison: 'CROSSES_ABOVE',
          value: 50,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.params.shortPeriod, 10);
  assert.equal(result.params.longPeriod, 20);
});

test('compileConfig defaults to sma_crossover when mixed RSI+MA conditions', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'a',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
      {
        type: 'CONDITION',
        condition: {
          id: 'b',
          indicator: 'MA',
          params: { shortPeriod: 5, longPeriod: 20 },
          comparison: 'CROSSES_ABOVE',
          value: 50,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  // inferStrategy defaults to sma_crossover for mixed indicator configs
  assert.equal(result.strategy, 'sma_crossover');
});

test('compileConfig falls back to rsi for unknown indicator mix', () => {
  const svc = makeService();
  const result = svc.compileConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 14 },
          comparison: 'CROSSES_BELOW',
          value: 30,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.equal(result.strategy, 'rsi');
});

// ─────────────────────────────────────────────────────────
// describeConfig
// ─────────────────────────────────────────────────────────

test('describeConfig returns RSI description', () => {
  const svc = makeService();
  const desc = svc.describeConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'RSI',
          params: { period: 7 },
          comparison: 'CROSSES_BELOW',
          value: 25,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.ok(desc.includes('RSI strategy'));
  assert.ok(desc.includes('period 7'));
  assert.ok(desc.includes('oversold 25'));
  assert.ok(desc.includes('overbought 70'));
});

test('describeConfig returns SMA Crossover description', () => {
  const svc = makeService();
  const desc = svc.describeConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [
      {
        type: 'CONDITION',
        condition: {
          id: 'abc',
          indicator: 'MA',
          params: { shortPeriod: 5, longPeriod: 20 },
          comparison: 'CROSSES_ABOVE',
          value: 50,
        },
      },
    ],
    risk: { quantity: 0.01 },
  });
  assert.ok(desc.includes('SMA Crossover'));
  assert.ok(desc.includes('short 5'));
  assert.ok(desc.includes('long 20'));
});

test('describeConfig returns fallback for invalid config', () => {
  const svc = makeService();
  const desc = svc.describeConfig({
    version: 1,
    entryOperator: 'AND',
    conditions: [],
    risk: { quantity: 0.01 },
  } as Parameters<typeof svc.describeConfig>[0]);
  assert.equal(desc, 'Custom condition strategy');
});

export {};
