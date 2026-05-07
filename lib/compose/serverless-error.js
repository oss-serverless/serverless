'use strict';

/**
 * This class is for signaling user errors.
 */
class ServerlessError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {unknown} [previous]
   */
  constructor(message, code, previous) {
    super(message);
    this.code = code;

    // The ServerlessError class lets us pass a "previous" exception,
    // i.e. the low-level error that we are wrapping with a better user message.
    // We preserve the original stack trace (just like in Java or PHP)
    // to ease debugging. See https://stackoverflow.com/q/42754270/245552
    if (previous instanceof Error && previous.stack) {
      this.stack += `\nFrom previous ${previous.stack}`;
    }
  }
}

Object.defineProperty(ServerlessError.prototype, 'name', {
  value: ServerlessError.name,
  configurable: true,
  writable: true,
});

module.exports = ServerlessError;
