// Dedicated to join text tokens as passed to `writeText` and `progress.update`

'use strict';

const ensureString = require('type/string/ensure');
const _ = require('lodash');

module.exports = (textTokens) =>
  `${_.flattenDeep(textTokens)
    .map((textToken) => ensureString(textToken, { isOptional: true, name: 'textToken' }) || '')
    .join('\n')}\n`;
