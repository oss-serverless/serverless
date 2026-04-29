'use strict';

const ServerlessError = require('../../../serverless-error');

const genericS3ListErrorCodes = new Set([
  'AWS_S3_LIST_OBJECTS_V2_ERROR',
  'AWS_S3_LIST_OBJECT_VERSIONS_ERROR',
]);

const getErrorName = (error) => {
  if (!error || error.name === 'Error' || error.name === ServerlessError.name) return undefined;
  return error.name;
};

const getErrorCode = (error) => {
  if (!error) return undefined;

  if (error.providerError) {
    const providerErrorCode =
      error.providerError.code || error.providerError.Code || getErrorName(error.providerError);
    if (providerErrorCode) return providerErrorCode;
  }

  return error.Code || error.code || getErrorName(error);
};

const getErrorStatusCode = (error) =>
  error &&
  ((error.providerError &&
    (error.providerError.statusCode ||
      (error.providerError.$metadata && error.providerError.$metadata.httpStatusCode))) ||
    error.statusCode ||
    (error.$metadata && error.$metadata.httpStatusCode));

module.exports = (error) => {
  const errorCode = getErrorCode(error);

  return (
    errorCode === 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED' ||
    errorCode === 'AccessDenied' ||
    ((!errorCode || genericS3ListErrorCodes.has(errorCode)) && getErrorStatusCode(error) === 403)
  );
};
