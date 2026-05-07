'use strict';

const expect = require('chai').expect;

const getConfiguredStateBucketName = require('../../../../../../lib/compose/state/utils/get-configured-state-bucket-name');

describe('test/unit/src/state/utils/get-configured-state-bucket-name.test.js', () => {
  it('returns existingBucket when provided', () => {
    expect(getConfiguredStateBucketName({ existingBucket: 'existing-bucket' })).to.equal(
      'existing-bucket'
    );
  });

  it('supports externalBucket as a compatibility alias', () => {
    expect(getConfiguredStateBucketName({ externalBucket: 'external-bucket' })).to.equal(
      'external-bucket'
    );
  });

  it('allows both configured bucket names when they match', () => {
    expect(
      getConfiguredStateBucketName({
        existingBucket: 'shared-bucket',
        externalBucket: 'shared-bucket',
      })
    ).to.equal('shared-bucket');
  });

  it('rejects conflicting configured bucket names', () => {
    expect(() =>
      getConfiguredStateBucketName({
        existingBucket: 'first-bucket',
        externalBucket: 'second-bucket',
      })
    )
      .to.throw()
      .and.have.property('code', 'INVALID_STATE_CONFIGURATION');
  });
});
