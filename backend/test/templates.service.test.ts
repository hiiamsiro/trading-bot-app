const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const { TemplatesService } = require('../src/templates/templates.service.ts');

function makeService(overrides?: any) {
  // Collect call args manually
  const state: any = { calls: { findMany: [], findFirst: [], create: [], delete: [], validateConfig: [] } };

  const defaultValidate = (strategy: any, params: any) => ({
    normalizedStrategy: strategy === 'ma_crossover' ? 'sma_crossover' : strategy,
    normalizedParams: { ...params, period: 14, oversold: 30, overbought: 70, shortPeriod: 5, longPeriod: 20 },
  });

  const strategyService: any = {
    validateConfig: async (strategy: any, params: any) => {
      const impl = overrides?.strategyService?.validateConfig;
      state.calls.validateConfig.push([strategy, params]);
      return impl ? impl(strategy, params) : defaultValidate(strategy, params);
    },
  };

  const prisma: any = {
    botTemplate: {
      findMany: async (args: any) => {
        state.calls.findMany.push(args);
        const impl = overrides?.prisma?.botTemplate?.findMany;
        return impl ? impl(args) : [];
      },
      findFirst: async (args: any) => {
        state.calls.findFirst.push(args);
        const impl = overrides?.prisma?.botTemplate?.findFirst;
        return impl ? impl(args) : null;
      },
      create: async (args: any) => {
        state.calls.create.push(args);
        const impl = overrides?.prisma?.botTemplate?.create;
        return impl ? impl(args) : { id: 't1', ...args?.data };
      },
      delete: async (args: any) => {
        state.calls.delete.push(args);
        const impl = overrides?.prisma?.botTemplate?.delete;
        return impl ? impl(args) : { id: args?.where?.id };
      },
    },
  };

  const svc = new TemplatesService(prisma, strategyService);
  svc._state = state;
  return svc;
}

async function assertRejects(promise: Promise<any>, check: (err: any) => boolean) {
  try {
    await promise;
    assert.fail('Expected to reject');
  } catch (err) {
    assert.ok(check(err));
  }
}

// ─────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────

test('findAll returns both userTemplates and defaults', async () => {
  const svc = makeService();
  const result = await svc.findAll('user-1');
  assert.ok('userTemplates' in result);
  assert.ok('defaults' in result);
});

test('findAll fetches userTemplates filtered by userId', async () => {
  const svc = makeService();
  await svc.findAll('user-abc');
  assert.ok(svc._state.calls.findMany.some((c: any) => c?.where?.userId === 'user-abc'));
});

test('findAll fetches defaults filtered by isDefault or isSystem', async () => {
  const svc = makeService();
  await svc.findAll('user-1');
  assert.ok(svc._state.calls.findMany.some((c: any) => c?.where?.OR));
});

test('findAll orders userTemplates by createdAt desc', async () => {
  const svc = makeService();
  await svc.findAll('user-1');
  const userCall = svc._state.calls.findMany.find((c: any) => c?.where?.userId === 'user-1');
  assert.deepEqual(userCall?.orderBy, { createdAt: 'desc' });
});

// ─────────────────────────────────────────────────────────
// findOne
// ─────────────────────────────────────────────────────────

test('findOne returns template when user owns it', async () => {
  const svc = makeService({
    prisma: { botTemplate: { findFirst: async (args: any) => ({ id: 't1', name: 'My Template' }) } },
  });
  const result = await svc.findOne('t1', 'user-1');
  assert.equal(result.id, 't1');
});

test('findOne returns template when it is a system template', async () => {
  const svc = makeService({
    prisma: { botTemplate: { findFirst: async (args: any) => ({ id: 'sys1', name: 'System', isSystem: true }) } },
  });
  const result = await svc.findOne('sys1', 'user-1');
  assert.equal(result.isSystem, true);
});

test('findOne throws NotFoundException when template not found', async () => {
  const svc = makeService();
  await assertRejects(svc.findOne('nonexistent', 'user-1'), (err) => err instanceof NotFoundException);
});

// ─────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────

test('create calls strategyService.validateConfig before persisting', async () => {
  const svc = makeService();
  await svc.create({ name: 'My Template', strategy: 'rsi', params: { period: 7 } }, 'user-1');
  assert.equal(svc._state.calls.validateConfig.length, 1);
  assert.equal(svc._state.calls.validateConfig[0][0], 'rsi');
  assert.equal(svc._state.calls.validateConfig[0][1].period, 7);
});

test('create normalizes ma_crossover to sma_crossover', async () => {
  const svc = makeService();
  await svc.create({ name: 'MA Template', strategy: 'ma_crossover', params: { shortPeriod: 5, longPeriod: 20 } }, 'user-1');
  const call = svc._state.calls.create[0];
  assert.equal(call.data.strategy, 'sma_crossover');
});

test('create trims name and description', async () => {
  const svc = makeService();
  await svc.create({ name: '  My Template  ', strategy: 'rsi', params: { period: 14 }, description: '  Desc  ' }, 'user-1');
  const call = svc._state.calls.create[0];
  assert.equal(call.data.name, 'My Template');
  assert.equal(call.data.description, 'Desc');
});

test('create sets isDefault and isSystem to false', async () => {
  const svc = makeService();
  await svc.create({ name: 'Test', strategy: 'rsi', params: { period: 14 } }, 'user-1');
  const call = svc._state.calls.create[0];
  assert.equal(call.data.isDefault, false);
  assert.equal(call.data.isSystem, false);
});

test('create sets description to null when empty string', async () => {
  const svc = makeService();
  await svc.create({ name: 'Test', strategy: 'rsi', params: { period: 14 }, description: '' }, 'user-1');
  const call = svc._state.calls.create[0];
  assert.equal(call.data.description, null);
});

test('create passes normalized params to database', async () => {
  const svc = makeService();
  await svc.create({ name: 'Test', strategy: 'rsi', params: { period: 7, quantity: 0.05 } }, 'user-1');
  const call = svc._state.calls.create[0];
  assert.deepEqual(call.data.params, { period: 7, quantity: 0.05, oversold: 30, overbought: 70 });
});

// ─────────────────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────────────────

test('remove throws NotFoundException when template does not belong to user', async () => {
  const svc = makeService();
  await assertRejects(svc.remove('t1', 'user-1'), (err) => err instanceof NotFoundException);
});

test('remove deletes template only if user owns it', async () => {
  const svc = makeService({
    prisma: { botTemplate: { findFirst: async (args: any) => ({ id: args?.where?.id }) } },
  });
  await svc.remove('t1', 'user-1');
  const call = svc._state.calls.delete[0];
  assert.equal(call.where.id, 't1');
});

test('remove cannot delete system templates (userId mismatch)', async () => {
  const svc = makeService();
  await assertRejects(svc.remove('sys1', 'user-1'), (err) => err instanceof NotFoundException);
});

export {};
