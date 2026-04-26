'use strict';

const { expect } = require('chai');
const spawn = require('../../../../lib/utils/spawn');

const expectRejected = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
};

const assertRedaction = async ({ args, redacted, visible = [] }) => {
  const error = await expectRejected(
    spawn(process.execPath, ['-e', 'process.exit(7);', '--', ...args])
  );

  for (const value of redacted) {
    expect(error.message).to.not.include(value);
  }

  for (const value of visible) {
    expect(error.message).to.include(value);
  }
};

describe('spawn', () => {
  it('executes package manager shims through cross-platform resolution', async () => {
    const result = await spawn('npm', ['--version']);

    expect(String(result.stdoutBuffer).trim()).to.match(/^\d+\.\d+\.\d+/);
    expect(result.code).to.equal(0);
    expect(result.signal).to.equal(null);
  });

  it('closes stdin when shouldCloseStdin is enabled', async () => {
    const result = await spawn(
      process.execPath,
      [
        '-e',
        'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write("closed"));',
      ],
      { shouldCloseStdin: true }
    );

    expect(String(result.stdoutBuffer)).to.equal('closed');
  });

  it('exposes child, streams, std stream, buffers, code, and signal on success', async () => {
    const execution = spawn(process.execPath, [
      '-e',
      'setTimeout(() => { process.stdout.write("out"); process.stderr.write("err"); }, 25);',
    ]);
    const stdChunks = [];

    expect(execution.child).to.exist;
    expect(execution.stdout).to.exist;
    expect(execution.stderr).to.exist;
    expect(execution.std).to.exist;

    execution.std.on('data', (chunk) => stdChunks.push(chunk));

    const result = await execution;

    expect(result.child).to.equal(execution.child);
    expect(String(result.stdoutBuffer)).to.equal('out');
    expect(String(result.stderrBuffer)).to.equal('err');
    expect(String(result.stdBuffer)).to.include('out');
    expect(String(result.stdBuffer)).to.include('err');
    expect(String(Buffer.concat(stdChunks))).to.include('out');
    expect(String(Buffer.concat(stdChunks))).to.include('err');
    expect(result.code).to.equal(0);
    expect(result.signal).to.equal(null);
  });

  it('rejects nonzero exits with buffers and redacted command arguments', async () => {
    const error = await expectRejected(
      spawn(process.execPath, [
        '-e',
        'process.stdout.write("out"); process.stderr.write("err"); process.exit(7);',
        '--',
        '--password',
        'super-secret',
        '--token=secret-token',
      ])
    );

    expect(error.code).to.equal(7);
    expect(error.signal).to.equal(null);
    expect(String(error.stdoutBuffer)).to.equal('out');
    expect(String(error.stderrBuffer)).to.equal('err');
    expect(error.message).to.include('Exited with code 7');
    expect(error.message).to.not.include('super-secret');
    expect(error.message).to.not.include('secret-token');
    expect(error.message).to.include('--password <redacted>');
    expect(error.message).to.include('--token=<redacted>');
  });

  it('redacts sensitive option values in generated error messages', async () => {
    await assertRedaction({
      args: [
        '--authorization',
        'Bearer abc',
        '--credential',
        'profile',
        '--api-key',
        'key-value',
        '--access_key',
        'access-value',
        '--pwd',
        'pwd-value',
        '--SECRET',
        'secret-value',
        '--secret=inline-secret',
        '--monkey',
        'visible-value',
        '--tokenizer',
        'visible-tokenizer',
      ],
      redacted: [
        'Bearer abc',
        'profile',
        'key-value',
        'access-value',
        'pwd-value',
        'secret-value',
        'inline-secret',
      ],
      visible: ['--monkey', 'visible-value', '--tokenizer', 'visible-tokenizer'],
    });
  });

  it('preserves spawn error codes such as ENOENT', async () => {
    const error = await expectRejected(spawn(`missing-command-${process.pid}`, []));

    expect(error.code).to.equal('ENOENT');
    expect(error.stdoutBuffer).to.deep.equal(Buffer.alloc(0));
    expect(error.stderrBuffer).to.deep.equal(Buffer.alloc(0));
    expect(error.stdBuffer).to.deep.equal(Buffer.alloc(0));
  });

  it('handles stdio inherit with null streams on success', async () => {
    const result = await spawn(process.execPath, ['-e', 'process.exit(0);'], {
      stdio: 'inherit',
    });

    expect(result.stdout).to.equal(null);
    expect(result.stderr).to.equal(null);
    expect(result.std).to.equal(null);
    expect(result.stdoutBuffer).to.deep.equal(Buffer.alloc(0));
    expect(result.stderrBuffer).to.deep.equal(Buffer.alloc(0));
    expect(result.stdBuffer).to.deep.equal(Buffer.alloc(0));
    expect(result.code).to.equal(0);
  });

  it('handles stdio inherit with null streams on nonzero exit', async () => {
    const error = await expectRejected(
      spawn(process.execPath, ['-e', 'process.exit(3);'], { stdio: 'inherit' })
    );

    expect(error.code).to.equal(3);
    expect(error.stdout).to.equal(null);
    expect(error.stderr).to.equal(null);
    expect(error.std).to.equal(null);
    expect(error.stdoutBuffer).to.deep.equal(Buffer.alloc(0));
    expect(error.stderrBuffer).to.deep.equal(Buffer.alloc(0));
    expect(error.stdBuffer).to.deep.equal(Buffer.alloc(0));
  });
});
