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
  const environment = getEnvironment(context);
  const { Partition, Region, AccountId } = environment;
  const target = resolveTarget(event.ResourceProperties, environment);

  return findUserPoolByName({ userPoolName: target.userPoolName, region: Region }).then(
    (userPool) =>
      addPermission({
        functionName: target.functionName,
        functionQualifier: target.functionQualifier,
        userPoolName: target.userPoolName,
        partition: Partition,
        region: Region,
        accountId: AccountId,
        userPoolId: userPool.Id,
      }).then(() =>
        updateConfiguration({
          lambdaArn: target.lambdaArn,
          userPoolName: target.userPoolName,
          userPoolConfigs: target.userPoolConfigs,
          region: Region,
        })
      )
  );
}

async function update(event, context) {
  const environment = getEnvironment(context);
  const { Partition, Region, AccountId } = environment;
  const target = resolveTarget(event.ResourceProperties, environment);
  const oldTarget =
    event.OldResourceProperties && resolveTarget(event.OldResourceProperties, environment);

  if (!isSameTarget(target, oldTarget)) {
    const userPool = await findUserPoolByName({
      userPoolName: target.userPoolName,
      region: Region,
    });
    await addPermission({
      functionName: target.functionName,
      functionQualifier: target.functionQualifier,
      userPoolName: target.userPoolName,
      partition: Partition,
      region: Region,
      accountId: AccountId,
      userPoolId: userPool.Id,
    });
  }

  await updateConfiguration({
    lambdaArn: target.lambdaArn,
    previousLambdaArn: oldTarget && oldTarget.lambdaArn,
    userPoolName: target.userPoolName,
    userPoolConfigs: target.userPoolConfigs,
    region: Region,
  });

  if (oldTarget && oldTarget.userPoolName !== target.userPoolName) {
    await removeConfiguration({
      lambdaArn: oldTarget.lambdaArn,
      userPoolName: oldTarget.userPoolName,
      region: Region,
    });
  }

  if (oldTarget && !isSameTarget(target, oldTarget)) {
    await removePermission({
      functionName: oldTarget.functionName,
      functionQualifier: oldTarget.functionQualifier,
      userPoolName: oldTarget.userPoolName,
      region: Region,
    }).catch(ignoreMissingPermission);
  }
}

async function remove(event, context) {
  const environment = getEnvironment(context);
  const { Region } = environment;
  const target = resolveTarget(event.ResourceProperties, environment);

  return removePermission({
    functionName: target.functionName,
    functionQualifier: target.functionQualifier,
    userPoolName: target.userPoolName,
    region: Region,
  }).then(() =>
    removeConfiguration({
      lambdaArn: target.lambdaArn,
      userPoolName: target.userPoolName,
      region: Region,
    })
  );
}

function resolveTarget(properties, environment) {
  const { FunctionName, FunctionQualifier, UserPoolName, UserPoolConfigs } = properties;

  return {
    functionName: FunctionName,
    functionQualifier: FunctionQualifier,
    userPoolName: UserPoolName,
    userPoolConfigs: UserPoolConfigs,
    lambdaArn: getLambdaArn(
      environment.Partition,
      environment.Region,
      environment.AccountId,
      FunctionName,
      FunctionQualifier
    ),
  };
}

function isSameTarget(target, oldTarget) {
  return (
    oldTarget &&
    target.functionName === oldTarget.functionName &&
    target.functionQualifier === oldTarget.functionQualifier &&
    target.userPoolName === oldTarget.userPoolName
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
