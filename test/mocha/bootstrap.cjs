'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const chai = require('chai');

chai.use(require('chai-as-promised').default);
chai.use(require('sinon-chai').default);

process.env.SLS_DEPRECATION_NOTIFICATION_MODE ??= 'error';
process.env.SLS_TELEMETRY_DISABLED = '1';
process.env.LOG_TIME ??= 'abs';

const workerHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serverless-test-'));
const originalHomedir = os.homedir;

os.homedir = () => workerHomeDir;

process.on('exit', () => {
  os.homedir = originalHomedir;
  try {
    fs.rmSync(workerHomeDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors at process exit
  }
});

global.__SERVERLESS_TEST_BOOTSTRAP__ = {
  workerHomeDir,
  originalHomedir,
};
