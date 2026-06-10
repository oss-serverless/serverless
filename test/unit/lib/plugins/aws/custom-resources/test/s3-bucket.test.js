'use strict';

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const sinon = require('sinon');
const utils = require('../../../../../../../lib/plugins/aws/custom-resources/resources/utils');

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

describe('Custom resource S3 handler', () => {
  const context = {
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:custom-resource',
  };

  const deleteEvent = {
    RequestType: 'Delete',
    ResourceProperties: {
      FunctionName: 'orders',
      BucketName: 'orders-bucket',
    },
  };

  const makeHandler = ({ removePermission, removeConfiguration }) =>
    proxyquire('../../../../../../../lib/plugins/aws/custom-resources/resources/s3/handler', {
      '../utils': {
        ...utils,
        handlerWrapper: (wrappedHandler) => wrappedHandler,
      },
      './lib/permissions': {
        addPermission: sinon.stub().resolves(),
        removePermission,
      },
      './lib/bucket': {
        updateConfiguration: sinon.stub().resolves(),
        removeConfiguration,
      },
    }).handler;

  it('should remove notification configuration when Lambda permission is already missing', async () => {
    const removePermission = sinon.stub().rejects({ name: 'ResourceNotFoundException' });
    const removeConfiguration = sinon.stub().resolves();
    const handler = makeHandler({ removePermission, removeConfiguration });

    await handler(deleteEvent, context);

    expect(removePermission).to.have.been.calledOnce;
    expect(removeConfiguration).to.have.been.calledOnce;
  });

  it('should ignore NoSuchBucket while deleting notification configuration', async () => {
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().rejects({ name: 'NoSuchBucket' });
    const handler = makeHandler({ removePermission, removeConfiguration });

    await handler(deleteEvent, context);

    expect(removePermission).to.have.been.calledOnce;
    expect(removeConfiguration).to.have.been.calledOnce;
  });

  it('should rethrow AccessDeniedException when removing Lambda permission during delete', async () => {
    const error = Object.assign(new Error('denied'), { name: 'AccessDeniedException' });
    const removePermission = sinon.stub().rejects(error);
    const removeConfiguration = sinon.stub().resolves();
    const handler = makeHandler({ removePermission, removeConfiguration });

    await expect(handler(deleteEvent, context)).to.be.rejectedWith('denied');

    expect(removeConfiguration).to.not.have.been.called;
  });

  it('should rethrow AccessDenied when removing notification configuration during delete', async () => {
    const error = Object.assign(new Error('denied'), { name: 'AccessDenied' });
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().rejects(error);
    const handler = makeHandler({ removePermission, removeConfiguration });

    await expect(handler(deleteEvent, context)).to.be.rejectedWith('denied');

    expect(removeConfiguration).to.have.been.calledOnce;
  });
});
