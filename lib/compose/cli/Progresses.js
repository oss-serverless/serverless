'use strict';

/**
 * Part of this code was forked from https://github.com/jcarpanelli/spinnies under the MIT license.
 * Copyright 2019 Juan Bautista Carpanelli (jcarpanelli)
 * https://github.com/jcarpanelli/spinnies/blob/master/LICENSE
 */

const cliCursor = require('cli-cursor').default;
const { stderrCliColors: colors } = require('./colors');
const symbols = require('./symbols');
const isUnicodeSupported = require('./is-unicode-supported');
const { stripVTControlCharacters: stripAnsi } = require('node:util');
const { createRegistry, hasOwn } = require('../utils/safe-object');

const dots = {
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};
// For Windows terminals
const dashes = {
  frames: ['-', '_'],
};

/**
 * @typedef {{
 *   text: string;
 *   timer: boolean;
 *   startTime?: number;
 *   endTime?: number;
 *   status: 'spinning'|'success'|'error'|'waiting'|'stopped'|'skipped';
 *   content?: string;
 * }} Progress
 */

class Progresses {
  /**
   * @param {import('./Output')} output
   */
  constructor(output) {
    this.options = {
      spinner: isUnicodeSupported() ? dots : dashes,
    };
    /** @type {Record<string, Progress>} */
    this.progresses = createRegistry();
    this.isCursorHidden = false;
    this.currentInterval = null;
    this.output = output;
    this.lineCount = 0;
    this.currentFrameIndex = 0;
    this.footerText = '';
    this.bindSigint();
  }

  /**
   * @param {string} name
   * @param {boolean} timer
   */
  add(name, timer = true) {
    this.progresses[name] = {
      status: 'waiting',
      text: 'waiting',
      timer,
    };
    this.updateSpinnerState(name);
  }

  setFooterText(text) {
    this.footerText = text;
  }

  /**
   * @param {string} name
   * @param {string} text
   */
  start(name, text) {
    this.progresses[name] = {
      ...this.progresses[name],
      timer: true,
      status: 'spinning',
      text,
      startTime: Date.now(),
    };
    this.updateSpinnerState(name);
  }

  /**
   * @param {string} name
   */
  exists(name) {
    return hasOwn(this.progresses, name) ? this.progresses[name] : undefined;
  }

  /**
   * @param {string} name
   */
  isWaiting(name) {
    return hasOwn(this.progresses, name) && this.progresses[name].status === 'waiting';
  }

  /**
   * @param {string} name
   * @param {string} text
   */
  update(name, text) {
    if (!hasOwn(this.progresses, name)) throw Error(`No progress with name ${name}`);
    this.progresses[name].text = text;
    this.updateSpinnerState(name);
  }

  /**
   * @param {string} name
   * @param {string} [text]
   */
  success(name, text) {
    if (!hasOwn(this.progresses, name)) throw Error(`No progress with name ${name}`);
    this.progresses[name].status = 'success';
    if (text) {
      this.progresses[name].text = text;
    }
    this.progresses[name].endTime = Date.now();
    this.updateSpinnerState(name);
  }

  /**
   * @param {string} name
   * @param {string|Error} [error]
   */
  error(name, error) {
    const errorMessage = error instanceof Error ? error.message : error;

    if (!hasOwn(this.progresses, name)) throw Error(`No progress with name ${name}`);
    this.progresses[name].status = 'error';
    this.progresses[name].text = 'error';
    this.progresses[name].endTime = Date.now();
    this.progresses[name].content = errorMessage;
    this.updateSpinnerState(name);

    if (error instanceof Error && error.stack) {
      this.output.verbose(error.stack, [name]);
    }
  }

  /**
   * @param {string} name
   */
  skipped(name) {
    if (!hasOwn(this.progresses, name)) throw Error(`No progress with name ${name}`);
    this.progresses[name].status = 'skipped';
    this.progresses[name].text = 'skipped';
    this.progresses[name].endTime = Date.now();
    this.updateSpinnerState(name);
  }

  stopAll() {
    Object.keys(this.progresses).forEach((name) => {
      const { status: currentStatus } = this.progresses[name];
      if (currentStatus === 'spinning' || currentStatus === 'waiting') {
        this.progresses[name].status = 'stopped';
      }
    });
    if (this.output.interactiveStderr) {
      // Refresh the output one last time
      this.setStreamOutput();
      this.output.interactiveStderr.moveCursor(0, this.lineCount);
      if (this.currentInterval) {
        clearInterval(this.currentInterval);
      }
      this.isCursorHidden = false;
      cliCursor.show();
    }
    this.progresses = createRegistry();
  }

