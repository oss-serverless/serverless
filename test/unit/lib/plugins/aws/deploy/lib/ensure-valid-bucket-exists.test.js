'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const ensureValidBucketExists = require('../../../../../../../lib/plugins/aws/deploy/lib/ensure-valid-bucket-exists');

describe('ensureValidBucketExists', () => {
  it('uses an existing S3 client promise for custom deployment bucket validation', async () => {
    const send = sinon.stub().resolves({});
    const context = {
      bucketName: 'deployment-bucket',
      provider: {
        getAwsSdkV3Config: sinon
          .stub()
          .throws(new Error('Expected existing S3 client to be reused')),
        getRegion: sinon.stub().returns('us-east-1'),
      },
      serverless: {
        service: {
          provider: {
            deploymentBucket: 'deployment-bucket',
          },
        },
      },
      setBucketName: sinon.stub().resolves(),
      s3ClientPromise: Promise.resolve({ send }),
      ...ensureValidBucketExists,
    };

    await context.ensureValidBucketExists();

    expect(context.provider.getAwsSdkV3Config).to.not.have.been.called;
    expect(send).to.have.been.calledOnce;
    expect(send.firstCall.args[0]).to.be.instanceOf(HeadBucketCommand);
    expect(send.firstCall.args[0].input).to.deep.equal({ Bucket: 'deployment-bucket' });
  });
});
