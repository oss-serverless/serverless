'use strict';

module.exports = (concurrency) => {
  if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
    throw new TypeError('Expected `concurrency` to be a number from 1 and up');
  }

  let activeCount = 0;
  let queueHead = null;
  let queueTail = null;
  let queueSize = 0;

  const enqueueTask = (task) => {
    const node = { task, next: null };

    if (queueTail) {
      queueTail.next = node;
    } else {
      queueHead = node;
    }

    queueTail = node;
    queueSize += 1;
  };

  const dequeueTask = () => {
    if (!queueHead) {
      return undefined;
    }

    const task = queueHead.task;
    queueHead = queueHead.next;
    if (!queueHead) {
      queueTail = null;
    }
    queueSize -= 1;
    return task;
  };

  const clearQueue = () => {
    queueHead = null;
    queueTail = null;
    queueSize = 0;
  };

  const next = () => {
    activeCount -= 1;

    if (queueSize > 0) {
      dequeueTask()();
    }
  };

  const run = async (fn, resolve, args) => {
    activeCount += 1;

    const result = Promise.resolve().then(() => fn(...args));

    resolve(result);

    try {
      await result;
    } catch {
      // The caller observes rejections through the resolved task promise.
    } finally {
      next();
    }
  };

  const enqueue = (fn, resolve, args) => {
    enqueueTask(run.bind(null, fn, resolve, args));

    Promise.resolve().then(() => {
      if (activeCount < concurrency && queueSize > 0) {
        dequeueTask()();
      }
    });
  };

  const limit = (fn, ...args) =>
    new Promise((resolve) => {
      enqueue(fn, resolve, args);
    });

  Object.defineProperties(limit, {
    activeCount: {
      get: () => activeCount,
    },
    pendingCount: {
      get: () => queueSize,
    },
    clearQueue: {
      value: clearQueue,
    },
  });

  return limit;
};
