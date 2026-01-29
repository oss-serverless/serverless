'use strict';

if (!process.env.LOG_TIME) process.env.LOG_TIME = 'abs';

const log = require('log').get('mocha');
const initializeLogWriter = require('log-node');
const { runnerEmitter } = require('./patch');

const logWriter = initializeLogWriter();

const logSuiteTitle = (suite) => {
  let message = '%s';
  const args = [suite.title];
  while (suite.parent) {
    suite = suite.parent;
    if (suite.title) {
      message = `%s > ${message}`;
      args.unshift(suite.title);
    }
  }
  log.debug(message, ...args);
};

runnerEmitter.on('runner', (runner) => {
  runner.on('suite', logSuiteTitle);
  runner.on('test', logSuiteTitle);
});

if (process.env.LOG_LEVEL || process.env.LOG_DEBUG || process.env.DEBUG) return;

// Flush all gathered logs (down to DEBUG level) on test failure

const logEmitter = require('log/lib/emitter');

const logsBuffer = [];
const flushLogs = () => {
  // Write, only if there are some non-mocha log events
  if (logsBuffer.some((event) => event.logger.namespace !== 'mocha')) {
    log.notice('flushing previously gathered logs...');
    logsBuffer.pop(); // Drop above log from logsBuffer
    logsBuffer.forEach((event) => {
      if (!event.message) logWriter.resolveMessage(event);
      logWriter.writeMessage(event);
    });
  }
  logsBuffer.length = 0; // Empty array
};

logEmitter.on('log', (event) => {
  logsBuffer.push(event);
  if (!event.message) logWriter.resolveMessageTokens(event);
});
runnerEmitter.on('runner', (runner) => {
  runner.on('suite end', (suite) => {
    if (!suite.parent || !suite.parent.root) return;

    logsBuffer.length = 0; // Empty array
  });
  runner.on('fail', (ignore, error) => {
    log.error('test fail %s', error && error.stack);
    logsBuffer.pop(); // Drop above log from logsBuffer
    flushLogs();
  });
});

module.exports.flushLogs = flushLogs;
