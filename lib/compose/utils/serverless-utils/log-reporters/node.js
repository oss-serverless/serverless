'use strict';

module.exports = ({
  argv = process.argv.slice(2),
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) => {
  const uniGlobal = require('uni-global')('serverless/serverless/202110');

  if (uniGlobal.logLevelIndex != null) {
    return {
      logLevelIndex: uniGlobal.logLevelIndex,
      isInteractive: uniGlobal.logIsInteractive,
    };
  }

  if (env.SLS_LOG_LEVEL !== 'debug' && argv.includes('--verbose')) {
    env.SLS_LOG_LEVEL = 'info';
  }

  argv.some((flag, index) => {
    const namespace = (() => {
      if (flag === '--debug') return argv[index + 1];
      if (flag.startsWith('--debug=')) return flag.slice('--debug='.length);
      return null;
    })();
    if (!namespace) return false;
    if (namespace === '*') env.SLS_LOG_LEVEL = 'debug';
    else env.SLS_LOG_DEBUG = namespace;
    return true;
  });

  const logReporter = require('../lib/log-reporters/node/log-reporter');
  const { emitter: outputEmitter } = require('../lib/log/get-output-reporter');
  const joinTextTokens = require('../lib/log/join-text-tokens');
  const logLevels = require('log/levels');

  const logLevelIndex = logLevels.includes(env.SLS_LOG_LEVEL)
    ? logLevels.indexOf(env.SLS_LOG_LEVEL)
    : logLevels.indexOf('notice');

  const isInteractive =
    (stdin.isTTY && stdout.isTTY && !env.CI) || env.SLS_INTERACTIVE_SETUP_ENABLE;

  require('../lib/log-reporters/node/style');

  logReporter({ logLevelIndex, debugNamespaces: env.SLS_LOG_DEBUG });
  uniGlobal.logLevelIndex = logLevelIndex;

  outputEmitter.on('write', ({ mode, textTokens }) => {
    if (mode === 'text') stdout.write(joinTextTokens(textTokens));
  });

  uniGlobal.logIsInteractive = isInteractive;
  if (isInteractive) {
    require('../lib/log-reporters/node/progress-reporter')({ logLevelIndex });
  }

  return { logLevelIndex, isInteractive };
};
