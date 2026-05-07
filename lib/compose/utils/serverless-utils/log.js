'use strict';

const ensureString = require('type/string/ensure');
const memoizee = require('memoizee');
const logLevels = require('log/levels');
const uniGlobal = require('uni-global')('serverless/serverless/202110');
const { getterDescriptor } = require('../property-descriptors');
const getOutputReporter = require('./lib/log/get-output-reporter');
const getProgressReporter = require('./lib/log/get-progress-reporter');

const log = (() => {
  if (!uniGlobal.log) uniGlobal.log = require('log').get('serverless').notice;
  return uniGlobal.log;
})();

module.exports.log = log;

if (!log.verbose) {
  Object.defineProperties(log, {
    success: getterDescriptor(function () {
      return this.notice;
    }),
    skip: getterDescriptor(function () {
      return this.notice;
    }),
  });

  Object.defineProperties(log, {
    verbose: getterDescriptor(function () {
      return this.info;
    }),
  });
}

const defaultLogLevelIndex = logLevels.indexOf('notice');
Object.defineProperties(module.exports, {
  logLevelIndex: getterDescriptor(() => {
    return uniGlobal.logLevelIndex == null ? defaultLogLevelIndex : uniGlobal.logLevelIndex;
  }),
  isVerboseMode: getterDescriptor(() => module.exports.logLevelIndex > defaultLogLevelIndex),
  isInteractive: getterDescriptor(() => {
    return uniGlobal.logIsInteractive == null ? false : uniGlobal.logIsInteractive;
  }),
});

module.exports.writeText = getOutputReporter('serverless').get('text');

module.exports.progress = getProgressReporter('serverless');
module.exports.progress.clear = () => {};

module.exports.getPluginWriters = memoizee(
  (pluginName) => {
    pluginName = ensureString(pluginName, { name: 'pluginName' });
    const pluginLog = log.get('plugin').get(pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    pluginLog.pluginName = pluginName;
    return {
      log: pluginLog.notice,
      writeText: getOutputReporter(`serverless:plugin:${pluginName}`).get('text'),
      progress: getProgressReporter(`serverless:plugin:${pluginName}`),
    };
  },
  { primitive: true }
);

const style = {
  aside: (text, ...textTokens) => [text, ...textTokens],
  error: (text, ...textTokens) => [text, ...textTokens],
  link: (text, ...textTokens) => [text, ...textTokens],
  linkStrong: (text, ...textTokens) => [text, ...textTokens],
  noticeSymbol: (text, ...textTokens) => [text, ...textTokens],
  strong: (text, ...textTokens) => [text, ...textTokens],
  title: (text, ...textTokens) => [text, ...textTokens],
  warning: (text, ...textTokens) => [text, ...textTokens],
};

if (uniGlobal.logStyle) {
  module.exports.style = uniGlobal.logStyle;
  for (const key of Object.keys(style)) {
    if (!uniGlobal.logStyle[key]) uniGlobal.logStyle[key] = style[key];
  }
} else {
  module.exports.style = uniGlobal.logStyle = style;
}
