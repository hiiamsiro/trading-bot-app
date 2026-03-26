const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');

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

test('AdminGuard denies when email is not in ADMIN_EMAILS', () => {
  const configService = new ConfigService({ ADMIN_EMAILS: 'admin@example.com' });
  const guard = new AdminGuard(configService);

  assert.throws(() => guard.canActivate(makeContext({ userId: 'u1', email: 'user@example.com' })), {
    name: ForbiddenException.name,
  });
});

test('AdminGuard allows when email is listed (case-insensitive, comma-separated)', () => {
  const configService = new ConfigService({
    ADMIN_EMAILS: ' admin@example.com,Admin2@Example.com ',
  });
  const guard = new AdminGuard(configService);

  const allowed = guard.canActivate(makeContext({ userId: 'u1', email: 'ADMIN2@example.com' }));
  assert.equal(allowed, true);
});

export {};
