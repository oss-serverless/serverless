'use strict';

const chalk = require('chalk');
const { runnerEmitter } = require('./setup/patch');

const skippedWithNotice = [];

module.exports = (context, reason, afterCallback) => {
  if (!context || typeof context.skip !== 'function') {
    throw new TypeError('Passed context is not a valid mocha suite');
  }
  if (process.env.CI) return; // Do not tolerate skips in CI environment

  skippedWithNotice.push({ context, reason });
  process.stdout.write(chalk.yellow(`\n Skipped due to: ${chalk.red(reason)}\n\n`));

  if (afterCallback) {
    try {
      // Ensure teardown is called
      // (Mocha fails to do it -> https://github.com/mochajs/mocha/issues/3740)
      afterCallback();
    } catch (error) {
      process.stdout.write(chalk.error(`after callback crashed with: ${error.stack}\n`));
    }
  }
  context.skip();
};

runnerEmitter.on('runner', (runner) =>
  runner.on('end', () => {
    // Output eventual skip notices
    if (!skippedWithNotice.length) return;

    const resolveTestName = (test) => {
      const names = [test.title];
      let parent = test.parent;
      while (parent) {
        if (parent.title) names.push(parent.title);
        parent = parent.parent;
      }
      return `${chalk.cyan(names.reverse().join(': '))} (in: ${chalk.grey(
        test.file.slice(process.cwd().length + 1)
      )})`;
    };

    process.stdout.write(
      ' Notice: Some tests were skipped due to following environment issues:' +
        `\n\n - ${skippedWithNotice
          .map((meta) => `${resolveTestName(meta.context.test)}\n\n   ${chalk.red(meta.reason)}\n`)
          .join('\n - ')}\n\n`
    );
  })
);
