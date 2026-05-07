'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire');

describe('test/unit/src/cli/colors.test.js', () => {
  it('exposes stream-specific CLI palettes', () => {
    const colors = proxyquire.noCallThru().load('../../../../../lib/compose/cli/colors', {
      '../utils/colors': {
        stdoutColors: {
          reset: (value) => `stdout-reset(${value})`,
          gray: (value) => `stdout-gray(${value})`,
          brandRed: (value) => `stdout-red(${value})`,
          warning: (value) => `stdout-warning(${value})`,
          white: (value) => `stdout-white(${value})`,
        },
        stderrColors: {
          reset: (value) => `stderr-reset(${value})`,
          gray: (value) => `stderr-gray(${value})`,
          brandRed: (value) => `stderr-red(${value})`,
          warning: (value) => `stderr-warning(${value})`,
          white: (value) => `stderr-white(${value})`,
        },
      },
    });

    expect(colors.foreground('x')).to.equal('stdout-reset(x)');
    expect(colors.gray('x')).to.equal('stdout-gray(x)');
    expect(colors.red('x')).to.equal('stdout-red(x)');
    expect(colors.warning('x')).to.equal('stdout-warning(x)');
    expect(colors.white('x')).to.equal('stdout-white(x)');
    expect(colors.stdoutCliColors.red('x')).to.equal('stdout-red(x)');
    expect(colors.stderrCliColors.red('x')).to.equal('stderr-red(x)');
    expect(colors.stderrCliColors.foreground('x')).to.equal('stderr-reset(x)');
  });
});
