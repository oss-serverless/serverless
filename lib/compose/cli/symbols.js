'use strict';

const isUnicodeSupported = require('./is-unicode-supported');

const main = {
  success: '✔',
  error: '✖',
  separator: '›',
};

const fallback = {
  success: '√',
  error: '×',
  separator: '>',
};

module.exports = isUnicodeSupported() ? main : fallback;
