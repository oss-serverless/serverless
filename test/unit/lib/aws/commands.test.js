'use strict';

const chai = require('chai');

const { expect } = chai;

describe('test/unit/lib/aws/commands.test.js', () => {
  const { COMMAND_MAP, createCommand } = require('../../../../lib/aws/commands');

  const providerRequestPairs = [
    ['APIGateway', 'createStage'],
    ['APIGateway', 'getApiKey'],
    ['APIGateway', 'getDeployments'],
    ['APIGateway', 'getRestApis'],
    ['APIGateway', 'getStage'],
    ['APIGateway', 'getUsagePlans'],
    ['APIGateway', 'tagResource'],
    ['APIGateway', 'untagResource'],
    ['APIGateway', 'updateStage'],
    ['APIGateway', 'updateUsagePlan'],
    ['ApiGatewayV2', 'getApi'],
    ['CloudFormation', 'createChangeSet'],
    ['CloudFormation', 'createStack'],
    ['CloudFormation', 'deleteChangeSet'],
    ['CloudFormation', 'deleteStack'],
    ['CloudFormation', 'describeChangeSet'],
    ['CloudFormation', 'describeStackEvents'],
    ['CloudFormation', 'describeStackResource'],
    ['CloudFormation', 'describeStackResources'],
    ['CloudFormation', 'describeStacks'],
    ['CloudFormation', 'executeChangeSet'],
    ['CloudFormation', 'getTemplate'],
    ['CloudFormation', 'listExports'],
    ['CloudFormation', 'listStackResources'],
    ['CloudFormation', 'setStackPolicy'],
    ['CloudFormation', 'updateStack'],
    ['CloudFormation', 'validateTemplate'],
    ['CloudWatch', 'getMetricStatistics'],
    ['CloudWatchLogs', 'deleteLogGroup'],
    ['CloudWatchLogs', 'deleteSubscriptionFilter'],
    ['CloudWatchLogs', 'describeLogStreams'],
    ['CloudWatchLogs', 'describeSubscriptionFilters'],
    ['CloudWatchLogs', 'filterLogEvents'],
    ['ECR', 'createRepository'],
    ['ECR', 'deleteRepository'],
    ['ECR', 'describeImages'],
    ['ECR', 'describeRepositories'],
    ['ECR', 'getAuthorizationToken'],
    ['ECR', 'putLifecyclePolicy'],
    ['IAM', 'getRole'],
    ['Lambda', 'getFunction'],
    ['Lambda', 'getLayerVersion'],
    ['Lambda', 'invoke'],
    ['Lambda', 'listVersionsByFunction'],
    ['Lambda', 'updateFunctionCode'],
    ['Lambda', 'updateFunctionConfiguration'],
    ['S3', 'deleteObjects'],
    ['S3', 'getObject'],
    ['S3', 'headBucket'],
    ['S3', 'headObject'],
    ['S3', 'listObjectVersions'],
    ['S3', 'listObjectsV2'],
    ['SSM', 'getParameter'],
    ['STS', 'getCallerIdentity'],
  ];

  for (const [service, method] of providerRequestPairs) {
    it(`maps ${service}.${method} to a v3 command`, () => {
      const params = { marker: `${service}.${method}` };
      const command = createCommand(service, method, params);

      expect(command.input).to.deep.equal(params);
      expect(COMMAND_MAP[service][method]).to.be.a('function');
    });
  }

  it('special-cases S3.upload', () => {
    const params = { Bucket: 'bucket', Key: 'key' };

    expect(createCommand('S3', 'upload', params)).to.deep.equal({
      _isUploadRequest: true,
      params,
    });
  });

  it('fails loudly for unknown services', () => {
    expect(() => createCommand('Route53', 'listHostedZones', {}))
      .to.throw('Unknown AWS service: Route53')
      .and.have.property('code', 'AWS_SDK_V3_UNKNOWN_SERVICE');
  });

  it('fails loudly for unknown methods', () => {
    expect(() => createCommand('S3', 'unknownMethod', {}))
      .to.throw("Unknown method 'unknownMethod' for service 'S3'")
      .and.have.property('code', 'AWS_SDK_V3_UNKNOWN_METHOD');
  });
});
