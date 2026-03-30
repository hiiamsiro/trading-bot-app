import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { ForbiddenException } = require('@nestjs/common');

const { AdminGuard } = require('../src/auth/guards/admin.guard.ts');

function makeContext(user) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return { user };
        },
      };
    },
  };
}

test('AdminGuard allows when user.isAdmin is true', () => {
  const guard = new AdminGuard();
  const allowed = guard.canActivate(makeContext({ userId: 'u1', email: 'x@y.com', isAdmin: true }));
  assert.equal(allowed, true);
});

test('AdminGuard denies when user.isAdmin is false', () => {
  const guard = new AdminGuard();
  assert.throws(() => guard.canActivate(makeContext({ userId: 'u1', email: 'x@y.com', isAdmin: false })), {
    name: ForbiddenException.name,
  });
});

test('AdminGuard denies when user.isAdmin is undefined', () => {
  const guard = new AdminGuard();
  assert.throws(() => guard.canActivate(makeContext({ userId: 'u1', email: 'x@y.com' })), {
    name: ForbiddenException.name,
  });
});

test('AdminGuard denies when no user on request', () => {
  const guard = new AdminGuard();
  assert.throws(() => guard.canActivate(makeContext(undefined)), {
    name: ForbiddenException.name,
  });
});

export {};
