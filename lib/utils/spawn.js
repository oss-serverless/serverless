'use strict';

const { spawn } = require('child_process');

module.exports = (command, args = [], options = {}) => {
  const child = spawn(command, args, options);
  const stdoutChunks = [];
  const stderrChunks = [];
  const stdChunks = [];

  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
      stdChunks.push(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
      stdChunks.push(chunk);
    });
  }

  const buildResult = () => ({
    child,
    stdout: child.stdout,
    stderr: child.stderr,
    stdoutBuffer: Buffer.concat(stdoutChunks),
    stderrBuffer: Buffer.concat(stderrChunks),
    stdBuffer: Buffer.concat(stdChunks),
  });

  const promise = new Promise((resolve, reject) => {
    child.on('error', (error) => {
      Object.assign(error, buildResult());
      reject(error);
    });

    child.on('close', (code, signal) => {
      const result = buildResult();
      if (code === 0) {
        resolve(result);
        return;
      }

      const error = new Error(`Command failed: ${command} ${args.join(' ')}`);
      error.code = code;
      error.signal = signal;
      Object.assign(error, result);
      reject(error);
    });
  });

  promise.child = child;
  promise.stdout = child.stdout;
  promise.stderr = child.stderr;

  return promise;
};
