'use strict';

const spawn = require('cross-spawn');
const { PassThrough } = require('stream');

const sensitiveOptionNamePattern =
  /(?:^|[-_])(?:auth|authorization|credential|password|passwd|pwd|secret|token|api[-_]?key|access[-_]?key)(?:$|[-_])/i;

const toBuffer = (chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

const redactArgs = (args) => {
  const redactedArgs = [];
  let redactNext = false;

  for (const arg of args) {
    const value = String(arg);

    if (redactNext) {
      redactedArgs.push('<redacted>');
      redactNext = false;
      continue;
    }

    const equalsIndex = value.indexOf('=');
    const optionName = value.replace(/^-+/, '').split('=')[0];

    if (equalsIndex !== -1 && sensitiveOptionNamePattern.test(optionName)) {
      redactedArgs.push(`${value.slice(0, equalsIndex + 1)}<redacted>`);
      continue;
    }

    if (value.startsWith('-') && sensitiveOptionNamePattern.test(optionName)) {
      redactedArgs.push(value);
      redactNext = true;
      continue;
    }

    redactedArgs.push(value);
  }

  return redactedArgs;
};

module.exports = (command, args = [], options = {}) => {
  const normalizedCommand = String(command);
  const normalizedArgs = args == null ? [] : Array.from(args, String);
  const { shouldCloseStdin, input, ...spawnOptions } = options || {};

  const child = spawn(normalizedCommand, normalizedArgs, spawnOptions);
  const result = {
    child,
    stdout: child.stdout || null,
    stderr: child.stderr || null,
    std: child.stdout || child.stderr ? new PassThrough() : null,
    stdoutBuffer: Buffer.alloc(0),
    stderrBuffer: Buffer.alloc(0),
    stdBuffer: Buffer.alloc(0),
    code: undefined,
    signal: undefined,
  };
  const stdoutChunks = [];
  const stderrChunks = [];
  const stdChunks = [];

  const append = (bufferName, chunks, chunk) => {
    chunks.push(toBuffer(chunk));
    result[bufferName] = Buffer.concat(chunks);
  };

  const snapshot = () => ({ ...result });

  const endStd = () => {
    if (result.std && !result.std.destroyed && !result.std.writableEnded) {
      result.std.end();
    }
  };

  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      append('stdoutBuffer', stdoutChunks, chunk);
      append('stdBuffer', stdChunks, chunk);
      result.std.write(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      append('stderrBuffer', stderrChunks, chunk);
      append('stdBuffer', stdChunks, chunk);
      result.std.write(chunk);
    });
  }

  const promise = new Promise((resolve, reject) => {
    let settled = false;

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      endStd();
      const metadata = snapshot();
      if (metadata.code === undefined) delete metadata.code;
      if (metadata.signal === undefined) delete metadata.signal;
      Object.assign(error, metadata);
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      result.code = code;
      result.signal = signal;
      endStd();

      if (code === 0) {
        resolve(snapshot());
        return;
      }

      const reason = signal ? `signal ${signal}` : `code ${code}`;
      const error = new Error(
        `\`${[normalizedCommand, ...redactArgs(normalizedArgs)].join(' ')}\` Exited with ${reason}`
      );
      error.code = code;
      error.signal = signal;
      Object.assign(error, snapshot());
      reject(error);
    });

    if (input != null && child.stdin) {
      child.stdin.end(input);
    } else if (shouldCloseStdin && child.stdin) {
      child.stdin.end();
    }
  });

  return Object.defineProperties(promise, {
    child: { enumerable: true, get: () => result.child },
    stdout: { enumerable: true, get: () => result.stdout },
    stderr: { enumerable: true, get: () => result.stderr },
    std: { enumerable: true, get: () => result.std },
    stdoutBuffer: { enumerable: true, get: () => result.stdoutBuffer },
    stderrBuffer: { enumerable: true, get: () => result.stderrBuffer },
    stdBuffer: { enumerable: true, get: () => result.stdBuffer },
    code: { enumerable: true, get: () => result.code },
    signal: { enumerable: true, get: () => result.signal },
  });
};
