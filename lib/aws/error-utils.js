'use strict';

/**
 * Error code mappings from v2 to v3
 * v2 errors used 'code' property, v3 uses 'name' property
 */
const ERROR_CODE_MAPPINGS = {
  // CloudFormation errors
  ValidationError: 'ValidationException',
  AlreadyExistsException: 'AlreadyExistsException',
  LimitExceededException: 'LimitExceededException',
  InsufficientCapabilitiesException: 'InsufficientCapabilitiesException',

  // S3 errors
  NoSuchBucket: 'NoSuchBucket',
  NoSuchKey: 'NoSuchKey',
  BucketAlreadyExists: 'BucketAlreadyExists',
  BucketAlreadyOwnedByYou: 'BucketAlreadyOwnedByYou',

  // Lambda errors
  ResourceNotFoundException: 'ResourceNotFoundException',
  ResourceConflictException: 'ResourceConflictException',
  InvalidParameterValueException: 'InvalidParameterValueException',
  TooManyRequestsException: 'TooManyRequestsException',

  // IAM errors
  NoSuchEntity: 'NoSuchEntityException',
  EntityAlreadyExists: 'EntityAlreadyExistsException',
  MalformedPolicyDocument: 'MalformedPolicyDocumentException',

  // General AWS errors
  AccessDenied: 'AccessDeniedException',
  UnauthorizedOperation: 'UnauthorizedException',
  Throttling: 'ThrottlingException',
  RequestExpired: 'RequestExpiredException',
  CredentialsError: 'CredentialsError',
  ExpiredTokenException: 'ExpiredTokenException',
};

/**
 * Transform AWS SDK v3 error to be compatible with v2 error handling
 * @param {Error} error - AWS SDK v3 error
 * @returns {Error} Transformed error with v2-compatible properties
 */
function transformV3Error(error) {
  if (!error || typeof error !== 'object') {
    return error;
  }

  // If it's already a v2-style error, return as-is
  if (error.code && !error.name) {
    return error;
  }

  // Check for credentials errors and transform them to match v2 behavior
  if (
    error.name === 'CredentialsProviderError' ||
    (error.message && error.message.includes('Could not load credentials'))
  ) {
    const ServerlessError = require('../serverless-error');
    const chalk = require('chalk');

    const errorMessage = [
      'AWS provider credentials not found.',
      ' Learn how to set up AWS provider credentials',
      ` in our docs here: <${chalk.green(
        'https://github.com/oss-serverless/serverless/blob/main/docs/guides/credentials.md'
      )}>.`,
    ].join('');

    throw Object.assign(new ServerlessError(errorMessage, 'AWS_CREDENTIALS_NOT_FOUND'), {
      providerError: Object.assign({}, error, { retryable: false }),
    });
  }

  // Create a new error object with v2-compatible properties
  const transformedError = new Error(error.message || 'Unknown AWS error');

  // Copy all original properties
  Object.assign(transformedError, error);

  // Map v3 'name' to v2 'code' for backward compatibility
  if (error.name && !error.code) {
    transformedError.code = error.name;
  }

  // Map some common v3 properties to v2 equivalents
  if (error.$metadata) {
    transformedError.statusCode = error.$metadata.httpStatusCode;
    transformedError.retryable = isRetryableError(error);
    transformedError.requestId = error.$metadata.requestId;
    transformedError.cfId = error.$metadata.cfId;
  }

  // Add providerError for compatibility with existing error handling
  transformedError.providerError = {
    ...error,
    code: transformedError.code,
    statusCode: transformedError.statusCode,
    retryable: transformedError.retryable,
  };

  return transformedError;
}

/**
 * Determine if an error is retryable
 * @param {Error} error - AWS SDK error
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(error) {
  if (!error) return false;

  // Check metadata for retry info
  if (error.$metadata) {
    const statusCode = error.$metadata.httpStatusCode;

    // 5xx errors are generally retryable
    if (statusCode >= 500) return true;

    // 429 (Too Many Requests) is retryable
    if (statusCode === 429) return true;

    // 403 (Forbidden) is generally not retryable
    if (statusCode === 403) return false;
  }

  // Check error names/codes for specific retryable errors
  const errorCode = error.name || error.code;
  const retryableErrors = [
    'ThrottlingException',
    'Throttling',
    'TooManyRequestsException',
    'RequestTimeout',
    'NetworkingError',
    'TimeoutError',
    'InternalError',
    'ServiceUnavailable',
  ];

  return retryableErrors.includes(errorCode);
}

module.exports = {
  ERROR_CODE_MAPPINGS,
  transformV3Error,
};
