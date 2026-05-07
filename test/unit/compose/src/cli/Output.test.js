'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { PassThrough } = require('stream');
const Output = require('../../../../../lib/compose/cli/Output');
const colors = require('../../../../../lib/compose/cli/colors');
const readStream = require('../../read-stream');

const setProperty = (object, property, value) => {
  Object.defineProperty(object, property, {
    configurable: true,
    writable: true,
    value,
  });
};

const restoreProperty = (object, property, descriptor) => {
  if (descriptor) {
    Object.defineProperty(object, property, descriptor);
  } else {
    delete object[property];
  }
};

describe('test/unit/lib/cli/Output.test.js', () => {
  /** @type {Output} */
  let output;
  beforeEach(() => {
    output = new Output(false, true);
  });

  it('writes text', async () => {
    output.writeText('Message');

    expect(await readStream(output.stdout)).to.equal('Message\n');
    expect(await readStream(output.stderr)).to.equal('');
    expect(await readStream(output.logsFileStream)).to.equal('Message\n');
  });

  it('defaults helper palettes to stdout colors', () => {
    expect(output.generatePrefix(['service'])).to.equal(colors.gray('service › '));
    expect(output.namespaceLogMessage('Message', ['service'])).to.equal(
      `${colors.gray('service › ')}Message`
    );
  });

  it('uses stream-specific palettes for stdout and stderr output', async () => {
    const OutputWithStubbedColors = proxyquire
      .noCallThru()
      .load('../../../../../lib/compose/cli/Output', {
        './colors': {
          stdoutCliColors: {
            gray: (value) => `stdout-gray(${value})`,
          },
          stderrCliColors: {
            gray: (value) => `stderr-gray(${value})`,
            red: (value) => `stderr-red(${value})`,
          },
        },
      });
    const localOutput = new OutputWithStubbedColors(true, true);

    localOutput.writeText('Message', ['service']);
    localOutput.log('Problem', ['service']);
    localOutput.verbose('Debug', ['service']);
    localOutput.error('Boom', ['service']);

    expect(await readStream(localOutput.stdout)).to.equal('stdout-gray(service › )Message\n');
    expect(await readStream(localOutput.stderr)).to.equal(
      [
        'stderr-gray(service › )Problem',
        'stderr-gray(service › )stderr-gray(Debug)',
        'stderr-gray(service › )stderr-red(Error:) Boom',
        '',
      ].join('\n')
    );
  });

  it('can namespace text', async () => {
    output.writeText('Message with\nmultiple lines', ['foo', 'bar']);

    expect(await readStream(output.stdout)).to.equal(
      `${colors.gray('foo › bar › ')}Message with\n` +
        // We check that the namespace is applied to all lines
        `${colors.gray('foo › bar › ')}multiple lines\n`
    );
    expect(await readStream(output.stderr)).to.equal('');
    expect(await readStream(output.logsFileStream)).to.equal(
      'foo › bar › Message with\nfoo › bar › multiple lines\n'
    );
  });

  it('strips colors when logging into the log file', async () => {
    output.writeText(colors.gray('Message'));

    // Logged with colors on stdout
    expect(await readStream(output.stdout)).to.equal(`${colors.gray('Message')}\n`);
    expect(await readStream(output.stderr)).to.equal('');
    // But written without colors into the log file
    expect(await readStream(output.logsFileStream)).to.equal('Message\n');
  });

  it('can hold verbose logs', async () => {
    output.verbose('Message');

    expect(await readStream(output.stdout)).to.equal('');
    // Verbose logs are NOT written to stderr
    expect(await readStream(output.stderr)).to.equal('');
    // But they are written to the log file
    expect(await readStream(output.logsFileStream)).to.equal('Message\n');
  });

  it('can write verbose logs', async () => {
    output = new Output(true, true);

    output.verbose('Message', ['foo']);

    expect(await readStream(output.stdout)).to.equal('');
    // Verbose logs are written (with colors) to stderr
    expect(await readStream(output.stderr)).to.equal(
      `${colors.gray('foo › ')}${colors.gray('Message')}\n`
    );
    // And (without colors) to the log file
    expect(await readStream(output.logsFileStream)).to.equal('foo › Message\n');
  });

  it('can switch to verbose logs at runtime', async () => {
    output.verbose('Message 1');
    output.enableVerbose();
    output.verbose('Message 2');

    expect(await readStream(output.stdout)).to.equal('');
    expect(await readStream(output.stderr)).to.equal(
      `${colors.gray('Message 1')}\n${colors.gray('Message 2')}\n`
    );
    expect(await readStream(output.logsFileStream)).to.equal('Message 1\nMessage 2\n');
  });

  it('logs errors', async () => {
    output.error('A text error');
    output.error(new Error('An error'));

    expect(await readStream(output.stdout)).to.equal('');
    expect(await readStream(output.stderr)).to.equal(
      `${colors.red('Error:')} A text error\n${colors.red('Error:')} An error\n`
    );
    expect(await readStream(output.logsFileStream)).to.equal(
      'Error: A text error\nError: An error\n'
    );
  });

  it('logs errors with stack traces in verbose', async () => {
    output = new Output(true, true);

    output.error(new TypeError('An error'));

    expect(await readStream(output.stdout)).to.equal('');
    expect(await readStream(output.stderr)).to.contain(
      `${colors.red('Error:')} TypeError: An error\n    at Context.<anonymous>`
    );
    expect(await readStream(output.logsFileStream)).to.contain(
      'Error: TypeError: An error\n    at Context.<anonymous>'
    );
  });

  describe('interactivity detection', () => {
    let originalStdinIsTTYDescriptor;
    let originalStdoutIsTTYDescriptor;
    let originalCI;
    let hadCI;
    let openLogsFileStub;

    beforeEach(() => {
      originalStdinIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
      originalStdoutIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
      hadCI = Object.prototype.hasOwnProperty.call(process.env, 'CI');
      originalCI = process.env.CI;
      openLogsFileStub = sinon.stub(Output.prototype, 'openLogsFile').returns(new PassThrough());
    });

    afterEach(() => {
      openLogsFileStub.restore();
      restoreProperty(process.stdin, 'isTTY', originalStdinIsTTYDescriptor);
      restoreProperty(process.stdout, 'isTTY', originalStdoutIsTTYDescriptor);
      if (hadCI) {
        process.env.CI = originalCI;
      } else {
        delete process.env.CI;
      }
    });

    const createOutput = ({ stdinIsTTY, stdoutIsTTY, ci } = {}) => {
      setProperty(process.stdin, 'isTTY', stdinIsTTY);
      setProperty(process.stdout, 'isTTY', stdoutIsTTY);
      if (ci === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = ci;
      }

      return new Output(false);
    };

    it('enables interactive streams when stdin and stdout are TTY outside CI', () => {
      const localOutput = createOutput({ stdinIsTTY: true, stdoutIsTTY: true });

      expect(localOutput.interactiveStdout).to.equal(process.stdout);
      expect(localOutput.interactiveStderr).to.equal(process.stderr);
      expect(localOutput.interactiveStdin).to.equal(process.stdin);
      expect(localOutput.verboseMode).to.equal(false);
    });

    it('disables interactivity when stdin is not TTY', () => {
      const localOutput = createOutput({ stdinIsTTY: false, stdoutIsTTY: true });

      expect(localOutput.interactiveStdout).to.equal(undefined);
      expect(localOutput.interactiveStderr).to.equal(undefined);
      expect(localOutput.interactiveStdin).to.equal(undefined);
      expect(localOutput.verboseMode).to.equal(true);
    });

    it('disables interactivity when stdout is not TTY', () => {
      const localOutput = createOutput({ stdinIsTTY: true, stdoutIsTTY: false });

      expect(localOutput.interactiveStdout).to.equal(undefined);
      expect(localOutput.interactiveStderr).to.equal(undefined);
      expect(localOutput.interactiveStdin).to.equal(undefined);
      expect(localOutput.verboseMode).to.equal(true);
    });

    it('disables interactivity when CI is truthy', () => {
      const localOutput = createOutput({ stdinIsTTY: true, stdoutIsTTY: true, ci: '1' });

      expect(localOutput.interactiveStdout).to.equal(undefined);
      expect(localOutput.interactiveStderr).to.equal(undefined);
      expect(localOutput.interactiveStdin).to.equal(undefined);
      expect(localOutput.verboseMode).to.equal(true);
    });

    it('matches Serverless by allowing interactivity when CI is empty', () => {
      const localOutput = createOutput({ stdinIsTTY: true, stdoutIsTTY: true, ci: '' });

      expect(localOutput.interactiveStdout).to.equal(process.stdout);
      expect(localOutput.interactiveStdin).to.equal(process.stdin);
      expect(localOutput.verboseMode).to.equal(false);
    });

    it('does not enable interactive streams when IO is disabled', () => {
      setProperty(process.stdin, 'isTTY', true);
      setProperty(process.stdout, 'isTTY', true);
      delete process.env.CI;

      const localOutput = new Output(false, true);

      expect(localOutput.interactiveStdout).to.equal(undefined);
      expect(localOutput.interactiveStderr).to.equal(undefined);
      expect(localOutput.interactiveStdin).to.equal(undefined);
      expect(localOutput.verboseMode).to.equal(false);
    });
  });
});
