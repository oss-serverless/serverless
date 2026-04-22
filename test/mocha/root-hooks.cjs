'use strict';

const sinon = require('sinon');
const runtimeSandbox = require('./runtime-sandbox.cjs');
const clearCaches = require('./clear-caches.cjs');

exports.mochaHooks = {
  beforeAll() {
    runtimeSandbox.prepareSuite();
  },

  beforeEach() {
    runtimeSandbox.captureTestState();
    runtimeSandbox.restoreTestState();
  },

  afterEach() {
    sinon.restore();
    clearCaches();
    runtimeSandbox.restoreTestState();
  },

  afterAll() {
    clearCaches();
    runtimeSandbox.resetProcessState();
  },
};
