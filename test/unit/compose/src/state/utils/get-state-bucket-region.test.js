'use strict';

const chai = require('chai');
const { mockClient } = require('aws-sdk-client-mock');
const { S3Client, GetBucketLocationCommand } = require('@aws-sdk/client-s3');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const getStateBucketRegion = require('../../../../../../lib/compose/state/utils/get-state-bucket-region');

const expect = chai.expect;

describe('test/unit/src/state/utils/get-state-bucket-region.test.js', () => {
  let s3Mock;
  before(() => {
    s3Mock = mockClient(S3Client);
  });

  beforeEach(() => {
    s3Mock.reset();
  });

  const bucketName = 'test-bucket';

  it('correctly resolves region for `us-east-1` bucket', async () => {
    s3Mock.on(GetBucketLocationCommand).resolves({ LocationConstraint: undefined });
    expect(await getStateBucketRegion(bucketName)).to.equal('us-east-1');
  });

  it('correctly resolves region for non `us-east-1` bucket', async () => {
    s3Mock.on(GetBucketLocationCommand).resolves({ LocationConstraint: 'eu-central-1' });
    expect(await getStateBucketRegion(bucketName)).to.equal('eu-central-1');
  });

  it('normalizes the legacy `EU` region alias', async () => {
    s3Mock.on(GetBucketLocationCommand).resolves({ LocationConstraint: 'EU' });
    expect(await getStateBucketRegion(bucketName)).to.equal('eu-west-1');
  });

  it('rejects when bucket cannot be found', async () => {
    const bucketDoesNotExistError = new Error('No such bucket');
    bucketDoesNotExistError.Code = 'NoSuchBucket';

    s3Mock.on(GetBucketLocationCommand).rejects(bucketDoesNotExistError);
    await expect(getStateBucketRegion(bucketName)).to.be.eventually.rejected.and.have.property(
      'code',
      'CANNOT_FIND_PROVIDED_REMOTE_STATE_BUCKET'
    );
  });

  it('rejects when SDK v3 reports bucket cannot be found by error name', async () => {
    const bucketDoesNotExistError = new Error('No such bucket');
    bucketDoesNotExistError.name = 'NoSuchBucket';

    s3Mock.on(GetBucketLocationCommand).rejects(bucketDoesNotExistError);
    await expect(getStateBucketRegion(bucketName)).to.be.eventually.rejected.and.have.property(
      'code',
      'CANNOT_FIND_PROVIDED_REMOTE_STATE_BUCKET'
    );
  });

  it('rejects when access to bucket is denied', async () => {
    const bucketCannotBeAccessedError = new Error('No such bucket');
    bucketCannotBeAccessedError.Code = 'AccessDenied';

    s3Mock.on(GetBucketLocationCommand).rejects(bucketCannotBeAccessedError);
    await expect(getStateBucketRegion(bucketName)).to.be.eventually.rejected.and.have.property(
      'code',
      'CANNOT_ACCESS_PROVIDED_REMOTE_STATE_BUCKET'
    );
  });

  it('rejects when SDK v3 reports bucket access denial by error name', async () => {
    const bucketCannotBeAccessedError = new Error('No such bucket');
    bucketCannotBeAccessedError.name = 'AccessDenied';

    s3Mock.on(GetBucketLocationCommand).rejects(bucketCannotBeAccessedError);
    await expect(getStateBucketRegion(bucketName)).to.be.eventually.rejected.and.have.property(
      'code',
      'CANNOT_ACCESS_PROVIDED_REMOTE_STATE_BUCKET'
    );
  });

  it('rejects on generic error', async () => {
    s3Mock.on(GetBucketLocationCommand).rejects(new Error('failure'));
    await expect(getStateBucketRegion(bucketName)).to.be.eventually.rejected.and.have.property(
      'code',
      'GENERIC_CANNOT_ACCESS_PROVIDED_REMOTE_STATE_BUCKET'
    );
  });

  it('uses profile-aware AWS client config for bucket lookups', async () => {
    const getBucketLocation = sinon.stub().resolves({ LocationConstraint: 'eu-central-1' });
    const S3 = sinon.stub().callsFake(() => ({ getBucketLocation }));
    const getAwsClientConfig = sinon.stub().returns({
      region: 'us-east-1',
      credentials: 'creds',
      retryMode: 'standard',
    });

    const getStateBucketRegionWithStubs = proxyquire
      .noCallThru()
      .load('../../../../../../lib/compose/state/utils/get-state-bucket-region', {
        '@aws-sdk/client-s3': { S3 },
        '../../utils/aws/get-client-config': getAwsClientConfig,
      });

    expect(
      await getStateBucketRegionWithStubs(bucketName, { profile: 'team' }, { stage: 'prod' })
    ).to.equal('eu-central-1');
    expect(getAwsClientConfig).to.have.been.calledOnceWithExactly({
      profile: 'team',
      region: 'us-east-1',
      stage: 'prod',
    });
    expect(S3).to.have.been.calledOnceWithExactly({
      region: 'us-east-1',
      credentials: 'creds',
      retryMode: 'standard',
    });
  });
});
