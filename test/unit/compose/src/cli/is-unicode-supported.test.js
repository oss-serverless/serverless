'use strict';

const expect = require('chai').expect;

const isUnicodeSupported = require('../../../../../lib/compose/cli/is-unicode-supported');

describe('test/unit/src/cli/is-unicode-supported.test.js', () => {
  let originalPlatformDescriptor;
  let originalEnv;

  const setPlatform = (platform) => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: platform,
    });
  };

  beforeEach(() => {
    originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    originalEnv = {
      CI: process.env.CI,
      WT_SESSION: process.env.WT_SESSION,
      TERM_PROGRAM: process.env.TERM_PROGRAM,
      TERM: process.env.TERM,
    };

    delete process.env.CI;
    delete process.env.WT_SESSION;
    delete process.env.TERM_PROGRAM;
    delete process.env.TERM;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('supports unicode outside Windows', () => {
    setPlatform('darwin');

    expect(isUnicodeSupported()).to.equal(true);
  });

  it('does not support unicode on unknown Windows terminals', () => {
    setPlatform('win32');

    expect(isUnicodeSupported()).to.equal(false);
  });

  it('supports unicode on Windows in CI', () => {
    setPlatform('win32');
    process.env.CI = '1';

    expect(isUnicodeSupported()).to.equal(true);
  });

  it('supports unicode in Windows Terminal', () => {
    setPlatform('win32');
    process.env.WT_SESSION = 'session-id';

    expect(isUnicodeSupported()).to.equal(true);
  });

  it('supports unicode in VS Code terminal on Windows', () => {
    setPlatform('win32');
    process.env.TERM_PROGRAM = 'vscode';

    expect(isUnicodeSupported()).to.equal(true);
  });

  it('supports unicode in xterm-compatible Windows terminals', () => {
    setPlatform('win32');
    process.env.TERM = 'xterm-256color';

    expect(isUnicodeSupported()).to.equal(true);
  });

  it('supports unicode in Alacritty on Windows', () => {
    setPlatform('win32');
    process.env.TERM = 'alacritty';

    expect(isUnicodeSupported()).to.equal(true);
  });
});
