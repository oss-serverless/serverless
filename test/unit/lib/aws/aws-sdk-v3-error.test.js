'use strict';

const { expect } = require('chai');
const awsSdkV3Error = require('../../../../lib/aws/aws-sdk-v3-error');

describe('test/unit/lib/aws/aws-sdk-v3-error.test.js', () => {
  it('extracts AWS error codes and messages from own properties only', () => {
    expect(awsSdkV3Error.getAwsErrorCode({ name: 'NoSuchKey' })).to.equal('NoSuchKey');
    expect(awsSdkV3Error.getAwsErrorCode({ Code: 'ValidationError' })).to.equal('ValidationError');
    expect(awsSdkV3Error.getAwsErrorCode({ code: 'ParameterNotFound' })).to.equal(
      'ParameterNotFound'
    );
    expect(
      awsSdkV3Error.getAwsErrorCode({ providerError: { code: 'ProviderErrorCode' } })
    ).to.equal('ProviderErrorCode');
    expect(awsSdkV3Error.getAwsErrorMessage({ message: 'own message' })).to.equal('own message');

    expect(awsSdkV3Error.getAwsErrorCode(Object.create({ name: 'NoSuchKey' }))).to.equal(undefined);
    expect(awsSdkV3Error.getAwsErrorCode(Object.create({ Code: 'ValidationError' }))).to.equal(
      undefined
    );
    expect(awsSdkV3Error.getAwsErrorCode(Object.create({ code: 'ParameterNotFound' }))).to.equal(
      undefined
    );
    expect(awsSdkV3Error.getAwsErrorMessage(Object.create({ message: 'inherited' }))).to.equal(
      undefined
    );
  });

  it('matches variable-source missing-resource errors safely', () => {
    expect(
      awsSdkV3Error.isCloudFormationValidationErrorWithMessage(
        Object.assign(new Error('Stack with id service-dev does not exist'), {
          name: 'ValidationError',
        }),
        'does not exist'
      )
    ).to.equal(true);
    expect(
      awsSdkV3Error.isCloudFormationValidationErrorWithMessage(
        Object.assign(Object.create({ name: 'ValidationError' }), {
          message: 'Stack with id service-dev does not exist',
        }),
        'does not exist'
      )
    ).to.equal(false);
    expect(awsSdkV3Error.isS3GetObjectNoSuchKeyError({ name: 'NoSuchKey' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({ code: 'AWS_S3_GET_OBJECT_NO_SUCH_KEY' })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError(Object.create({ name: 'NoSuchKey' }))
    ).to.equal(false);
    expect(awsSdkV3Error.isSsmParameterNotFoundError({ name: 'ParameterNotFound' })).to.equal(true);
    expect(
      awsSdkV3Error.isSsmParameterNotFoundError({
        code: 'AWS_S_S_M_GET_PARAMETER_PARAMETER_NOT_FOUND',
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isSsmParameterNotFoundError(Object.create({ name: 'ParameterNotFound' }))
    ).to.equal(false);
  });
});
