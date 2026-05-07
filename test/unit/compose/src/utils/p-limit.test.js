'use strict';

const expect = require('chai').expect;

const pLimit = require('../../../../../lib/compose/utils/p-limit');

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('test/unit/src/utils/p-limit.test.js', () => {
  it('serializes tasks when concurrency is 1', async () => {
    const limit = pLimit(1);
    const events = [];
    let active = 0;
    let maxActive = 0;

    const runTask = async (name) => {
      events.push(`start:${name}`);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      await Promise.resolve();
      active -= 1;
      events.push(`end:${name}`);
      return name;
    };

    const [first, second] = await Promise.all([limit(runTask, 'first'), limit(runTask, 'second')]);

    expect([first, second]).to.deep.equal(['first', 'second']);
    expect(maxActive).to.equal(1);
    expect(events).to.deep.equal(['start:first', 'end:first', 'start:second', 'end:second']);
  });

  it('preserves upstream invalid concurrency behavior', () => {
    for (const value of [0, -1, 1.2, undefined, true, '2']) {
      expect(() => pLimit(value)).to.throw(
        TypeError,
        'Expected `concurrency` to be a number from 1 and up'
      );
    }
  });

  it('drains queued tasks after a rejection', async () => {
    const limit = pLimit(1);
    const started = [];

    const firstPromise = limit(async () => {
      started.push('first');
      await Promise.resolve();
      throw new Error('broken');
    });
    const secondPromise = limit(async () => {
      started.push('second');
      return 'second';
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(started).to.deep.equal(['first']);
    expect(limit.activeCount).to.equal(1);
    expect(limit.pendingCount).to.equal(1);

    try {
      await firstPromise;
      expect.fail('Expected the first task to reject');
    } catch (error) {
      expect(error.message).to.equal('broken');
    }

    await Promise.resolve();
    await Promise.resolve();

    expect(started).to.deep.equal(['first', 'second']);
    expect(await secondPromise).to.equal('second');
    expect(limit.activeCount).to.equal(0);
    expect(limit.pendingCount).to.equal(0);
  });

  it('supports Infinity concurrency', async () => {
    const limit = pLimit(Infinity);
    const release = createDeferred();
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 3 }, () =>
      limit(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await release.promise;
        active -= 1;
      })
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(limit.activeCount).to.equal(3);
    expect(limit.pendingCount).to.equal(0);
    expect(maxActive).to.equal(3);

    release.resolve();
    await Promise.all(tasks);
  });

  it('clearQueue drops pending work without affecting the running task', async () => {
    const limit = pLimit(1);
    const release = createDeferred();
    const started = [];

    const firstPromise = limit(async () => {
      started.push('first');
      await release.promise;
    });
    const secondPromise = limit(async () => {
      started.push('second');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(limit.activeCount).to.equal(1);
    expect(limit.pendingCount).to.equal(1);

    limit.clearQueue();

    expect(limit.activeCount).to.equal(1);
    expect(limit.pendingCount).to.equal(0);

    release.resolve();
    await firstPromise;
    await Promise.resolve();

    expect(started).to.deep.equal(['first']);

    let secondSettled = false;
    secondPromise.then(
      () => {
        secondSettled = true;
      },
      () => {
        secondSettled = true;
      }
    );
    await Promise.resolve();

    expect(secondSettled).to.equal(false);
  });
});
