'use strict';

const sinon = require('sinon');
const { expect } = require('chai');

const skipOnDisabledSymlinksInWindows = require('../../lib/skip-on-disabled-symlinks-in-windows');

describe('test/unit/lib/skip-on-disabled-symlinks-in-windows.test.js', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  let originalCI;

  beforeEach(() => {
    originalCI = process.env.CI;
    process.env.CI = '1';
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  afterEach(() => {
    if (originalCI == null) delete process.env.CI;
    else process.env.CI = originalCI;
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);
  });

  it('skips Windows EPERM symlink failures in CI', () => {
    const context = { skip: sinon.stub() };
    const afterCallback = sinon.stub();

    skipOnDisabledSymlinksInWindows({ code: 'EPERM' }, context, afterCallback);

    expect(afterCallback).to.have.been.calledOnce;
    expect(context.skip).to.have.been.calledOnce;
  });
});
