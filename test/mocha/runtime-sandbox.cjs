'use strict';

const fs = require('node:fs');

const bootstrapState = global.__SERVERLESS_TEST_BOOTSTRAP__;
const originalCwd = process.cwd();
const originalEnv = Object.assign(Object.create(null), process.env);
const originalArgv = process.argv.slice();
const originalServerlessCommandStartTime = EvalError.$serverlessCommandStartTime;

const restoreEnv = (targetEnv, sourceEnv) => {
  for (const key of Object.keys(targetEnv)) {
    if (!(key in sourceEnv)) delete targetEnv[key];
  }

  for (const [key, value] of Object.entries(sourceEnv)) {
    targetEnv[key] = value;
  }
};

class RuntimeSandbox {
  constructor() {
    this.baseEnv = null;
    this.testEnv = null;
    this.testArgv = null;
    this.testCwd = null;
    this.testServerlessCommandStartTime = undefined;
  }

  prepareSuite() {
    process.chdir(originalCwd);
    fs.rmSync(bootstrapState.workerHomeDir, { recursive: true, force: true });
    fs.mkdirSync(bootstrapState.workerHomeDir, { recursive: true });

    this.baseEnv = Object.assign(Object.create(null), originalEnv, {
      HOME: bootstrapState.workerHomeDir,
      USERPROFILE: bootstrapState.workerHomeDir,
    });
    this.testEnv = null;
    this.testArgv = null;
    this.testCwd = null;
    this.testServerlessCommandStartTime = undefined;

    this.restoreTestState();
  }

  captureTestState() {
    this.testEnv = Object.assign(Object.create(null), process.env);
    this.testArgv = process.argv.slice();
    this.testCwd = process.cwd();
    this.testServerlessCommandStartTime = EvalError.$serverlessCommandStartTime;
  }

  restoreTestState() {
    const envToRestore = this.testEnv || this.baseEnv;

    restoreEnv(process.env, envToRestore);
    process.argv = (this.testArgv || originalArgv).slice();
    const commandStartTime =
      this.testEnv != null ? this.testServerlessCommandStartTime : originalServerlessCommandStartTime;

    if (commandStartTime === undefined) {
      delete EvalError.$serverlessCommandStartTime;
    } else {
      EvalError.$serverlessCommandStartTime = commandStartTime;
    }
    process.chdir(this.testCwd || bootstrapState.workerHomeDir);
  }

  resetProcessState() {
    restoreEnv(process.env, originalEnv);
    process.argv = originalArgv.slice();
    if (originalServerlessCommandStartTime === undefined) {
      delete EvalError.$serverlessCommandStartTime;
    } else {
      EvalError.$serverlessCommandStartTime = originalServerlessCommandStartTime;
    }
    process.chdir(originalCwd);
  }
}

module.exports = new RuntimeSandbox();
