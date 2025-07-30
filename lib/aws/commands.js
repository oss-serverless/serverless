'use strict';

// API Gateway Commands
const {
  GetAccountCommand,
  UpdateAccountCommand,
  GetApiKeyCommand,
  CreateStageCommand,
  GetUsagePlansCommand,
  UpdateUsagePlanCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateStageCommand,
} = require('@aws-sdk/client-api-gateway');

// API Gateway V2 Commands
const { GetApiCommand } = require('@aws-sdk/client-apigatewayv2');

// CloudFormation Commands
const {
  CreateStackCommand,
  CreateChangeSetCommand,
  DeleteChangeSetCommand,
  ExecuteChangeSetCommand,
  UpdateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  ValidateTemplateCommand,
  SetStackPolicyCommand,
  GetTemplateCommand,
  ListStackResourcesCommand,
  DescribeStackResourceCommand,
  DescribeStackEventsCommand,
  ListExportsCommand,
} = require('@aws-sdk/client-cloudformation');

// CloudWatch Commands
const { GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

// CloudWatch Logs Commands
const {
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  DeleteSubscriptionFilterCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

// Cognito Identity Provider Commands
const {
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

// ECR Commands
const {
  DeleteRepositoryCommand,
  DescribeRepositoriesCommand,
  GetAuthorizationTokenCommand,
  CreateRepositoryCommand,
  DescribeImagesCommand,
} = require('@aws-sdk/client-ecr');

// EventBridge Commands
const {
  CreateEventBusCommand,
  DeleteEventBusCommand,
  PutRuleCommand,
  DeleteRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} = require('@aws-sdk/client-eventbridge');

// IAM Commands
const {
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
} = require('@aws-sdk/client-iam');

// Lambda Commands
const {
  GetFunctionCommand,
  UpdateFunctionConfigurationCommand,
  UpdateFunctionCodeCommand,
  InvokeCommand,
  ListVersionsByFunctionCommand,
  GetLayerVersionCommand,
  AddPermissionCommand,
  RemovePermissionCommand,
} = require('@aws-sdk/client-lambda');

// S3 Commands
const {
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  GetBucketLocationCommand,
  HeadBucketCommand,
  GetBucketNotificationConfigurationCommand,
  PutBucketNotificationConfigurationCommand,
} = require('@aws-sdk/client-s3');

// SSM Commands
const { GetParameterCommand } = require('@aws-sdk/client-ssm');

// STS Commands
const { GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

/**
 * Map v2 method names to v3 command classes
 * Format: { ServiceName: { methodName: CommandClass } }
 */
const COMMAND_MAP = {
  APIGateway: {
    getAccount: GetAccountCommand,
    updateAccount: UpdateAccountCommand,
    getApiKey: GetApiKeyCommand,
    createStage: CreateStageCommand,
    getUsagePlans: GetUsagePlansCommand,
    updateUsagePlan: UpdateUsagePlanCommand,
    tagResource: TagResourceCommand,
    untagResource: UntagResourceCommand,
    updateStage: UpdateStageCommand,
  },

  ApiGatewayV2: {
    getApi: GetApiCommand,
  },

  CloudFormation: {
    createStack: CreateStackCommand,
    createChangeSet: CreateChangeSetCommand,
    deleteChangeSet: DeleteChangeSetCommand,
    executeChangeSet: ExecuteChangeSetCommand,
    updateStack: UpdateStackCommand,
    deleteStack: DeleteStackCommand,
    describeStacks: DescribeStacksCommand,
    validateTemplate: ValidateTemplateCommand,
    setStackPolicy: SetStackPolicyCommand,
    getTemplate: GetTemplateCommand,
    listStackResources: ListStackResourcesCommand,
    describeStackResource: DescribeStackResourceCommand,
    describeStackEvents: DescribeStackEventsCommand,
    listExports: ListExportsCommand,
  },

  CloudWatch: {
    getMetricStatistics: GetMetricStatisticsCommand,
  },

  CloudWatchLogs: {
    describeLogStreams: DescribeLogStreamsCommand,
    filterLogEvents: FilterLogEventsCommand,
    deleteSubscriptionFilter: DeleteSubscriptionFilterCommand,
  },

  CognitoIdentityProvider: {
    listUserPools: ListUserPoolsCommand,
    describeUserPool: DescribeUserPoolCommand,
    updateUserPool: UpdateUserPoolCommand,
  },

  ECR: {
    deleteRepository: DeleteRepositoryCommand,
    describeRepositories: DescribeRepositoriesCommand,
    getAuthorizationToken: GetAuthorizationTokenCommand,
    createRepository: CreateRepositoryCommand,
    describeImages: DescribeImagesCommand,
  },

  EventBridge: {
    createEventBus: CreateEventBusCommand,
    deleteEventBus: DeleteEventBusCommand,
    putRule: PutRuleCommand,
    deleteRule: DeleteRuleCommand,
    putTargets: PutTargetsCommand,
    removeTargets: RemoveTargetsCommand,
  },

  IAM: {
    getRole: GetRoleCommand,
    listAttachedRolePolicies: ListAttachedRolePoliciesCommand,
    createRole: CreateRoleCommand,
    attachRolePolicy: AttachRolePolicyCommand,
  },

  Lambda: {
    getFunction: GetFunctionCommand,
    updateFunctionConfiguration: UpdateFunctionConfigurationCommand,
    updateFunctionCode: UpdateFunctionCodeCommand,
    invoke: InvokeCommand,
    listVersionsByFunction: ListVersionsByFunctionCommand,
    getLayerVersion: GetLayerVersionCommand,
    addPermission: AddPermissionCommand,
    removePermission: RemovePermissionCommand,
  },

  S3: {
    listObjectsV2: ListObjectsV2Command,
    listObjectVersions: ListObjectVersionsCommand,
    deleteObjects: DeleteObjectsCommand,
    headObject: HeadObjectCommand,
    putObject: PutObjectCommand,
    getObject: GetObjectCommand,
    getBucketLocation: GetBucketLocationCommand,
    headBucket: HeadBucketCommand,
    getBucketNotificationConfiguration: GetBucketNotificationConfigurationCommand,
    putBucketNotificationConfiguration: PutBucketNotificationConfigurationCommand,
    // Note: upload is handled separately as it's not a direct API call
  },

  SSM: {
    getParameter: GetParameterCommand,
  },

  STS: {
    getCallerIdentity: GetCallerIdentityCommand,
  },
};

/**
 * Get command class for a service method
 * @param {string} serviceName - AWS service name
 * @param {string} methodName - Method name from v2 SDK
 * @returns {Function} Command class constructor
 */
function getCommand(serviceName, methodName) {
  const serviceCommands = COMMAND_MAP[serviceName];
  if (!serviceCommands) {
    throw new Error(`Unknown AWS service: ${serviceName}`);
  }

  const CommandClass = serviceCommands[methodName];
  if (!CommandClass) {
    throw new Error(`Unknown method '${methodName}' for service '${serviceName}'`);
  }

  return CommandClass;
}

/**
 * Create a command instance for a service method
 * @param {string} serviceName - AWS service name
 * @param {string} methodName - Method name from v2 SDK
 * @param {Object} params - Parameters for the command
 * @returns {Object} Command instance
 */
function createCommand(serviceName, methodName, params = {}) {
  const CommandClass = getCommand(serviceName, methodName);
  return new CommandClass(params);
}

module.exports = {
  createCommand,
};
