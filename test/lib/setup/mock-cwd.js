'use strict';

const os = require('os');
const { runnerEmitter } = require('./patch');

const resetCwd = () => {
  if (process.cwd() !== os.homedir()) process.chdir(os.homedir());
};

runnerEmitter.on('runner', (runner) => {
  resetCwd();
  runner.on('suite end', (suite) => {
    if (!suite.parent || !suite.parent.root) return; // Apply just on top level suites
    resetCwd();
  });
});
