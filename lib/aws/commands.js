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
  GetRestApisCommand,
  GetDeploymentsCommand,
  GetStageCommand,
} = require('@aws-sdk/client-api-gateway');

// API Gateway V2 Commands
const { GetApiCommand } = require('@aws-sdk/client-apigatewayv2');

// CloudFormation Commands
const {
  CreateStackCommand,
  CreateChangeSetCommand,
  DeleteChangeSetCommand,
  DescribeChangeSetCommand,
  ExecuteChangeSetCommand,
  UpdateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  DescribeStackResourcesCommand,
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
  DescribeSubscriptionFiltersCommand,
  PutSubscriptionFilterCommand,
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
  ListPoliciesCommand,
} = require('@aws-sdk/client-iam');

// Lambda Commands
const {
  GetFunctionCommand,
  UpdateFunctionConfigurationCommand,
  UpdateFunctionCodeCommand,
  DeleteFunctionCommand,
  InvokeCommand,
  ListVersionsByFunctionCommand,
  ListAliasesCommand,
  GetLayerVersionCommand,
  AddPermissionCommand,
  RemovePermissionCommand,
  ListFunctionsCommand,
  ListLayersCommand,
  ListLayerVersionsCommand,
  DeleteLayerVersionCommand,
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
  CreateBucketCommand,
  GetBucketEncryptionCommand,
  PutBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketLoggingCommand,
  PutBucketVersioningCommand,
  PutBucketLoggingCommand,
  GetBucketAccelerateConfigurationCommand,
  PutBucketAccelerateConfigurationCommand,
  PutBucketPolicyCommand,
  GetBucketTaggingCommand,
  PutBucketTaggingCommand,
  DeleteBucketTaggingCommand,
  GetPublicAccessBlockCommand,
  PutPublicAccessBlockCommand,
  DeletePublicAccessBlockCommand,
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
    getRestApis: GetRestApisCommand,
    getDeployments: GetDeploymentsCommand,
    getStage: GetStageCommand,
  },

  ApiGatewayV2: {
    getApi: GetApiCommand,
  },

  CloudFormation: {
    createStack: CreateStackCommand,
    createChangeSet: CreateChangeSetCommand,
    deleteChangeSet: DeleteChangeSetCommand,
    describeChangeSet: DescribeChangeSetCommand,
    executeChangeSet: ExecuteChangeSetCommand,
    updateStack: UpdateStackCommand,
    deleteStack: DeleteStackCommand,
    describeStacks: DescribeStacksCommand,
    describeStackResources: DescribeStackResourcesCommand,
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
    describeSubscriptionFilters: DescribeSubscriptionFiltersCommand,
    putSubscriptionFilter: PutSubscriptionFilterCommand,
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
    listPolicies: ListPoliciesCommand,
  },

  Lambda: {
    getFunction: GetFunctionCommand,
    updateFunctionConfiguration: UpdateFunctionConfigurationCommand,
    updateFunctionCode: UpdateFunctionCodeCommand,
    deleteFunction: DeleteFunctionCommand,
    invoke: InvokeCommand,
    listVersionsByFunction: ListVersionsByFunctionCommand,
    listAliases: ListAliasesCommand,
    listFunctions: ListFunctionsCommand,
    listLayers: ListLayersCommand,
    listLayerVersions: ListLayerVersionsCommand,
    getLayerVersion: GetLayerVersionCommand,
    deleteLayerVersion: DeleteLayerVersionCommand,
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
    createBucket: CreateBucketCommand,
    getBucketEncryption: GetBucketEncryptionCommand,
    putBucketEncryption: PutBucketEncryptionCommand,
    getBucketVersioning: GetBucketVersioningCommand,
    getBucketLogging: GetBucketLoggingCommand,
    putBucketVersioning: PutBucketVersioningCommand,
    putBucketLogging: PutBucketLoggingCommand,
    getBucketAccelerateConfiguration: GetBucketAccelerateConfigurationCommand,
    putBucketAccelerateConfiguration: PutBucketAccelerateConfigurationCommand,
    putBucketPolicy: PutBucketPolicyCommand,
    getBucketTagging: GetBucketTaggingCommand,
    putBucketTagging: PutBucketTaggingCommand,
    deleteBucketTagging: DeleteBucketTaggingCommand,
    getPublicAccessBlock: GetPublicAccessBlockCommand,
    putPublicAccessBlock: PutPublicAccessBlockCommand,
    deletePublicAccessBlock: DeletePublicAccessBlockCommand,
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
  if (serviceName === 'S3' && methodName === 'upload') {
    return {
      _isUploadRequest: true,
      params,
    };
  }

  const CommandClass = getCommand(serviceName, methodName);

  return new CommandClass(params);
}

module.exports = {
  createCommand,
};
