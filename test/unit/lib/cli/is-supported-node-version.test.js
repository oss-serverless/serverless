'use strict';

const { expect } = require('chai');

const isSupportedNodeVersion = require('../../../../lib/cli/is-supported-node-version');

describe('test/unit/lib/cli/is-supported-node-version.test.js', () => {
  it('rejects Node 18', () => {
    expect(isSupportedNodeVersion('v18.20.0')).to.equal(false);
  });

  it('accepts Node 20', () => {
    expect(isSupportedNodeVersion('v20.0.0')).to.equal(true);
  });

  it('accepts Node 22', () => {
    expect(isSupportedNodeVersion('v22.1.0')).to.equal(true);
  });
});
