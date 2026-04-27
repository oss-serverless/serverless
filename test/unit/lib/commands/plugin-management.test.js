'use strict';

const { expect } = require('chai');
const { getPluginInfo } = require('../../../../lib/commands/plugin-management');

describe('test/unit/lib/commands/plugin-management.test.js', () => {
  describe('#getPluginInfo()', () => {
    const maxLengthName = 'a'.repeat(214);
    const overLengthName = 'a'.repeat(215);
    const scopedMaxLengthName = `@${'a'.repeat(100)}/${'b'.repeat(112)}`;
    const scopedOverLengthName = `@${'a'.repeat(100)}/${'b'.repeat(113)}`;

    for (const [input, expected] of [
      ['serverless-webpack', { name: 'serverless-webpack', version: undefined }],
      ['serverless-plugin-foo', { name: 'serverless-plugin-foo', version: undefined }],
      ['@scope/serverless-plugin', { name: '@scope/serverless-plugin', version: undefined }],
      ['serverless-plugin@latest', { name: 'serverless-plugin', version: 'latest' }],
      ['serverless-plugin@1.2.3', { name: 'serverless-plugin', version: '1.2.3' }],
      ['serverless-plugin@^1.0.0 || 2', { name: 'serverless-plugin', version: '^1.0.0 || 2' }],
      ['@scope/serverless-plugin@1.2.3', { name: '@scope/serverless-plugin', version: '1.2.3' }],
      [maxLengthName, { name: maxLengthName, version: undefined }],
      [`${maxLengthName}@latest`, { name: maxLengthName, version: 'latest' }],
      [scopedMaxLengthName, { name: scopedMaxLengthName, version: undefined }],
      [`${scopedMaxLengthName}@1.2.3`, { name: scopedMaxLengthName, version: '1.2.3' }],
    ]) {
      it(`parses valid plugin spec "${input}"`, () => {
        expect(getPluginInfo(input)).to.deep.equal(expected);
      });
    }

    for (const input of [
      '',
      '@',
      '@scope',
      '@scope/',
      '--prefix=/tmp/x',
      '-plugin',
      '.plugin',
      '_plugin',
      'serverless plugin',
      'serverless;id',
      'serverless|id',
      'serverless`id`',
      'serverless$(id)',
      'serverless\nplugin',
      '/tmp/plugin',
      '../plugin',
      overLengthName,
      `${overLengthName}@latest`,
      scopedOverLengthName,
      `${scopedOverLengthName}@1.2.3`,
    ]) {
      it(`rejects invalid plugin spec ${JSON.stringify(input)}`, () => {
        expect(() => getPluginInfo(input))
          .to.throw()
          .with.property('code', 'INVALID_PLUGIN_NAME');
      });
    }
  });
});
