'use strict';

const inquirer = require('@serverless/utils/inquirer');
const hasLocalCredentials = require('../../aws/has-local-credentials');
const awsRequest = require('../../aws/request');

module.exports = {
  confirm: async (message, options = {}) => {
    const name = options.name || 'isConfirmed';
    return (
      await inquirer.prompt({
        message,
        type: 'confirm',
        name,
      })
    )[name];
  },
  awsRequest: async ({ serverless }, serviceConfig, method, params) => {
    const awsProvider = serverless && serverless.getProvider('aws');
    if (awsProvider) {
      // This method supports only direct service name input
      return awsProvider.request(
        serviceConfig.name || serviceConfig,
        method,
        params,
        serviceConfig.params
      );
    }
    return awsRequest(serviceConfig, method, params);
  },
  resolveInitialContext: ({ serviceDir }) => {
    return {
      isInServiceContext: Boolean(serviceDir),
      hasLocalAwsCredentials: hasLocalCredentials(),
    };
  },
};
