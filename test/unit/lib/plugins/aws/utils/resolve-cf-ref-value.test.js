'use strict';

const expect = require('chai').expect;
const resolveCfRefValue = require('../../../../../../lib/plugins/aws/utils/resolve-cf-ref-value');

describe('#resolveCfRefValue', () => {
  it('should return matching exported value if found', async () => {
    const provider = {
      naming: {
        getStackName: () => 'stack-name',
      },
      request: async () => ({
        StackResourceSummaries: [
          {
            LogicalResourceId: 'myS3',
            PhysicalResourceId: 'stack-name-s3-id',
          },
          {
            LogicalResourceId: 'myDB',
            PhysicalResourceId: 'stack-name-db-id',
          },
        ],
      }),
    };
    const result = await resolveCfRefValue(provider, 'myDB');
    expect(result).to.equal('stack-name-db-id');
  });

  it('should continue pagination when a page has no stack resources', async () => {
    const requests = [];
    const sdkParams = { SomeParam: 'kept' };
    const provider = {
      naming: {
        getStackName: () => 'stack-name',
      },
      request: async (service, method, params) => {
        requests.push({ service, method, params });
        if (!params.NextToken) return { NextToken: 'next-page' };
        return {
          StackResourceSummaries: [
            {
              LogicalResourceId: 'myDB',
              PhysicalResourceId: 'stack-name-db-id',
            },
          ],
        };
      },
    };

    const result = await resolveCfRefValue(provider, 'myDB', sdkParams);

    expect(result).to.equal('stack-name-db-id');
    expect(sdkParams).to.deep.equal({ SomeParam: 'kept' });
    expect(requests).to.deep.equal([
      {
        service: 'CloudFormation',
        method: 'listStackResources',
        params: { SomeParam: 'kept', StackName: 'stack-name' },
      },
      {
        service: 'CloudFormation',
        method: 'listStackResources',
        params: { SomeParam: 'kept', NextToken: 'next-page', StackName: 'stack-name' },
      },
    ]);
  });

  it('should report a clear error when no resource matches', async () => {
    const provider = {
      naming: {
        getStackName: () => 'stack-name',
      },
      request: async () => ({ StackResourceSummaries: [] }),
    };

    let error;
    try {
      await resolveCfRefValue(provider, 'missingResource');
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).to.have.property(
      'message',
      'Could not resolve Ref with name missingResource. Are you sure this value matches a resource logical ID?'
    );
    expect(error).to.have.property('code', 'CF_REF_RESOLUTION');
  });
});
