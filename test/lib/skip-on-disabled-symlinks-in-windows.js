'use strict';

const skipWithNotice = require('./skip-with-notice');

module.exports = (error, context, afterCallback) => {
  if (error.code !== 'EPERM' || process.platform !== 'win32') return;
  skipWithNotice(context, 'Missing admin rights to create symlinks', afterCallback);
};
