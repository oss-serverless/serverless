// Customize inquirer style

'use strict';

const { createRequire } = require('module');
const identity = require('ext/function/identity');
const requireUncached = require('ncjsm/require-uncached');
const chalk = require('chalk');
const { style } = require('../log');

const inquirersChalkPath = createRequire(require.resolve('inquirer')).resolve('chalk');

module.exports = requireUncached(inquirersChalkPath, () => {
  // Ensure distinct chalk instance for inquirer and hack it with altered styles
  Object.defineProperties(require(inquirersChalkPath), {
    cyan: {
      get() {
        return chalk.bold;
      },
    },
    bold: {
      get() {
        return identity;
      },
    },
  });

  const BasePrompt = require('inquirer/lib/prompts/base');
  const originalGetQuestion = BasePrompt.prototype.getQuestion;
  BasePrompt.prototype.getQuestion = function () {
    // Here we want to override the default prefix which is equal to `chalk.green('?')`
    this.opt.prefix = style.strong('?');
    return originalGetQuestion.call(this);
  };

  return require('inquirer');
});
