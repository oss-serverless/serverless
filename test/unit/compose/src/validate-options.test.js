'use strict';

const expect = require('chai').expect;
const validateOptions = require('../../../../lib/compose/validate-options');

describe('test/unit/src/validate-options.test.js', () => {
  it('rejects globally unsupported options', () => {
    expect(() => validateOptions({ debug: true }, 'deploy'))
      .to.throw()
      .and.have.property('code', 'INVALID_GLOBAL_CLI_OPTION');
  });

  it('rejects unrecognized options for native global Compose commands', () => {
    expect(() => validateOptions({ package: '../something' }, 'deploy'))
      .to.throw()
      .and.have.property('code', 'UNRECOGNIZED_CLI_OPTIONS');
  });

  it('accepts custom options for non-native Compose commands', () => {
    validateOptions({ package: '../something' }, 'invoke');
  });

  it('accepts Framework options for nested passthrough commands', () => {
    validateOptions({ function: 'handler' }, 'deploy:function');
    validateOptions({ function: 'handler' }, 'invoke:local');
    validateOptions({ 'function': 'handler', 'function-version': '23' }, 'rollback:function');
  });
});
