'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getCloudFormationClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3
    const { CloudFormationClient } = require('@aws-sdk/client-cloudformation');
    const {
      ListStacksCommand,
      DeleteStackCommand,
      ListStackResourcesCommand,
      DescribeStacksCommand,
    } = require('@aws-sdk/client-cloudformation');

    const client = new CloudFormationClient({ region: 'us-east-1' });

    return {
      listStacks: (params) => client.send(new ListStacksCommand(params)),
      deleteStack: (params) => client.send(new DeleteStackCommand(params)),
      listStackResources: (params) => client.send(new ListStackResourcesCommand(params)),
      describeStacks: (params) => client.send(new DescribeStacksCommand(params)),
    };
  }
  // AWS SDK v2
  const CloudFormationService = require('aws-sdk').CloudFormation;
  return {
    listStacks: (params) => awsRequest(CloudFormationService, 'listStacks', params),
    deleteStack: (params) => awsRequest(CloudFormationService, 'deleteStack', params),
    listStackResources: (params) => awsRequest(CloudFormationService, 'listStackResources', params),
    describeStacks: (params) => awsRequest(CloudFormationService, 'describeStacks', params),
  };
};

const cf = getCloudFormationClient();

const SHARED_INFRA_TESTS_CLOUDFORMATION_STACK = 'integration-tests-deps-stack';
const SHARED_INFRA_TESTS_ACTIVE_MQ_CREDENTIALS_NAME =
  'integration-tests-active-mq-broker-credentials';
const SHARED_INFRA_TESTS_RABBITMQ_CREDENTIALS_NAME =
  'integration-tests-rabbitmq-broker-credentials';

async function findStacks(name, status) {
  const params = {};
  if (status) {
    params.StackStatusFilter = status;
  }

  async function recursiveFind(found, token) {
    if (token) params.NextToken = token;
    return cf.listStacks(params).then((result) => {
      const matches = result.StackSummaries.filter((stack) => stack.StackName.match(name));
      if (matches.length) {
        found.push(...matches);
      }
      if (result.NextToken) return recursiveFind(found, result.NextToken);
      return found;
    });
  }

  return recursiveFind([]);
}

async function deleteStack(stack) {
  const params = {
    StackName: stack,
  };

  return cf.deleteStack(params);
}

async function listStackResources(stack) {
  const params = {
    StackName: stack,
  };

  async function recursiveFind(resources, token) {
    if (token) params.NextToken = token;
    return cf.listStackResources(params).then((result) => {
      resources.push(...result.StackResourceSummaries);
      if (result.NextToken) return recursiveFind(resources, result.NextToken);
      return resources;
    });
  }

  return recursiveFind([]);
}

async function listStacks(status) {
  const params = {};
  if (status) {
    params.StackStatusFilter = status;
  }

  return cf.listStacks(params);
}

async function getStackOutputMap(name) {
  const describeStackResponse = await cf.describeStacks({
    StackName: name,
  });

  const outputsMap = new Map();
  for (const { OutputKey: key, OutputValue: value } of describeStackResponse.Stacks[0].Outputs) {
    outputsMap.set(key, value);
  }
  return outputsMap;
}

async function isDependencyStackAvailable() {
  const validStatuses = ['CREATE_COMPLETE', 'UPDATE_COMPLETE'];

  try {
    const describeStacksResponse = await cf.describeStacks({
      StackName: SHARED_INFRA_TESTS_CLOUDFORMATION_STACK,
    });
    if (validStatuses.includes(describeStacksResponse.Stacks[0].StackStatus)) {
      return true;
    }
    return false;
  } catch (e) {
    // Handle both v2 and v3 error patterns
    if (e.code === 'ValidationError' || e.name === 'ValidationException') {
      return false;
    }
    throw e;
  }
}

async function getDependencyStackOutputMap() {
  return getStackOutputMap(SHARED_INFRA_TESTS_CLOUDFORMATION_STACK);
}

module.exports = {
  findStacks,
  deleteStack,
  listStackResources,
  listStacks,
  getStackOutputMap,
  SHARED_INFRA_TESTS_CLOUDFORMATION_STACK,
  SHARED_INFRA_TESTS_ACTIVE_MQ_CREDENTIALS_NAME,
  SHARED_INFRA_TESTS_RABBITMQ_CREDENTIALS_NAME,
  isDependencyStackAvailable,
  getDependencyStackOutputMap,
};
