'use strict';

const crypto = require('crypto');
const { CloudFormation } = require('@aws-sdk/client-cloudformation');
const { getAwsClientConfig } = require('../../utils/aws');
const { sleep } = require('../../utils');
const getConfiguredStateBucketName = require('./get-configured-state-bucket-name');
const remoteStateCloudFormationTemplate = require('./remote-state-cloudformation-template.json');
const ServerlessError = require('../../serverless-error');

const COMPOSE_REMOTE_STATE_STACK_NAME = 'serverless-compose-state';
const getAwsErrorCode = (error) => error && (error.Code || error.code || error.name);

const getCloudFormationClient = (stateConfiguration = {}, context = {}) => {
  // We are enforcing us-east-1 as the intention (that might change in the future if we find a good reason)
  // is to only create one such bucket across all regions in a single AWS Account
  return new CloudFormation(
    getAwsClientConfig({
      profile: stateConfiguration.profile,
      region: 'us-east-1',
      stage: context.stage,
    })
  );
};

const monitorStackCreation = async (stackName, context, stateConfiguration) => {
  const client = getCloudFormationClient(stateConfiguration, context);
  const describeStacksResponse = await client.describeStacks({ StackName: stackName });
  const status = describeStacksResponse.Stacks[0].StackStatus;

  if (status === 'CREATE_IN_PROGRESS') {
    // TODO: REMOVE WHEN REPLACED WITH PROGRESS
    context.logVerbose('Stack deployment in progress');
    await sleep(2000);
    return await monitorStackCreation(stackName, context, stateConfiguration);
  }

  if (status === 'CREATE_COMPLETE') {
    context.logVerbose(`Deployment finished with state: ${status}`);
    return status;
  }

  throw new ServerlessError(
    `Encountered an error during S3 remote state stack deployment. Stack in status: ${status}`,
    'CANNOT_DEPLOY_S3_REMOTE_STATE_STACK'
  );
};

/**
 * @param {Record<string, any>} stateConfiguration
 * @param {import('../../Context')} context
 */
const ensureRemoteStateBucketStackExists = async (context, stateConfiguration) => {
  const client = getCloudFormationClient(stateConfiguration, context);
  const templateBody = JSON.stringify(remoteStateCloudFormationTemplate);

  // TODO: REPLACE WITH PROGRESS
  context.output.log('Creating S3 bucket for remote state');

  const bucketName = `serverless-compose-state-${crypto.randomBytes(6).toString('hex')}`;
  await client.createStack({
    StackName: COMPOSE_REMOTE_STATE_STACK_NAME,
    TemplateBody: templateBody,
    Parameters: [
      {
        ParameterKey: 'BucketName',
        ParameterValue: bucketName,
      },
    ],
  });

  await monitorStackCreation(COMPOSE_REMOTE_STATE_STACK_NAME, context, stateConfiguration);
  context.output.log('S3 bucket for remote state created successfully');
  return bucketName;
};

const getStateBucketNameFromCF = async (stateConfiguration, context) => {
  const client = getCloudFormationClient(stateConfiguration, context);
  const logicalResourceId = 'ServerlessComposeRemoteStateBucket';
  const result = await client.describeStackResource({
    StackName: COMPOSE_REMOTE_STATE_STACK_NAME,
    LogicalResourceId: logicalResourceId,
  });
  if (!result.StackResourceDetail) {
    throw new Error(
      `CloudFormation returned an empty response when fetching the stack "${COMPOSE_REMOTE_STATE_STACK_NAME}"`
    );
  }
  if (!result.StackResourceDetail.PhysicalResourceId) {
    throw new Error('The S3 bucket does not exist');
  }
  return result.StackResourceDetail.PhysicalResourceId;
};

/**
 * @param {Record<string, any>} stateConfiguration
 * @param {import('../../Context')} context
 * @returns {Promise<string>}
 */
const getStateBucketName = async (stateConfiguration, context) => {
  // 1. Check from config
  const configuredBucketName = getConfiguredStateBucketName(stateConfiguration);
  if (configuredBucketName) {
    return configuredBucketName;
  }

  // 2. Check from remote
  try {
    return await getStateBucketNameFromCF(stateConfiguration, context);
  } catch (e) {
    // If message includes 'does not exist', we need to move forward and create the stack first
    if (!(getAwsErrorCode(e) === 'ValidationError' && e.message.includes('does not exist'))) {
      throw new ServerlessError(
        `Could not retrieve S3 state bucket: ${e.message}`,
        'CANNOT_RETRIEVE_REMOTE_STATE_S3_BUCKET'
      );
    }
  }

  // 3. If stack does not exist, ensure it exists
  try {
    return await ensureRemoteStateBucketStackExists(context, stateConfiguration);
  } catch (e) {
    if (e instanceof ServerlessError) {
      throw e;
    } else {
      throw new ServerlessError(
        `Could not create remote state S3 bucket: ${e.message}`,
        'CANNOT_CREATE_REMOTE_STATE_S3_BUCKET'
      );
    }
  }
};

module.exports = getStateBucketName;
