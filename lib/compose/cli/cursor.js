'use strict';

const { onExit } = require('signal-exit');

let restoreRegistered = false;

const show = () => {
  if (process.stderr.isTTY) process.stderr.write('\x1B[?25h');
};

const hide = () => {
  if (!process.stderr.isTTY) return;
  if (!restoreRegistered) {
    restoreRegistered = true;
    onExit(show);
  }
  process.stderr.write('\x1B[?25l');
};

module.exports = { show, hide };
