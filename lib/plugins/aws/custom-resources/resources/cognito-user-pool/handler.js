'use strict';

const { addPermission, removePermission } = require('./lib/permissions');
const { updateConfiguration, removeConfiguration, findUserPoolByName } = require('./lib/user-pool');
const { getEnvironment, getLambdaArn, handlerWrapper } = require('../utils');

async function handler(event, context) {
  if (event.RequestType === 'Create') {
    return create(event, context);
  } else if (event.RequestType === 'Update') {
    return update(event, context);
  } else if (event.RequestType === 'Delete') {
    return remove(event, context);
  }
  throw new Error(`Unhandled RequestType ${event.RequestType}`);
}

async function create(event, context) {
  const { FunctionName, UserPoolName, UserPoolConfigs } = event.ResourceProperties;
  const { Partition, Region, AccountId } = getEnvironment(context);

  const lambdaArn = getLambdaArn(Partition, Region, AccountId, FunctionName);

  return findUserPoolByName({ userPoolName: UserPoolName, region: Region }).then((userPool) => {
    if (!userPool) {
      throw new Error(`Could not find Cognito User Pool "${UserPoolName}"`);
    }
    return addPermission({
      functionName: FunctionName,
      userPoolName: UserPoolName,
      partition: Partition,
      region: Region,
      accountId: AccountId,
      userPoolId: userPool.Id,
    }).then(() =>
      updateConfiguration({
        lambdaArn,
        userPoolName: UserPoolName,
        userPoolConfigs: UserPoolConfigs,
        region: Region,
      })
    );
  });
}

async function update(event, context) {
  const { Partition, Region, AccountId } = getEnvironment(context);
  const { FunctionName, UserPoolName, UserPoolConfigs } = event.ResourceProperties;

  const lambdaArn = getLambdaArn(Partition, Region, AccountId, FunctionName);

  return updateConfiguration({
    lambdaArn,
    userPoolName: UserPoolName,
    userPoolConfigs: UserPoolConfigs,
    region: Region,
  });
}

async function remove(event, context) {
  const { Partition, Region, AccountId } = getEnvironment(context);
  const { FunctionName, UserPoolName } = event.ResourceProperties;

  const lambdaArn = getLambdaArn(Partition, Region, AccountId, FunctionName);

  return removePermission({
    functionName: FunctionName,
    userPoolName: UserPoolName,
    region: Region,
  })
    .catch(ignoreMissingPermission)
    .then(() =>
      removeConfiguration({
        lambdaArn,
        userPoolName: UserPoolName,
        region: Region,
      })
    );
}

function ignoreMissingPermission(error) {
  if (error && [error.name, error.Code, error.code].includes('ResourceNotFoundException')) {
    return;
  }
  throw error;
}

module.exports = {
  handler: handlerWrapper(handler, 'CustomResourceExistingCognitoUserPool'),
};
