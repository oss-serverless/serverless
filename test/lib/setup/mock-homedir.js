'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { emptyDirSync } = require('fs-extra');
const processTmpDir = require('../process-tmp-dir');
const { runnerEmitter } = require('./patch');
const rmTmpDirIgnorableErrorCodes = require('../lib/private/rm-tmp-dir-ignorable-error-codes');

const createTmpHomedir = () => {
  const tmpHomeDir = path.join(processTmpDir, crypto.randomBytes(3).toString('hex'));
  try {
    fs.mkdirSync(tmpHomeDir);
  } catch (error) {
    if (error.code === 'EEXIST') return createTmpHomedir();
    throw error;
  }
  return tmpHomeDir;
};

const tmpHomeDir = createTmpHomedir();

os.homedir = () => tmpHomeDir;
if (process.env.USERPROFILE) process.env.USERPROFILE = tmpHomeDir;
if (process.env.HOME) process.env.HOME = tmpHomeDir;

runnerEmitter.on('runner', (runner) => {
  runner.on('suite end', (suite) => {
    if (!suite.parent || !suite.parent.root) return;

    // Cleanup temp homedir after each top level test run
    try {
      emptyDirSync(tmpHomeDir);
    } catch (error) {
      if (rmTmpDirIgnorableErrorCodes.has(error.code)) return;
      // If some of the tests timed out, error could be caused by ongoing operation
      // which still writse to temp dir, ignore it.
      if (suite.tests.some((test) => test.timedOut)) return;
      process.nextTick(() => {
        // Crash in next tick, as otherwise Mocha goes bonkers
        throw error;
      });
    }
  });
});
