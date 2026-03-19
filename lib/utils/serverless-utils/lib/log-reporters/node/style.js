'use strict';

const d = require('d');
const autoBind = require('d/auto-bind');
const identity = require('ext/function/identity');
const chalk = require('chalk');
const { level: colorSupportLevel } = require('supports-color');
const { style, log } = require('../../../log');
const joinTextTokens = require('../../log/join-text-tokens');

const cliStyle = {
  aside: colorSupportLevel > 2 ? chalk.rgb(140, 141, 145) : chalk.gray,
  error: colorSupportLevel > 2 ? chalk.rgb(253, 87, 80) : chalk.redBright,
  link: identity,
  linkStrong: chalk.underline,
  noticeSymbol: colorSupportLevel > 2 ? chalk.rgb(253, 87, 80) : chalk.redBright,
  strong: colorSupportLevel > 2 ? chalk.rgb(253, 87, 80) : chalk.redBright,
  title: chalk.underline,
  warning: chalk.rgb(255, 165, 0),
};

for (const key of Object.keys(style)) {
  const decorator = cliStyle[key];
  if (!decorator) continue;
  module.exports[key] = style[key] = (text, ...textTokens) =>
    decorator(joinTextTokens([text, ...textTokens]).slice(0, -1));
}

// Notice level message common message decorators
Object.defineProperties(
  log,
  autoBind({
    success: d(function (text, ...messageTokens) {
      return this.notice(`${cliStyle.noticeSymbol('✔')} ${text}`, ...messageTokens);
    }),
  })
);
