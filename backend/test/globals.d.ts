// Global types for Node.js test runner — declared once, shared across all test files.
// These are provided at runtime by Node's test runner; we just declare the types here.

import type * as TestModule from 'node:test';
import type * as AssertModule from 'node:assert/strict';

declare global {
  // Node.js test runner globals (available when running via `node --test` or `node test/all.test.ts`)
  const test: typeof TestModule.test;
  const describe: typeof TestModule.describe;
  const it: typeof TestModule.it;
  const before: typeof TestModule.before;
  const after: typeof TestModule.after;
  const beforeEach: typeof TestModule.beforeEach;
  const afterEach: typeof TestModule.afterEach;
  const mock: typeof TestModule.mock;
  const suite: typeof TestModule.suite;
  const suiteOnly: typeof TestModule.suite.only;
  const suiteSkip: typeof TestModule.suite.skip;
  const suiteTodo: typeof TestModule.suite.todo;
  const testOnly: typeof TestModule.test.only;
  const testSkip: typeof TestModule.test.skip;
  const testTodo: typeof TestModule.test.todo;

  // Node.js assert — available as a global in the test runner
  const assert: typeof AssertModule;
}

export {};
