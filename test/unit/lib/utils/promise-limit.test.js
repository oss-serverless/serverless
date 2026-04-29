'use strict';

const { expect } = require('chai');
const promiseLimit = require('../../../../lib/utils/promise-limit');

describe('test/unit/lib/utils/promise-limit.test.js', () => {
  it('runs no more than the configured number of tasks at once', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;

    const limited = promiseLimit(2, async (value) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeCount -= 1;
      return value;
    });

    const results = await Promise.all([1, 2, 3, 4].map((value) => limited(value)));

    expect(results).to.deep.equal([1, 2, 3, 4]);
    expect(maxActiveCount).to.equal(2);
  });

  it('forwards arguments and preserves this binding', async () => {
    const context = { offset: 3 };
    const limited = promiseLimit(1, function (left, right) {
      return this.offset + left + right;
    });

    expect(await limited.call(context, 4, 5)).to.equal(12);
  });

  it('starts available tasks synchronously', async () => {
    let hasStarted = false;
    const limited = promiseLimit(1, () => {
      hasStarted = true;
    });

    const promise = limited();

    expect(hasStarted).to.equal(true);
    await promise;
  });

  it('rejects when a limited task rejects', async () => {
    const error = new Error('task failed');
    const limited = promiseLimit(1, async () => {
      throw error;
    });

    await expect(limited()).to.be.rejectedWith(error);
  });

  it('rejects invalid concurrency values', () => {
    expect(() => promiseLimit(0, () => {})).to.throw(TypeError);
    expect(() => promiseLimit(1.5, () => {})).to.throw(TypeError);
  });
});
