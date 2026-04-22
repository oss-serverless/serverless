'use strict';

module.exports = {
  require: ['./test/mocha/bootstrap.cjs', './test/mocha/root-hooks.cjs'],
  timeout: 60000,
  parallel: false,
  'node-option': ['unhandled-rejections=strict'],
};
