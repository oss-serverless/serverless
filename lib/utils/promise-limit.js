'use strict';

module.exports = (concurrency, callback) => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Expected concurrency to be a positive integer');
  }

  const queue = [];
  let activeCount = 0;

  const runNext = () => {
    if (activeCount >= concurrency) return;

    const next = queue.shift();
    if (!next) return;

    activeCount += 1;

    let result;
    try {
      result = callback.apply(next.thisArg, next.args);
    } catch (error) {
      activeCount -= 1;
      next.reject(error);
      runNext();
      return;
    }

    Promise.resolve(result)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  };

  return function limited(...args) {
    return new Promise((resolve, reject) => {
      queue.push({ thisArg: this, args, resolve, reject });
      runNext();
    });
  };
};
