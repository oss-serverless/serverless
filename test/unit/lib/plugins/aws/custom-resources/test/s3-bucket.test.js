'use strict';

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('Custom resource S3 bucket configuration', () => {
  let sentCommands;
  let updateConfiguration;
  let removeConfiguration;

  beforeEach(() => {
    sentCommands = [];

    class S3Client {
      constructor() {
        this.config = {};
      }

      send(command) {
        sentCommands.push(command);
        if (command.constructor.name === 'GetBucketNotificationConfigurationCommand') {
          return Promise.resolve({
            $metadata: {},
            LambdaFunctionConfigurations: [
              {
                Id: `orders-${'a'.repeat(32)}`,
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders',
              },
              {
                Id: `orders-api-${'b'.repeat(32)}`,
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders-api',
              },
              {
                Id: 'orders-manual',
                LambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:manual',
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

    ({ updateConfiguration, removeConfiguration } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/s3/lib/bucket',
      {
        '@aws-sdk/client-s3': {
          S3Client,
          GetBucketNotificationConfigurationCommand,
          PutBucketNotificationConfigurationCommand,
        },
      }
    ));
  });

  it('should only replace owned notification configurations on update', async () => {
    await updateConfiguration({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders',
      functionName: 'orders',
      bucketName: 'orders-bucket',
      bucketConfigs: [{ Event: 's3:ObjectCreated:*', Rules: [] }],
      region: 'us-east-1',
    });

    const putInput = sentCommands[1].input;
    const configs = putInput.NotificationConfiguration.LambdaFunctionConfigurations;

    expect(configs.map((config) => config.LambdaFunctionArn)).to.deep.equal([
      'arn:aws:lambda:us-east-1:123456789012:function:orders-api',
      'arn:aws:lambda:us-east-1:123456789012:function:manual',
      'arn:aws:lambda:us-east-1:123456789012:function:external',
      'arn:aws:lambda:us-east-1:123456789012:function:orders',
    ]);
  });

  it('should only remove owned notification configurations', async () => {
    await removeConfiguration({
      functionName: 'orders',
      bucketName: 'orders-bucket',
      region: 'us-east-1',
    });

    const putInput = sentCommands[1].input;
    const configs = putInput.NotificationConfiguration.LambdaFunctionConfigurations;

    expect(configs.map((config) => config.LambdaFunctionArn)).to.deep.equal([
      'arn:aws:lambda:us-east-1:123456789012:function:orders-api',
      'arn:aws:lambda:us-east-1:123456789012:function:manual',
      'arn:aws:lambda:us-east-1:123456789012:function:external',
    ]);
  });
});
