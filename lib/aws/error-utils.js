'use strict';

const ServerlessError = require('../serverless-error');
const colors = require('../utils/colors');
const credentialsHelpUrl = require('./credentials-help-url');

const normalizerPattern = /(?<!^)([A-Z])/g;

const normalizeErrorCodePostfix = (name) => {
  return String(name).replace(normalizerPattern, '_$1').toUpperCase();
};

function isCredentialsError(error) {
  if (!error) return false;

  const code = error.code || error.name;
  const message = error.message || '';

  return (
    code === 'CredentialsProviderError' ||
    code === 'CredentialsError' ||
    message.startsWith('Missing credentials in config') ||
    message.includes('Could not load credentials') ||
    message.includes('Resolved credential object is not valid')
  );
}

function createCredentialsNotFoundError(error) {
  let bottomError = error || {};
  while (
    bottomError.originalError &&
    bottomError.message &&
    !bottomError.message.startsWith('EC2 Metadata')
  ) {
    bottomError = bottomError.originalError;
  }

  const message = bottomError.message || (error && error.message) || '';
  const errorMessage =
    message && !message.startsWith('EC2 Metadata')
      ? message
      : [
          'AWS provider credentials not found.',
          ' Learn how to set up AWS provider credentials',
          ` in our docs here: <${colors.green(credentialsHelpUrl)}>`,
          '.',
        ].join('');

  return Object.assign(new ServerlessError(errorMessage, 'AWS_CREDENTIALS_NOT_FOUND'), {
    providerError: Object.assign({}, error, { retryable: false }),
  });
}

function isRetryableError(error) {
  if (!error) return false;

  const statusCode = error.statusCode || (error.$metadata && error.$metadata.httpStatusCode);

  if (statusCode >= 500) return true;
  if (statusCode === 429) return true;
  if (statusCode === 403) return false;

  if (error.$retryable) return true;
  if (error.retryable != null) return Boolean(error.retryable);

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

function toV2ProviderError(error) {
  if (!error || typeof error !== 'object') return error;

  const metadata = error.$metadata || {};
  const providerError = Object.assign({}, error);

  providerError.code = error.code || error.name || error.Code || 'Error';
  providerError.statusCode = error.statusCode || metadata.httpStatusCode;
  providerError.retryable = isRetryableError(providerError);

  if (metadata.requestId && !providerError.requestId) providerError.requestId = metadata.requestId;
  if (metadata.extendedRequestId && !providerError.extendedRequestId) {
    providerError.extendedRequestId = metadata.extendedRequestId;
  }
  if (metadata.cfId && !providerError.cfId) providerError.cfId = metadata.cfId;

  return providerError;
}

function createAwsServerlessError({ error, serviceName, methodName }) {
  if (isCredentialsError(error)) return createCredentialsNotFoundError(error);

  const providerError = toV2ProviderError(error);
  const message = error && error.message != null ? error.message : String(providerError.code);
  const providerErrorCodeExtension = (() => {
    if (!providerError.code) return 'ERROR';
    if (typeof providerError.code === 'number') return `HTTP_${providerError.code}_ERROR`;
    return normalizeErrorCodePostfix(providerError.code);
  })();

  return Object.assign(
    new ServerlessError(
      message,
      `AWS_${normalizeErrorCodePostfix(serviceName)}_${normalizeErrorCodePostfix(
        methodName
      )}_${providerErrorCodeExtension}`
    ),
    {
      providerError,
      providerErrorCodeExtension,
    }
  );
}

function transformV3Error(error) {
  if (!error || typeof error !== 'object') return error;
  if (isCredentialsError(error)) throw createCredentialsNotFoundError(error);

  const providerError = toV2ProviderError(error);
  const transformedError = new Error(error.message || 'Unknown AWS error');
  Object.assign(transformedError, error, {
    code: providerError.code,
    statusCode: providerError.statusCode,
    retryable: providerError.retryable,
    requestId: providerError.requestId,
    cfId: providerError.cfId,
    providerError,
  });

  return transformedError;
}

module.exports = {
  createAwsServerlessError,
  createCredentialsNotFoundError,
  isCredentialsError,
  isRetryableError,
  normalizeErrorCodePostfix,
  toV2ProviderError,
  transformV3Error,
};
