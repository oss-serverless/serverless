'use strict';

/**
 * Error code mappings from v2 to v3
 * v2 errors used 'code' property, v3 uses 'name' property
 */
const ERROR_CODE_MAPPINGS = {
  // CloudFormation errors
  'ValidationError': 'ValidationException',
  'AlreadyExistsException': 'AlreadyExistsException',
  'LimitExceededException': 'LimitExceededException',
  'InsufficientCapabilitiesException': 'InsufficientCapabilitiesException',
  
  // S3 errors
  'NoSuchBucket': 'NoSuchBucket',
  'NoSuchKey': 'NoSuchKey',
  'BucketAlreadyExists': 'BucketAlreadyExists',
  'BucketAlreadyOwnedByYou': 'BucketAlreadyOwnedByYou',
  
  // Lambda errors
  'ResourceNotFoundException': 'ResourceNotFoundException',
  'ResourceConflictException': 'ResourceConflictException',
  'InvalidParameterValueException': 'InvalidParameterValueException',
  'TooManyRequestsException': 'TooManyRequestsException',
  
  // IAM errors
  'NoSuchEntity': 'NoSuchEntityException',
  'EntityAlreadyExists': 'EntityAlreadyExistsException',
  'MalformedPolicyDocument': 'MalformedPolicyDocumentException',
  
  // General AWS errors
  'AccessDenied': 'AccessDeniedException',
  'UnauthorizedOperation': 'UnauthorizedException',
  'Throttling': 'ThrottlingException',
  'RequestExpired': 'RequestExpiredException',
  'CredentialsError': 'CredentialsError',
  'ExpiredTokenException': 'ExpiredTokenException',
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

/**
 * Check if error indicates missing credentials
 * @param {Error} error - AWS SDK error
 * @returns {boolean} Whether error is due to missing credentials
 */
function isCredentialsError(error) {
  if (!error) return false;
  
  const errorCode = error.name || error.code;
  const credentialsErrors = [
    'CredentialsError',
    'NoCredentialsError',
    'ExpiredTokenException',
    'InvalidUserID.NotFound',
    'SignatureDoesNotMatch',
  ];

  return credentialsErrors.includes(errorCode) || 
         (error.message && error.message.includes('Missing credentials'));
}

/**
 * Get a user-friendly error message for AWS errors
 * @param {Error} error - AWS SDK error
 * @returns {string} User-friendly error message
 */
function getFriendlyErrorMessage(error) {
  if (!error) return 'Unknown error occurred';

  const errorCode = error.name || error.code;
  
  // Specific error message mappings
  const friendlyMessages = {
    'ValidationException': 'Invalid parameters provided',
    'AlreadyExistsException': 'Resource already exists',
    'NoSuchBucket': 'S3 bucket does not exist',
    'NoSuchKey': 'S3 object does not exist',
    'ResourceNotFoundException': 'AWS resource not found',
    'AccessDeniedException': 'Access denied - check your permissions',
    'ThrottlingException': 'Request rate exceeded - please retry',
    'CredentialsError': 'Invalid AWS credentials',
    'ExpiredTokenException': 'AWS credentials have expired',
  };

  return friendlyMessages[errorCode] || error.message || `AWS Error: ${errorCode}`;
}

/**
 * Extract the root cause error from a chain of errors
 * @param {Error} error - Top-level error
 * @returns {Error} Root cause error
 */
function getRootCauseError(error) {
  let rootError = error;
  
  while (rootError && (rootError.originalError || rootError.cause)) {
    rootError = rootError.originalError || rootError.cause;
  }
  
  return rootError || error;
}

/**
 * Create a standardized error object from various error types
 * @param {Error|string} error - Error object or message
 * @param {string} service - AWS service name
 * @param {string} operation - AWS operation name
 * @returns {Error} Standardized error object
 */
function createStandardError(error, service, operation) {
  let standardError;
  
  if (typeof error === 'string') {
    standardError = new Error(error);
  } else if (error instanceof Error) {
    standardError = error;
  } else {
    standardError = new Error('Unknown error');
  }
  
  // Add context information
  standardError.service = service;
  standardError.operation = operation;
  standardError.timestamp = new Date().toISOString();
  
  return transformV3Error(standardError);
}

module.exports = {
  ERROR_CODE_MAPPINGS,
  transformV3Error,
  isRetryableError,
  isCredentialsError,
  getFriendlyErrorMessage,
  getRootCauseError,
  createStandardError,
};