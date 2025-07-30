'use strict';

const { APIGatewayClient } = require('@aws-sdk/client-api-gateway');
const { ApiGatewayV2Client } = require('@aws-sdk/client-apigatewayv2');
const { CloudFormationClient } = require('@aws-sdk/client-cloudformation');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
const { CloudWatchLogsClient } = require('@aws-sdk/client-cloudwatch-logs');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { ECRClient } = require('@aws-sdk/client-ecr');
const { EventBridgeClient } = require('@aws-sdk/client-eventbridge');
const { IAMClient } = require('@aws-sdk/client-iam');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { S3Client } = require('@aws-sdk/client-s3');
const { SSMClient } = require('@aws-sdk/client-ssm');
const { STSClient } = require('@aws-sdk/client-sts');

// Map service names to their client classes
const CLIENT_MAP = {
  APIGateway: APIGatewayClient,
  ApiGatewayV2: ApiGatewayV2Client,
  CloudFormation: CloudFormationClient,
  CloudWatch: CloudWatchClient,
  CloudWatchLogs: CloudWatchLogsClient,
  CognitoIdentityProvider: CognitoIdentityProviderClient,
  ECR: ECRClient,
  EventBridge: EventBridgeClient,
  IAM: IAMClient,
  Lambda: LambdaClient,
  S3: S3Client,
  SSM: SSMClient,
  STS: STSClient,
};

class AWSClientFactory {
  constructor(baseConfig = {}) {
    this.baseConfig = baseConfig;
    this.clients = new Map();
  }

  /**
   * Get a configured AWS service client
   * @param {string} serviceName - Name of the AWS service (e.g., 'S3', 'CloudFormation')
   * @param {Object} overrideConfig - Configuration to override base config
   * @returns {Object} AWS SDK v3 client instance
   */
  getClient(serviceName, overrideConfig = {}) {
    const ClientClass = CLIENT_MAP[serviceName];
    if (!ClientClass) {
      throw new Error(`Unknown AWS service: ${serviceName}`);
    }

    // Create a cache key based on service and config
    const configKey = JSON.stringify({ serviceName, ...this.baseConfig, ...overrideConfig });

    if (!this.clients.has(configKey)) {
      const clientConfig = { ...this.baseConfig, ...overrideConfig };
      this.clients.set(configKey, new ClientClass(clientConfig));
    }

    return this.clients.get(configKey);
  }

  /**
   * Send a command to an AWS service
   * @param {string} serviceName - Name of the AWS service
   * @param {Object} command - AWS SDK v3 command instance
   * @param {Object} clientConfig - Optional client configuration override
   * @returns {Promise} Result of the AWS API call
   */
  async send(serviceName, command, clientConfig = {}) {
    const client = this.getClient(serviceName, clientConfig);
    return client.send(command);
  }
}

module.exports = AWSClientFactory;
