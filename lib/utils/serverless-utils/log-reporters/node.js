'use strict';

const uniGlobal = require('uni-global')('serverless/serverless/202110');

if (uniGlobal.logLevelIndex != null) {
  // An edge case, of log reporter being setup second time for Node.js process
  // The only known scenario is `sls --version` being run with global v2 `serverless`
  // installation, which falls back to locally installed v2 `serverless` installation
  return;
}

if (process.env.SLS_LOG_LEVEL !== 'debug' && process.argv.includes('--verbose')) {
  process.env.SLS_LOG_LEVEL = 'info';
}

process.argv.some((flag, index) => {
  const namespace = (() => {
    if (flag === '--debug') return process.argv[index + 1];
    if (flag.startsWith('--debug=')) return flag.slice('--debug='.length);
    return null;
  })();
  if (!namespace) return false;
  if (namespace === '*') process.env.SLS_LOG_LEVEL = 'debug';
  else process.env.SLS_LOG_DEBUG = namespace;
  return true;
});

const logReporter = require('../lib/log-reporters/node/log-reporter');
const { emitter: outputEmitter } = require('../lib/log/get-output-reporter');
const joinTextTokens = require('../lib/log/join-text-tokens');
const logLevels = require('log/levels');

const logLevelIndex = logLevels.includes(process.env.SLS_LOG_LEVEL)
  ? logLevels.indexOf(process.env.SLS_LOG_LEVEL)
  : logLevels.indexOf('notice');

const isInteractive =
  (process.stdin.isTTY && process.stdout.isTTY && !process.env.CI) ||
  process.env.SLS_INTERACTIVE_SETUP_ENABLE;

// Apply style decorators
require('../lib/log-reporters/node/style');

// Event logs
logReporter({ logLevelIndex, debugNamespaces: process.env.SLS_LOG_DEBUG });
uniGlobal.logLevelIndex = logLevelIndex;

// Substantial output (not subject to filtering)
outputEmitter.on('write', ({ mode, textTokens }) => {
  if (mode === 'text') process.stdout.write(joinTextTokens(textTokens));
});

uniGlobal.logIsInteractive = isInteractive;
if (isInteractive) {
  require('../lib/log-reporters/node/progress-reporter')({ logLevelIndex });
}
