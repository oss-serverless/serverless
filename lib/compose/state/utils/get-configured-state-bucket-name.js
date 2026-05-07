'use strict';

const ServerlessError = require('../../serverless-error');

module.exports = (stateConfiguration = {}) => {
  const { existingBucket, externalBucket } = stateConfiguration;

  if (existingBucket && externalBucket && existingBucket !== externalBucket) {
    throw new ServerlessError(
      'State configuration cannot define both "existingBucket" and "externalBucket" with different values.',
      'INVALID_STATE_CONFIGURATION'
    );
  }

  return existingBucket || externalBucket || null;
};
