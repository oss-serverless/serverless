'use strict';

const { expect } = require('chai');
const ServerlessError = require('../../../../lib/serverless-error');
const awsSdkV3Error = require('../../../../lib/aws/aws-sdk-v3-error');

describe('test/unit/lib/aws/aws-sdk-v3-error.test.js', () => {
  it('extracts error codes from legacy and SDK v3 error shapes', () => {
    expect(awsSdkV3Error.getAwsErrorCode({ providerError: { code: 'LegacyCode' } })).to.equal(
      'LegacyCode'
    );
    expect(
      awsSdkV3Error.getAwsErrorCode({ providerError: { Code: 'UpperProviderCode' } })
    ).to.equal('UpperProviderCode');
    expect(awsSdkV3Error.getAwsErrorCode({ providerError: { name: 'ProviderNameCode' } })).to.equal(
      'ProviderNameCode'
    );
    expect(awsSdkV3Error.getAwsErrorCode({ providerError: {}, code: 'FallbackCode' })).to.equal(
      'FallbackCode'
    );
    expect(awsSdkV3Error.getAwsErrorCode({ Code: 'UpperCode' })).to.equal('UpperCode');
    expect(awsSdkV3Error.getAwsErrorCode({ code: 'LowerCode' })).to.equal('LowerCode');
    expect(Object.assign(new Error('boom'), { code: 'ErrorCode' })).to.have.property(
      'name',
      'Error'
    );
    expect(
      awsSdkV3Error.getAwsErrorCode(Object.assign(new Error('boom'), { code: 'ErrorCode' }))
    ).to.equal('ErrorCode');
    expect(awsSdkV3Error.getAwsErrorCode({ name: 'NameCode' })).to.equal('NameCode');
    expect(awsSdkV3Error.getAwsErrorCode()).to.equal(undefined);
  });

  it('extracts error messages from own properties only', () => {
    expect(awsSdkV3Error.getAwsErrorMessage({ message: 'own message' })).to.equal('own message');
    expect(awsSdkV3Error.getAwsErrorMessage(Object.create({ message: 'inherited' }))).to.equal(
      undefined
    );
  });

  it('prefers meaningful SDK v3 error names over legacy codes', () => {
    expect(
      awsSdkV3Error.getAwsErrorCode({
        name: 'NoSuchBucket',
        code: 'AccessDenied',
        Code: 'AccessDenied',
      })
    ).to.equal('NoSuchBucket');
    expect(
      awsSdkV3Error.getAwsErrorCode({
        providerError: {
          name: 'NoSuchBucket',
          code: 'AccessDenied',
          Code: 'AccessDenied',
        },
      })
    ).to.equal('NoSuchBucket');
  });

  it('ignores generic wrapper names when extracting error codes', () => {
    const serverlessError = new ServerlessError('wrapped', 'AWS_S3_LIST_OBJECTS_V2_NO_SUCH_BUCKET');

    expect(serverlessError).to.have.property('name', ServerlessError.name);
    expect(awsSdkV3Error.getAwsErrorCode(serverlessError)).to.equal(
      'AWS_S3_LIST_OBJECTS_V2_NO_SUCH_BUCKET'
    );
    expect(
      awsSdkV3Error.getAwsErrorCode({
        providerError: new ServerlessError('wrapped', 'AccessDenied'),
      })
    ).to.equal('AccessDenied');
  });

  it('creates S3 upload errors from SDK v3 and legacy AWS error shapes', () => {
    for (const [providerError, expectedCode, expectedExtension] of [
      [
        Object.assign(new Error('denied'), { name: 'AccessDenied' }),
        'AWS_S3_UPLOAD_ACCESS_DENIED',
        'ACCESS_DENIED',
      ],
      [
        Object.assign(new Error('forbidden'), { $metadata: { httpStatusCode: 403 } }),
        'AWS_S3_UPLOAD_HTTP_403_ERROR',
        'HTTP_403_ERROR',
      ],
      [{ code: 'SlowDown', message: 'slow down' }, 'AWS_S3_UPLOAD_SLOW_DOWN', 'SLOW_DOWN'],
      [{ code: 'ECONNRESET', message: 'socket reset' }, 'AWS_S3_UPLOAD_ECONNRESET', 'ECONNRESET'],
      [
        { Code: 'NoSuchBucket', message: 'missing bucket' },
        'AWS_S3_UPLOAD_NO_SUCH_BUCKET',
        'NO_SUCH_BUCKET',
      ],
    ]) {
      const uploadError = awsSdkV3Error.createS3UploadError(providerError);

      expect(uploadError).to.be.instanceOf(ServerlessError);
      expect(uploadError.code).to.equal(expectedCode);
      expect(uploadError.providerError).to.equal(providerError);
      expect(uploadError.providerErrorCodeExtension).to.equal(expectedExtension);
    }
  });

  it('creates generic S3 upload errors and preserves existing Serverless errors', () => {
    const providerError = new Error('upload failed');
    const uploadError = awsSdkV3Error.createS3UploadError(providerError);
    const serverlessError = new ServerlessError(
      'AWS provider credentials not found.',
      'AWS_CREDENTIALS_NOT_FOUND'
    );

    expect(uploadError).to.be.instanceOf(ServerlessError);
    expect(uploadError.message).to.equal('upload failed');
    expect(uploadError.code).to.equal('AWS_S3_UPLOAD_ERROR');
    expect(uploadError.providerError).to.equal(providerError);
    expect(uploadError.providerErrorCodeExtension).to.equal('ERROR');
    expect(awsSdkV3Error.createS3UploadError(serverlessError)).to.equal(serverlessError);
  });

  it('extracts status codes from legacy and SDK v3 error shapes', () => {
    expect(awsSdkV3Error.getAwsErrorStatusCode({ providerError: { statusCode: 403 } })).to.equal(
      403
    );
    expect(awsSdkV3Error.getAwsErrorStatusCode({ $metadata: { httpStatusCode: 404 } })).to.equal(
      404
    );
    expect(awsSdkV3Error.getAwsErrorStatusCode({ statusCode: 429 })).to.equal(429);
    expect(awsSdkV3Error.getAwsErrorStatusCode()).to.equal(undefined);
  });

  it('ignores inherited legacy error codes, names, messages, and status fields', () => {
    const inheritedCodeError = Object.create({ code: 'AccessDenied', Code: 'NoSuchBucket' });
    const inheritedNameError = Object.create({ name: 'NoSuchBucket' });
    const inheritedMessageError = Object.create({ message: 'The specified bucket does not exist' });
    const inheritedProviderError = Object.create({
      providerError: { code: 'AccessDenied', statusCode: 403 },
    });
    const inheritedMetadataError = Object.create({
      statusCode: 403,
      $metadata: { httpStatusCode: 404 },
    });
    const inheritedRegionError = Object.create({
      BucketRegion: 'eu-west-1',
      $metadata: { httpHeaders: { 'x-amz-bucket-region': 'us-west-2' } },
    });

    expect(awsSdkV3Error.getAwsErrorCode(inheritedCodeError)).to.equal(undefined);
    expect(awsSdkV3Error.getAwsErrorCode(inheritedNameError)).to.equal(undefined);
    expect(awsSdkV3Error.getAwsErrorCode(inheritedProviderError)).to.equal(undefined);
    expect(awsSdkV3Error.getAwsErrorMessage(inheritedMessageError)).to.equal(undefined);
    expect(awsSdkV3Error.getAwsErrorStatusCode(inheritedMetadataError)).to.equal(undefined);
    expect(awsSdkV3Error.getS3BucketRegion(inheritedRegionError)).to.equal(undefined);
    expect(awsSdkV3Error.isS3ListObjectsNoSuchBucketError(inheritedMessageError)).to.equal(false);
    expect(awsSdkV3Error.isS3HeadObjectForbiddenError(inheritedCodeError)).to.equal(false);
    expect(awsSdkV3Error.isS3HeadBucketNotFoundError(inheritedMetadataError)).to.equal(false);
    expect(awsSdkV3Error.isS3ListObjectsAccessDeniedError(inheritedProviderError)).to.equal(false);
  });

  it('matches generic error codes and status codes', () => {
    expect(awsSdkV3Error.isAwsErrorCode({ name: 'ValidationError' }, 'ValidationError')).to.equal(
      true
    );
    expect(awsSdkV3Error.isAwsErrorCode({ name: 'Other' }, 'ValidationError')).to.equal(false);
    expect(
      awsSdkV3Error.isAwsErrorStatusCode({ $metadata: { httpStatusCode: 403 } }, 403)
    ).to.equal(true);
    expect(
      awsSdkV3Error.isAwsErrorStatusCode({ $metadata: { httpStatusCode: 404 } }, 403)
    ).to.equal(false);
  });

  it('extracts and normalizes S3 bucket regions from SDK v3 response and error shapes', () => {
    expect(awsSdkV3Error.getS3BucketRegion({ BucketRegion: 'us-east-1' })).to.equal('us-east-1');
    expect(
      awsSdkV3Error.getS3BucketRegion({
        $metadata: { httpHeaders: { 'x-amz-bucket-region': 'us-west-2' } },
      })
    ).to.equal('us-west-2');
    expect(
      awsSdkV3Error.getS3BucketRegion({
        $response: { headers: { 'X-Amz-Bucket-Region': 'eu-central-1' } },
      })
    ).to.equal('eu-central-1');
    expect(awsSdkV3Error.getS3BucketRegion({ BucketRegion: 'EU' })).to.equal('eu-west-1');
    expect(awsSdkV3Error.getS3BucketRegion()).to.equal(undefined);
  });

  it('matches S3 ListObjectsV2 missing-bucket and access-denied shapes', () => {
    expect(
      awsSdkV3Error.isS3ListObjectsNoSuchBucketError({
        code: 'AWS_S3_LIST_OBJECTS_V2_NO_SUCH_BUCKET',
      })
    ).to.equal(true);
    expect(awsSdkV3Error.isS3ListObjectsNoSuchBucketError({ name: 'NoSuchBucket' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsNoSuchBucketError({ $metadata: { httpStatusCode: 404 } })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsNoSuchBucketError({
        message: 'The specified bucket does not exist',
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({
        code: 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED',
      })
    ).to.equal(true);
    expect(awsSdkV3Error.isS3ListObjectsAccessDeniedError({ name: 'AccessDenied' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({ $metadata: { httpStatusCode: 403 } })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({
        providerError: { code: 'AccessDenied', statusCode: 403 },
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({
        code: 'AWS_S3_LIST_OBJECTS_V2_ERROR',
        providerError: { statusCode: 403 },
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({
        providerError: { code: 'SignatureDoesNotMatch', statusCode: 403 },
      })
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3ListObjectsAccessDeniedError({
        providerError: { Code: 'SignatureDoesNotMatch', statusCode: 403 },
      })
    ).to.equal(false);
  });

  it('matches S3 GetObject, HeadObject, and HeadBucket shapes', () => {
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({
        code: 'AWS_S3_GET_OBJECT_NO_SUCH_KEY',
      })
    ).to.equal(true);
    expect(awsSdkV3Error.isS3GetObjectNoSuchKeyError({ name: 'NoSuchKey' })).to.equal(true);
    expect(awsSdkV3Error.isS3GetObjectNoSuchKeyError({ Code: 'NoSuchKey' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({
        providerError: { code: 'NoSuchKey', statusCode: 404 },
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError(Object.create({ name: 'NoSuchKey' }))
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError(Object.create({ code: 'NoSuchKey' }))
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError(Object.create({ Code: 'NoSuchKey' }))
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({ $metadata: { httpStatusCode: 404 } })
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({
        name: 'NoSuchBucket',
        $metadata: { httpStatusCode: 404 },
      })
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      })
    ).to.equal(false);
    expect(
      awsSdkV3Error.isS3GetObjectNoSuchKeyError({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      })
    ).to.equal(false);
    expect(awsSdkV3Error.isS3HeadObjectForbiddenError({ name: 'Forbidden' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3HeadObjectForbiddenError({ $metadata: { httpStatusCode: 403 } })
    ).to.equal(true);
    expect(awsSdkV3Error.isS3HeadBucketNotFoundError({ name: 'NotFound' })).to.equal(true);
    expect(awsSdkV3Error.isS3HeadBucketNotFoundError({ name: 'NoSuchBucket' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3HeadBucketNotFoundError({ $metadata: { httpStatusCode: 404 } })
    ).to.equal(true);
    expect(awsSdkV3Error.isS3HeadBucketForbiddenError({ name: 'AccessDenied' })).to.equal(true);
    expect(
      awsSdkV3Error.isS3HeadBucketForbiddenError({ $metadata: { httpStatusCode: 403 } })
    ).to.equal(true);
  });

  it('matches CloudFormation validation errors by own message only', () => {
    const missingStackError = Object.assign(new Error('Stack with id service-dev does not exist'), {
      name: 'ValidationError',
    });
    const missingResourceNamedStackError = Object.assign(
      new Error('Stack with id MyResourceStack does not exist'),
      {
        name: 'ValidationError',
      }
    );
    const missingResourceError = Object.assign(
      new Error('Resource ServerlessDeploymentBucket does not exist for stack service-dev'),
      {
        name: 'ValidationError',
      }
    );
    const missingSubscriptionFilterResourceError = Object.assign(
      new Error('Resource does not exist'),
      {
        name: 'ValidationError',
      }
    );

    expect(
      awsSdkV3Error.isCloudFormationValidationErrorWithMessage(missingStackError, 'does not exist')
    ).to.equal(true);
    expect(awsSdkV3Error.isCloudFormationMissingResourceError(missingResourceError)).to.equal(true);
    expect(
      awsSdkV3Error.isCloudFormationMissingResourceError(missingSubscriptionFilterResourceError)
    ).to.equal(true);
    expect(awsSdkV3Error.isCloudFormationMissingResourceError(missingStackError)).to.equal(false);
    expect(
      awsSdkV3Error.isCloudFormationMissingResourceError(missingResourceNamedStackError)
    ).to.equal(false);
    expect(
      awsSdkV3Error.isCloudFormationValidationErrorWithMessage(
        Object.assign(Object.create({ name: 'ValidationError' }), {
          message: 'Stack with id service-dev does not exist',
        }),
        'does not exist'
      )
    ).to.equal(false);
    expect(
      awsSdkV3Error.isCloudFormationMissingResourceError(
        Object.assign(Object.create({ name: 'ValidationError' }), {
          message: 'Resource does not exist',
        })
      )
    ).to.equal(false);
  });

  it('matches CloudFormation, CloudWatch Logs, ECR, Lambda, and SSM shapes', () => {
    expect(awsSdkV3Error.isCloudFormationValidationError({ name: 'ValidationError' })).to.equal(
      true
    );
    expect(
      awsSdkV3Error.isCloudWatchLogsResourceNotFoundError({ name: 'ResourceNotFoundException' })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isCloudWatchLogsResourceNotFoundError({
        $metadata: { httpStatusCode: 404 },
      })
    ).to.equal(true);
    expect(
      awsSdkV3Error.isCloudWatchLogsResourceNotFoundError({ name: 'AccessDeniedException' })
    ).to.equal(false);
    expect(
      awsSdkV3Error.isEcrRepositoryNotFoundError({ name: 'RepositoryNotFoundException' })
    ).to.equal(true);
    expect(awsSdkV3Error.isEcrAccessDeniedError({ name: 'AccessDeniedException' })).to.equal(true);
    expect(
      awsSdkV3Error.isEcrAccessDeniedError({
        name: 'InvalidSignatureException',
        $metadata: { httpStatusCode: 403 },
      })
    ).to.equal(false);
    expect(awsSdkV3Error.isEcrAccessDeniedError({ $metadata: { httpStatusCode: 403 } })).to.equal(
      false
    );
    expect(awsSdkV3Error.isLambdaAccessDeniedError({ name: 'AccessDeniedException' })).to.equal(
      true
    );
    expect(
      awsSdkV3Error.isLambdaAccessDeniedError({ providerError: { statusCode: 403 } })
    ).to.equal(true);
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
