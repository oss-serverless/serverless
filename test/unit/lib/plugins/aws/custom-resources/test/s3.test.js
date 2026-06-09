'use strict';

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const utils = require('../../../../../../../lib/plugins/aws/custom-resources/resources/utils');

describe('Custom resource S3 permissions', () => {
  let sentCommands;
  let addPermission;
  let removePermission;

  beforeEach(() => {
    sentCommands = [];

    class LambdaClient {
      constructor() {
        this.config = {};
      }

      send(command) {
        sentCommands.push(command);
        return Promise.resolve();
      }
    }

    class AddPermissionCommand {
      constructor(input) {
        this.input = input;
      }
    }

    class RemovePermissionCommand {
      constructor(input) {
        this.input = input;
      }
    }

    ({ addPermission, removePermission } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/s3/lib/permissions',
      {
        '@aws-sdk/client-lambda': {
          LambdaClient,
          AddPermissionCommand,
          RemovePermissionCommand,
        },
      }
    ));
  });

  it('should pass qualifier when adding Lambda permission', async () => {
    await addPermission({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      bucketName: 'orders-bucket',
      partition: 'aws',
      region: 'us-east-1',
      accountId: '123456789012',
    });

    expect(sentCommands[0].input).to.include({
      FunctionName: 'orders',
      Qualifier: 'provisioned',
    });
  });

  it('should pass qualifier when removing Lambda permission', async () => {
    await removePermission({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      bucketName: 'orders-bucket',
      region: 'us-east-1',
    });

    expect(sentCommands[0].input).to.include({
      FunctionName: 'orders',
      Qualifier: 'provisioned',
    });
  });
});

describe('Custom resource S3 handler', () => {
  it('should add qualified permission before migrating existing notification target', async () => {
    const calls = [];
    const addPermission = sinon.stub().callsFake(async (input) => {
      calls.push(['addPermission', input]);
    });
    const updateConfiguration = sinon.stub().callsFake(async (input) => {
      calls.push(['updateConfiguration', input]);
    });
    const removePermission = sinon.stub().callsFake(async (input) => {
      calls.push(['removePermission', input]);
    });
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/s3/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/bucket': { updateConfiguration, removeConfiguration },
      }
    );

    await handler(
      {
        RequestType: 'Update',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          BucketName: 'orders-bucket',
          BucketConfigs: [],
        },
        OldResourceProperties: {
          FunctionName: 'orders',
          BucketName: 'orders-bucket',
          BucketConfigs: [],
        },
      },
      {}
    );

    expect(addPermission).to.have.been.calledOnce;
    expect(addPermission.args[0][0]).to.include({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      bucketName: 'orders-bucket',
    });
    expect(updateConfiguration.args[0][0]).to.include({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      functionName: 'orders',
      bucketName: 'orders-bucket',
    });
    expect(removePermission.args[0][0]).to.include({
      functionName: 'orders',
      bucketName: 'orders-bucket',
    });
    expect(removePermission.args[0][0]).to.have.property('functionQualifier', undefined);
    expect(removeConfiguration).to.not.have.been.called;
    expect(calls.map(([name]) => name)).to.deep.equal([
      'addPermission',
      'updateConfiguration',
      'removePermission',
    ]);
  });
});

describe('Custom resource S3 bucket configuration', () => {
  it('should only replace owned notification configurations', async () => {
    const sentCommands = [];

    class S3Client {
      constructor() {
        this.config = {};
      }

      send(command) {
        sentCommands.push(command);
        if (command.constructor.name === 'GetBucketNotificationConfigurationCommand') {
          return Promise.resolve({
            LambdaFunctionConfigurations: [
              {
                Id: 'orders-previous',
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders',
              },
              {
                Id: 'orders2-previous',
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders2',
              },
              {
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:external',
              },
            ],
          });
        }
        return Promise.resolve();
      }
    }

    class GetBucketNotificationConfigurationCommand {
      constructor(input) {
        this.input = input;
      }
    }

    class PutBucketNotificationConfigurationCommand {
      constructor(input) {
        this.input = input;
      }
    }

    const { updateConfiguration } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/s3/lib/bucket',
      {
        '@aws-sdk/client-s3': {
          S3Client,
          GetBucketNotificationConfigurationCommand,
          PutBucketNotificationConfigurationCommand,
        },
      }
    );

    await updateConfiguration({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      functionName: 'orders',
      bucketName: 'orders-bucket',
      bucketConfigs: [{ Event: 's3:ObjectCreated:*', Rules: [] }],
      region: 'us-east-1',
    });

    const putInput = sentCommands[1].input;
    const configs = putInput.NotificationConfiguration.LambdaFunctionConfigurations;

    expect(configs).to.have.length(3);
    expect(configs.map((config) => config.LambdaFunctionArn)).to.deep.equal([
      'arn:aws:lambda:us-east-1:123456789012:function:orders2',
      'arn:aws:lambda:us-east-1:123456789012:function:external',
      'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
    ]);
  });
});
