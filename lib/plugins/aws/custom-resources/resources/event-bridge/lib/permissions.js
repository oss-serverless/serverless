'use strict';

const { MAX_AWS_REQUEST_TRY } = require('../../utils');
const { getEventBusName } = require('./utils');
const {
  LambdaClient,
  AddPermissionCommand,
  RemovePermissionCommand,
} = require('@aws-sdk/client-lambda');

function getLambdaClient(region) {
  return new LambdaClient({
    region,
    maxAttempts: MAX_AWS_REQUEST_TRY,
  });
}

function getStatementId(functionName, ruleName) {
  const normalizedRuleName = ruleName.toLowerCase().replace(/[.:*]/g, '');
  const id = `${functionName}-${normalizedRuleName}`;
  if (id.length < 100) {
    return id;
  }
  return id.substring(0, 100);
}

async function addPermission(config) {
  const { functionName, partition, region, accountId, eventBus, ruleName } = config;
  const lambda = getLambdaClient(region);

  let SourceArn = `arn:${partition}:events:${region}:${accountId}:rule/${ruleName}`;
  if (eventBus) {
    const eventBusName = getEventBusName(eventBus);
    SourceArn = `arn:${partition}:events:${region}:${accountId}:rule/${eventBusName}/${ruleName}`;
  }
  const payload = {
    Action: 'lambda:InvokeFunction',
    FunctionName: functionName,
    Principal: 'events.amazonaws.com',
    StatementId: getStatementId(functionName, ruleName),
    SourceArn,
  };

  return lambda.send(new AddPermissionCommand(payload));
}

async function removePermission(config) {
  const { functionName, region, ruleName } = config;
  const lambda = getLambdaClient(region);

  const payload = {
    FunctionName: functionName,
    StatementId: getStatementId(functionName, ruleName),
  };

  return lambda.send(new RemovePermissionCommand(payload));
}

module.exports = {
  getStatementId,
  addPermission,
  removePermission,
};
