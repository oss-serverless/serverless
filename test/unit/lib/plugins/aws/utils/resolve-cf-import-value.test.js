'use strict';

const expect = require('chai').expect;
const resolveCfImportValue = require('../../../../../../lib/plugins/aws/utils/resolve-cf-import-value');

describe('#resolveCfImportValue', () => {
  it('should return matching exported value if found', async () => {
    const provider = {
      request: async () => ({
        Exports: [
          {
            Name: 'anotherName',
            Value: 'anotherValue',
          },
          {
            Name: 'exportName',
            Value: 'exportValue',
          },
        ],
      }),
    };
    const result = await resolveCfImportValue(provider, 'exportName');
    expect(result).to.equal('exportValue');
  });

  it('should continue pagination when a page has no exports', async () => {
    const requests = [];
    const provider = {
      request: async (service, method, params) => {
        requests.push({ service, method, params });
        if (!params.NextToken) return { NextToken: 'next-page' };
        return {
          Exports: [
            {
              Name: 'exportName',
              Value: 'exportValue',
            },
          ],
        };
      },
    };

    const result = await resolveCfImportValue(provider, 'exportName');

    expect(result).to.equal('exportValue');
    expect(requests).to.deep.equal([
      { service: 'CloudFormation', method: 'listExports', params: {} },
      {
        service: 'CloudFormation',
        method: 'listExports',
        params: { NextToken: 'next-page' },
      },
    ]);
  });
});
