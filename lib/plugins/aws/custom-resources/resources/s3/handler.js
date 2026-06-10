'use strict';

const { addPermission, removePermission } = require('./lib/permissions');
const { updateConfiguration, removeConfiguration } = require('./lib/bucket');
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

  return addPermission({
    functionName: target.functionName,
    functionQualifier: target.functionQualifier,
    bucketName: target.bucketName,
    partition: Partition,
    region: Region,
    accountId: AccountId,
  })
    .catch(ignoreExistingPermission)
    .then(() =>
      updateConfiguration({
        lambdaArn: target.lambdaArn,
        region: Region,
        functionName: target.functionName,
        bucketName: target.bucketName,
        bucketConfigs: target.bucketConfigs,
      })
    );
}

async function update(event, context) {
  const environment = getEnvironment(context);
  const { Partition, Region, AccountId } = environment;
  const target = resolveTarget(event.ResourceProperties, environment);
  const oldTarget =
    event.OldResourceProperties && resolveTarget(event.OldResourceProperties, environment);

  if (!isSameTarget(target, oldTarget)) {
    await addPermission({
      functionName: target.functionName,
      functionQualifier: target.functionQualifier,
      bucketName: target.bucketName,
      partition: Partition,
      region: Region,
      accountId: AccountId,
    }).catch(ignoreExistingPermission);
  }

  await updateConfiguration({
    lambdaArn: target.lambdaArn,
    region: Region,
    functionName: target.functionName,
    bucketName: target.bucketName,
    bucketConfigs: target.bucketConfigs,
  });

  if (
    oldTarget &&
    (oldTarget.bucketName !== target.bucketName || oldTarget.functionName !== target.functionName)
  ) {
    await removeConfiguration({
      region: Region,
      functionName: oldTarget.functionName,
      bucketName: oldTarget.bucketName,
    });
  }

  if (oldTarget && !isSameTarget(target, oldTarget)) {
    await removePermission({
      functionName: oldTarget.functionName,
      functionQualifier: oldTarget.functionQualifier,
      bucketName: oldTarget.bucketName,
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
    bucketName: target.bucketName,
    region: Region,
  })
    .catch(ignoreMissingPermission)
    .then(() =>
      removeConfiguration({
        region: Region,
        functionName: target.functionName,
        bucketName: target.bucketName,
      })
        .catch(ignoreMissingBucket)
        .catch(ignoreDeniedBucketCleanup)
    );
}

function resolveTarget(properties, environment) {
  const { FunctionName, FunctionQualifier, BucketName, BucketConfigs } = properties;

  return {
    functionName: FunctionName,
    functionQualifier: FunctionQualifier,
    bucketName: BucketName,
    bucketConfigs: BucketConfigs,
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
    target.bucketName === oldTarget.bucketName
  );
}

function ignoreMissingPermission(error) {
  if (error && [error.name, error.Code, error.code].includes('ResourceNotFoundException')) {
    return;
  }
  throw error;
}

function ignoreMissingBucket(error) {
  if (error && [error.name, error.Code, error.code].includes('NoSuchBucket')) {
    return;
  }
  throw error;
}

function ignoreDeniedBucketCleanup(error) {
  if (error && [error.name, error.Code, error.code].includes('AccessDenied')) {
    // The old bucket may no longer be authorized after the role is recompiled
    // from the current template. Let stack cleanup proceed; this can leave
    // stale notification configuration on that external bucket.
    return;
  }
  throw error;
}

function ignoreExistingPermission(error) {
  if (error && [error.name, error.Code, error.code].includes('ResourceConflictException')) {
    return;
  }
  throw error;
}

module.exports = {
  handler: handlerWrapper(handler, 'CustomResourceExistingS3'),
};
