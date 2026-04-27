'use strict';

const chai = require('chai');

const { expect } = chai;

describe('test/unit/lib/aws/error-utils.test.js', () => {
  const {
    createAwsServerlessError,
    isRetryableError,
    transformV3Error,
  } = require('../../../../lib/aws/error-utils');

  it('wraps v3 errors with v2-style Serverless error codes', () => {
    const error = Object.assign(new Error('missing object'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404, requestId: 'request-id' },
    });

    const wrappedError = createAwsServerlessError({
      error,
      serviceName: 'S3',
      methodName: 'getObject',
    });

    expect(wrappedError.code).to.equal('AWS_S3_GET_OBJECT_NO_SUCH_KEY');
    expect(wrappedError.providerError).to.include({
      code: 'NoSuchKey',
      statusCode: 404,
      requestId: 'request-id',
    });
  });

  it('normalizes retryable v3 status codes', () => {
    expect(isRetryableError({ $metadata: { httpStatusCode: 500 } })).to.equal(true);
    expect(isRetryableError({ $metadata: { httpStatusCode: 429 } })).to.equal(true);
    expect(isRetryableError({ $metadata: { httpStatusCode: 403 } })).to.equal(false);
  });

  it('transforms credential provider errors to credentials not found errors', () => {
    expect(() =>
      transformV3Error(
        Object.assign(new Error('Could not load credentials from any providers'), {
          name: 'CredentialsProviderError',
        })
      )
    )
      .to.throw()
      .and.have.property('code', 'AWS_CREDENTIALS_NOT_FOUND');
  });
});
