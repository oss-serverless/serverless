'use strict';

const ServerlessError = require('../serverless-error');
const { hasOwn } = require('../utils/safe-object');

function getOwnValue(object, key) {
  return object != null && hasOwn(object, key) ? object[key] : undefined;
}

function getAwsErrorName(error) {
  const name = getOwnValue(error, 'name');
  if (!name || name === 'Error' || name === ServerlessError.name) return undefined;
  return name;
}

function getAwsErrorMessage(error) {
  const message = getOwnValue(error, 'message');
  return typeof message === 'string' ? message : undefined;
}

function getAwsErrorCode(error) {
  if (!error) return undefined;

  const providerError = getOwnValue(error, 'providerError');
  if (providerError) {
    const providerErrorName = getAwsErrorName(providerError);
    if (providerErrorName) return providerErrorName;

    const providerErrorCode =
      getOwnValue(providerError, 'code') || getOwnValue(providerError, 'Code');
    if (providerErrorCode) return providerErrorCode;
  }

  const name = getAwsErrorName(error);
  if (name) return name;

  const upperCode = getOwnValue(error, 'Code');
  if (upperCode) return upperCode;
  return getOwnValue(error, 'code');
}

function isAwsErrorCode(error, ...codes) {
  return codes.includes(getAwsErrorCode(error));
}

function isCloudFormationValidationErrorWithMessage(error, messageFragment) {
  const message = getAwsErrorMessage(error);
  return isAwsErrorCode(error, 'ValidationError') && Boolean(message?.includes(messageFragment));
}

function isS3GetObjectNoSuchKeyError(error) {
  return isAwsErrorCode(error, 'AWS_S3_GET_OBJECT_NO_SUCH_KEY', 'NoSuchKey');
}

function isSsmParameterNotFoundError(error) {
  return isAwsErrorCode(error, 'ParameterNotFound', 'AWS_S_S_M_GET_PARAMETER_PARAMETER_NOT_FOUND');
}

module.exports = {
  getAwsErrorCode,
  getAwsErrorMessage,
  isAwsErrorCode,
  isCloudFormationValidationErrorWithMessage,
  isS3GetObjectNoSuchKeyError,
  isSsmParameterNotFoundError,
};
