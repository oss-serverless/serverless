'use strict';

const { stdoutCliColors, stderrCliColors } = require('./colors');
const symbols = require('./symbols');
const fs = require('fs');
const { stripVTControlCharacters: stripAnsi } = require('node:util');
const path = require('path');
const { PassThrough } = require('stream');

/**
 * @property {NodeJS.WritableStream} stdout
 * @property {undefined | NodeJS.WriteStream} interactiveStdout Undefined if not interactive
 * @property {NodeJS.WritableStream} stderr
 * @property {undefined | NodeJS.WriteStream} interactiveStderr Undefined if not interactive
 * @property {undefined | NodeJS.ReadStream} interactiveStdin Undefined if not interactive
 * @property {NodeJS.WritableStream} logsFileStream
 */
class Output {
  /**
   * @param {boolean} verboseMode
   * @param {boolean} [disableIO] To allow mocking in tests
   */
  constructor(verboseMode, disableIO = false) {
    /** @type {Array<{ namespace?: string[], message: string }>} */
    this.verboseLogs = [];
    this.logsFilePath = '.serverless/compose.log';
    this.verboseMode = verboseMode;
    this.stdout = disableIO ? new PassThrough() : process.stdout;
    this.stderr = disableIO ? new PassThrough() : process.stderr;
    this.logsFileStream = disableIO ? new PassThrough() : this.openLogsFile();
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;

    if (!disableIO && isInteractive) {
      this.interactiveStdout = process.stdout;
      this.interactiveStderr = process.stderr;
      this.interactiveStdin = process.stdin;
    }

    // We want to apply it only in non-test environment so we check this only if
    // disableIO is not explicitly set to true
    if (!isInteractive && disableIO === false) {
      // We also want to enable verbose by default for non-interactive environments
      this.verboseMode = true;
    }
  }

  /**
   * Writes text to stdout.
   * @param {string} [message]
   * @param {string[]} [namespace]
   */
  writeText(message = '', namespace = []) {
    message = this.namespaceLogMessage(message, namespace, stdoutCliColors);
    this.safeWrite(message);
    this.writeToLogsFile(message);
  }

  /**
   * Writes logs to stderr.
   * @param {string} [message]
   * @param {string[]} [namespace]
   */
  log(message, namespace = []) {
    message = this.namespaceLogMessage(message, namespace, stderrCliColors);
    this.safeWrite(message, false);
    this.writeToLogsFile(message);
  }

  /**
   * @param {string} message
   * @param {string[]} [namespace]
   */
  verbose(message, namespace) {
    if (!message || message === '') return;

    this.writeToLogsFile(this.namespaceLogMessage(message, namespace, stderrCliColors));

    if (this.verboseMode) {
      this.doLogVerbose(message, namespace);
    } else {
      this.verboseLogs.push({
        message,
        namespace,
      });
    }
  }

  /**
   * @param {string|Error} error
   * @param {string[]} [namespace]
   */
  error(error, namespace = []) {
    if (this.verboseMode && error instanceof Error) {
      // Print the stack trace in verbose mode
      this.log(`${stderrCliColors.red('Error:')} ${error.stack}`, namespace);
    } else {
      error = error instanceof Error ? error.message : error;
      this.log(`${stderrCliColors.red('Error:')} ${error}`, namespace);
    }
  }

  enableVerbose() {
    this.verboseMode = true;
    // Flush all previous verbose logs to the output
    this.verboseLogs.forEach(({ message, namespace }) => {
      this.doLogVerbose(message, namespace);
    });
    this.verboseLogs = [];
  }

  /**
   * @private
   * @param {string} message
   * @param {string[]} [namespace]
   */
  doLogVerbose(message, namespace) {
    message = stderrCliColors.gray(message);
    message = this.namespaceLogMessage(message, namespace, stderrCliColors);
    this.safeWrite(message, false);
  }

  /**
   * @private
   * @param {string} text
   */
  writeToLogsFile(text) {
    text = stripAnsi(text);
    this.logsFileStream.write(`${text}\n`);
  }

  /**
   * @private
   * @param {string|undefined} text
   * @param {string[]} [namespace]
   * @return {string}
   */
  namespaceLogMessage(text = '', namespace = [], palette = stdoutCliColors) {
    const prefix = this.generatePrefix(namespace, palette);
    return text
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n');
  }

  /**
   * @private
   * @param {string[]} [namespace]
   * @return string
   */
  generatePrefix(namespace = [], palette = stdoutCliColors) {
    if (!namespace || namespace.length === 0) {
      return '';
    }

    const gray = typeof palette.gray === 'function' ? palette.gray : stdoutCliColors.gray;
    let prefix = namespace.join(` ${symbols.separator} `);
    if (prefix.length > 0) {
      prefix = gray(`${prefix} ${symbols.separator} `);
    }
    return prefix;
  }

  openLogsFile() {
    const directory = path.dirname(this.logsFilePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
    return fs.createWriteStream(this.logsFilePath);
  }

  /**
   * Safely writes text to a stream.
   * It takes into account dynamic content that may be written below.
   * @private
   * @param {string | undefined} text
   * @param {boolean} [stdout] If false, stderr is used.
   */
  safeWrite(text, stdout = true) {
    const stream = stdout ? this.stdout : this.stderr;
    const interactiveStream = stdout ? this.interactiveStdout : this.interactiveStderr;

    text = text || '';
    for (const line of text.split('\n')) {
      // This writes from the cursor
      stream.write(line);
      // But maybe the line already contained content (e.g. a progress)
      // so we clear the rest of line, up till its end (on the right side)
      if (interactiveStream) {
        interactiveStream.clearLine(1);
      }
      // Then we can add a line return
      stream.write('\n');
    }
  }
}

module.exports = Output;
