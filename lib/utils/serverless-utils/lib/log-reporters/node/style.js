'use strict';

const d = require('d');
const autoBind = require('d/auto-bind');
const identity = require('ext/function/identity');
const { stdoutColors } = require('../../../../colors');
const { style, log } = require('../../../log');
const joinTextTokens = require('../../log/join-text-tokens');

const cliStyle = {
  aside: stdoutColors.gray,
  error: stdoutColors.brandRed,
  link: identity,
  linkStrong: stdoutColors.underline,
  noticeSymbol: stdoutColors.brandRed,
  strong: stdoutColors.brandRed,
  title: stdoutColors.underline,
  warning: stdoutColors.warning,
};

for (const key of Object.keys(style)) {
  const decorator = cliStyle[key];
  if (!decorator) {
    continue;
  }
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
