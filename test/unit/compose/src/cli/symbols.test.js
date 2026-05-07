'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire');

describe('test/unit/src/cli/symbols.test.js', () => {
  const loadSymbols = (isUnicodeSupported) =>
    proxyquire.noCallThru().load('../../../../../lib/compose/cli/symbols', {
      './is-unicode-supported': () => isUnicodeSupported,
    });

  it('exports unicode symbols when unicode is supported', () => {
    expect(loadSymbols(true)).to.deep.equal({
      success: '✔',
      error: '✖',
      separator: '›',
    });
  });

  it('exports fallback symbols when unicode is not supported', () => {
    expect(loadSymbols(false)).to.deep.equal({
      success: '√',
      error: '×',
      separator: '>',
    });
  });
});
