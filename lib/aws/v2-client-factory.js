'use strict';

const memoize = require('memoizee');
const sdk = require('./sdk-v2');
const deepSortObjectByKey = require('../utils/deep-sort-object-by-key');

// Map service names to their SDK v2 classes
const SERVICE_MAP = {
  APIGateway: sdk.APIGateway,
  ApiGatewayV2: sdk.ApiGatewayV2,
  CloudFormation: sdk.CloudFormation,
  CloudWatch: sdk.CloudWatch,
  CloudWatchLogs: sdk.CloudWatchLogs,
  CognitoIdentityServiceProvider: sdk.CognitoIdentityServiceProvider,
  DynamoDB: sdk.DynamoDB,
  ECR: sdk.ECR,
  EventBridge: sdk.EventBridge,
  IAM: sdk.IAM,
  Iot: sdk.Iot,
  IotData: sdk.IotData,
  Kafka: sdk.Kafka,
  Kinesis: sdk.Kinesis,
  Lambda: sdk.Lambda,
  MQ: sdk.MQ,
  S3: sdk.S3,
  SecretsManager: sdk.SecretsManager,
  SNS: sdk.SNS,
  SQS: sdk.SQS,
  STS: sdk.STS,
};

class AWSV2ClientFactory {
  constructor(baseConfig = {}) {
    this.baseConfig = baseConfig;
    this.clients = new Map();

    // Create memoized request function for response caching
    this.memoizedRequest = memoize(this._executeRequest.bind(this), {
      promise: true,
      normalizer: ([serviceName, method, params, clientConfig]) => {
        return [
          serviceName,
          method,
          JSON.stringify(deepSortObjectByKey(params)),
          JSON.stringify(deepSortObjectByKey(clientConfig)),
        ].join('|');
      },
    });
  }

  /**
   * Get a configured AWS service client
   * @param {string} serviceName - Name of the AWS service (e.g., 'S3', 'CloudFormation')
   * @param {Object} overrideConfig - Configuration to override base config
   * @returns {Object} AWS SDK v2 service instance
   */
  getClient(serviceName, overrideConfig = {}) {
    const ServiceClass = SERVICE_MAP[serviceName];
    if (!ServiceClass) {
      throw new Error(`Unknown AWS service: ${serviceName}`);
    }

    // Create cache key - include service + sorted config for consistent keys
    const configKey = JSON.stringify({
      serviceName,
      ...deepSortObjectByKey({ ...this.baseConfig, ...overrideConfig }),
    });

    if (!this.clients.has(configKey)) {
      const clientConfig = { ...this.baseConfig, ...overrideConfig };
      this.clients.set(configKey, new ServiceClass(clientConfig));
    }

    return this.clients.get(configKey);
  }

  /**
   * Execute an AWS request with optional response caching
   * @param {string} serviceName - Name of the AWS service
   * @param {string} method - Method to call on the service
   * @param {Object} params - Parameters for the AWS API call
   * @param {Object} clientConfig - Client configuration
   * @param {Object} options - Request options
   * @param {boolean} options.useCache - Whether to cache the response
   * @returns {Promise} Result of the AWS API call
   */
  async request(serviceName, method, params, clientConfig = {}, options = {}) {
    const { useCache = false } = options;

    if (useCache) {
      return this.memoizedRequest(serviceName, method, params, clientConfig);
    }

    return this._executeRequest(serviceName, method, params, clientConfig);
  }

  /**
   * Execute the actual AWS request
   * @private
   */
  async _executeRequest(serviceName, method, params, clientConfig) {
    const client = this.getClient(serviceName, clientConfig);
    return client[method](params).promise();
  }

  /**
   * Clear the client cache
   */
  clearCache() {
    this.clients.clear();
    // Clear response cache if it exists
    if (this.memoizedRequest.clear) {
      this.memoizedRequest.clear();
    }
  }

  /**
   * Update the base configuration for all future clients
   * @param {Object} newConfig - New base configuration
   */
  updateBaseConfig(newConfig) {
    this.baseConfig = { ...this.baseConfig, ...newConfig };
    // Clear cache to force recreation with new config
    this.clearCache();
  }

  /**
   * Get list of supported AWS services
   * @returns {Array} Array of supported service names
   */
  getSupportedServices() {
    return Object.keys(SERVICE_MAP);
  }
}

module.exports = AWSV2ClientFactory;
