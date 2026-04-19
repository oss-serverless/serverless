'use strict';

const ensureString = require('type/string/ensure');
const d = require('d');
const memoizee = require('memoizee');
const logLevels = require('log/levels');
const uniGlobal = require('uni-global')('serverless/serverless/202110');
const getOutputReporter = require('./lib/log/get-output-reporter');
const getProgressReporter = require('./lib/log/get-progress-reporter');

const log = (() => {
  if (!uniGlobal.log) uniGlobal.log = require('log').get('serverless').notice;
  return uniGlobal.log;
})();

module.exports.log = log;

if (!log.verbose) {
  // Intialize log instance (we do not share one setup over `uniGlobal`)

  // Notice level message common message decorators
  Object.defineProperties(log, {
    success: d.gs(function () {
      return this.notice;
    }),
    skip: d.gs(function () {
      return this.notice;
    }),
  });

  Object.defineProperties(log, {
    verbose: d.gs(function () {
      return this.info;
    }),
  });
}

const defaultLogLevelIndex = logLevels.indexOf('notice');
Object.defineProperties(module.exports, {
  logLevelIndex: d.gs(() => {
    return uniGlobal.logLevelIndex == null ? defaultLogLevelIndex : uniGlobal.logLevelIndex;
  }),
  isVerboseMode: d.gs(() => module.exports.logLevelIndex > defaultLogLevelIndex),
  isInteractive: d.gs(() => {
    return uniGlobal.logIsInteractive == null ? false : uniGlobal.logIsInteractive;
  }),
});

module.exports.writeText = getOutputReporter('serverless').get('text');

module.exports.progress = getProgressReporter('serverless');
// Method intended to clear and close indefinitely any progress writing
// Overriden with intended logic in reporter
module.exports.progress.clear = () => {};

module.exports.getPluginWriters = memoizee(
  (pluginName) => {
    pluginName = ensureString(pluginName, { name: 'pluginName' });
    // "log" namespace can contain only [a-z0-9-] chars, therefore we normalize plugin name to
    // avoid exceptions
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
