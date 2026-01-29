'use strict';

// Unhandled rejections are not exposed in Mocha, enforce it
// https://github.com/mochajs/mocha/issues/2640
process.on('unhandledRejection', (err) => {
  // Write to stderr
  // (Mocha reports error to stdout and if we're muting it for test purposes it'll end silent)
  process.stderr.write(`Unhandled rejection: ${err && err.stack}\n`);
  throw err;
});

// By default report deprecations as errors
process.env.SLS_DEPRECATION_NOTIFICATION_MODE = 'error';

// Ensure no telemetry reporting in tests
process.env.SLS_TELEMETRY_DISABLED = '1';

const path = require('path');
const EventEmitter = require('events');

const runnerEmitter = new EventEmitter();

const isObject = require('type/object/is');
const resolveSync = require('ncjsm/resolve/sync');

// Ensure to resolve mocha from tested package context
const mochaBinPath = path.dirname(require.main.filename);
const Mocha = require(resolveSync(mochaBinPath, 'mocha/lib/mocha').realPath);
const { serialize } = require(resolveSync(mochaBinPath, 'mocha/lib/nodejs/serializer').realPath);

const removeCyclicReferences = (object, parentObjects = new Set()) => {
  const entries = Array.isArray(object) ? object.entries() : Object.entries(object);
  parentObjects = new Set([...parentObjects, object]);
  for (const [key, value] of entries) {
    if (!isObject(value)) continue;
    if (parentObjects.has(value)) delete object[key];
    else removeCyclicReferences(value, parentObjects);
  }
};

const mochaRun = Mocha.prototype.run;
Mocha.prototype.run = function (fn, ...args) {
  const runner = mochaRun.call(
    this,
    (result) => {
      // Workaround https://github.com/mochajs/mocha/issues/4552
      const serialized = serialize(result);
      const stringifiedResult = (() => {
        try {
          return JSON.stringify(serialized);
        } catch (error) {
          removeCyclicReferences(serialized);
          return JSON.stringify(serialized);
        }
      })();
      return fn.call(this, JSON.parse(stringifiedResult));
    },
    ...args
  );
  if (runner.constructor.name === 'Runner') runnerEmitter.emit('runner', runner);
  // Ensure faster tests propagation
  // It's to expose errors otherwise hidden by race conditions
  // Reported to Mocha with: https://github.com/mochajs/mocha/issues/3920
  runner.constructor.immediately = process.nextTick;
  return runner;
};

module.exports = { runnerEmitter };