  updateSpinnerState(progressName) {
    // Log the contents of the progress that initiated state update to verbose
    if (hasOwn(this.progresses, progressName)) {
      const progress = this.progresses[progressName];
      let logMessage = progress.text;
      if (progress.content) {
        logMessage += `\n${progress.content}`;
      }
      this.output.verbose(logMessage, [progressName]);
    }

    if (!this.output.interactiveStderr) return;
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
    }
    this.currentInterval = this.loopStream();
    if (!this.isCursorHidden) cliCursor.hide();
    this.isCursorHidden = true;
  }

  loopStream() {
    const { frames } = this.options.spinner;
    const interval = 80;
    return setInterval(() => {
      this.setStreamOutput(frames[this.currentFrameIndex]);
      this.currentFrameIndex =
        this.currentFrameIndex === frames.length - 1 ? 0 : ++this.currentFrameIndex;
    }, interval);
  }

  setStreamOutput(frame = ' ') {
    if (!this.output.interactiveStderr) {
      return;
    }

    const separator = colors.gray(symbols.separator);
    // Start with an empty line
    let output = '\n';
    for (const [name, progress] of Object.entries(this.progresses)) {
      let symbol = ' ';
      let componentColor = colors.foreground;
      let statusColor = colors.foreground;
      if (progress.status === 'spinning') {
        symbol = frame;
      } else if (progress.status === 'success') {
        symbol = symbols.success;
      } else if (progress.status === 'error') {
        symbol = symbols.error;
        componentColor = colors.red;
        statusColor = colors.red;
      } else if (progress.status === 'waiting' || progress.status === 'skipped') {
        statusColor = colors.gray;
      }
      let line = `${colors.red(symbol)}  ${componentColor(name)} ${separator} ${statusColor(
        progress.text
      )}`;
      if (progress.timer && progress.startTime) {
        const end = progress.endTime || Date.now();
        const elapsed = Math.round((end - progress.startTime) / 1000);
        line = `${line} ${separator} ${colors.gray(`${elapsed}s`)}`;
      }
      const indent = 4;
      line = indent ? `${' '.repeat(indent)}${line}` : `${line}`;
      // Avoids spamming the output when the text wraps
      line = this.ellipsis(line);

      // Progresses can have textual content (e.g. error detail)
      if (progress.content) {
        line += `\n\n${progress.content.trim()}\n`;
      }

      output += `${line}\n`;
    }

    if (this.footerText) {
      output += `\n${this.footerText.trim()}\r`;
    }

    output = this.wrapMultilineText(output);
    output = this.limitOutputToTerminalHeight(output);

    // Erase the current progresses output
    this.output.interactiveStderr.clearScreenDown();
    // Re-write the updated progresses
    const lineCount = output.split('\n').length - 1;
    this.output.interactiveStderr.write(output);
    this.output.interactiveStderr.moveCursor(0, -lineCount);
    this.lineCount = lineCount;
  }

  bindSigint() {
    Progresses.lastBoundInstance = this;
    if (Progresses.sigintHandler) {
      return;
    }

    Progresses.sigintHandler = () => {
      const boundInstance = Progresses.lastBoundInstance;
      cliCursor.show();
      if (boundInstance && boundInstance.output.interactiveStderr) {
        boundInstance.output.interactiveStderr.moveCursor(0, boundInstance.lineCount);
      }
      process.exit(0);
    };

    process.on('SIGINT', Progresses.sigintHandler);
  }

  ellipsis(text) {
    const columns = (this.output.interactiveStderr && this.output.interactiveStderr.columns) || 95;
    const extraCharacters = stripAnsi(text).length - columns;
    // If we go beyond the terminal width, we strip colors (because preserving ANSI while trimming is HARD)
    return extraCharacters > 0
      ? `${stripAnsi(text).substring(0, stripAnsi(text).length - extraCharacters - 1)}…`
      : text;
  }

  wrapMultilineText(text) {
    return text
      .split('\n')
      .map((line) => this.wrapLine(line))
      .join('\n');
  }

  wrapLine(line) {
    const columns = (this.output.interactiveStderr && this.output.interactiveStderr.columns) || 95;
    const strippedLine = stripAnsi(line);
    const lineLength = strippedLine.length;
    // If the line doesn't wrap, we don't touch it
    if (lineLength <= columns) return line;
    // Else we wrap it explicitly (with \n) and strip ANSI (else we may mess up ANSI code)
    // This is needed because we need to calculate the number of lines to clear, so we
    // need explicit line returns (\n) instead of automatic text wrapping
    return `${strippedLine.substring(0, columns - 1)}\n${this.wrapLine(
      strippedLine.substring(columns - 1, strippedLine.length)
    )}`;
  }

  limitOutputToTerminalHeight(output) {
    if (!this.output.interactiveStderr || !this.output.interactiveStderr.rows) {
      return '';
    }
    const lines = output.split('\n');
    const overflows = lines.length > this.output.interactiveStderr.rows;
    return overflows ? lines.slice(-this.output.interactiveStderr.rows).join('\n') : output;
  }
}

module.exports = Progresses;
