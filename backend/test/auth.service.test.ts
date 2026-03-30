import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';

const { AuthService } = require('../src/auth/auth.service.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

test('AuthService.register returns user profile + JWT token', async () => {
  const usersService = {
    create: mockAsyncFn(async (dto: any) => ({
      id: 'user-1',
      email: dto.email,
      name: dto.name,
      createdAt: new Date(),
    })),
  };

  const jwtService = {
    sign: mockFn(() => 'jwt-token'),
  };

  const authService = new AuthService(usersService, jwtService);

  const result = await authService.register({
    email: 'alice@example.com',
    password: 'Password123!',
    name: 'Alice',
  });

  assert.equal(result.token, 'jwt-token');
  assert.deepEqual(result.user, {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    isAdmin: undefined,
  });
  assert.equal(usersService.create.calls.length, 1);
  assert.equal(jwtService.sign.calls.length, 1);
  assert.deepEqual(jwtService.sign.calls[0][0], { sub: 'user-1', email: 'alice@example.com', isAdmin: undefined });
});

test('AuthService.login throws UnauthorizedException on invalid credentials', async () => {
  const usersService = {
    validateUser: mockAsyncFn(async () => null),
  };
  const jwtService = { sign: mockFn(() => 'ignored') };
  const authService = new AuthService(usersService, jwtService);

  await assert.rejects(
    () => authService.login({ email: 'alice@example.com', password: 'wrong' }),
    (err: unknown) => {
      assert.ok(err instanceof UnauthorizedException);
      assert.equal((err as Error).message, 'Invalid credentials');
      return true;
    },
  );

  assert.equal(usersService.validateUser.calls.length, 1);
  assert.equal(jwtService.sign.calls.length, 0);
});

test('AuthService.login returns profile + JWT token on success', async () => {
  const usersService = {
    validateUser: mockAsyncFn(async () => ({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
    })),
  };
  const jwtService = { sign: mockFn(() => 'jwt-token') };
  const authService = new AuthService(usersService, jwtService);

  const result = await authService.login({ email: 'alice@example.com', password: 'Password123!' });

  assert.equal(result.token, 'jwt-token');
  assert.deepEqual(result.user, {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    isAdmin: undefined,
  });
  assert.equal(jwtService.sign.calls.length, 1);
});

export {};
