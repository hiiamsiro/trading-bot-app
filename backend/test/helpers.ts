function mockFn(impl) {
  const calls: unknown[][] = [];
  const fn = (...args) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  return fn;
}

function mockAsyncFn(impl) {
  const calls: unknown[][] = [];
  const fn = async (...args) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  return fn;
}

function mockAsyncSequence(returns) {
  const calls: unknown[][] = [];
  let index = 0;
  const fn = async (...args) => {
    calls.push(args);
    const value = index < returns.length ? returns[index] : returns[returns.length - 1];
    index += 1;
    return typeof value === 'function' ? value(...args) : value;
  };
  fn.calls = calls;
  return fn;
}

module.exports = {
  mockFn,
  mockAsyncFn,
  mockAsyncSequence,
};

export {};
