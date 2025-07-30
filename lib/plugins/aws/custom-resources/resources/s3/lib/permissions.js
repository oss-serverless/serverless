'use strict';

const { MAX_AWS_REQUEST_TRY } = require('../../utils');
const { AddPermissionCommand, RemovePermissionCommand } = require('@aws-sdk/client-lambda');
const AWSClientFactory = require('../../../../../../aws/client-factory');

const awsFactory = new AWSClientFactory({ maxAttempts: MAX_AWS_REQUEST_TRY });

function getStatementId(functionName, bucketName) {
  const normalizedBucketName = bucketName.replace(/[.:*]/g, '');
  const id = `${functionName}-${normalizedBucketName}`;
  if (id.length < 100) {
    return id;
  }
  return id.substring(0, 100);
}

async function addPermission(config) {
  const { functionName, bucketName, partition, region, accountId } = config;

  const payload = {
    Action: 'lambda:InvokeFunction',
    FunctionName: functionName,
    Principal: 's3.amazonaws.com',
    StatementId: getStatementId(functionName, bucketName),
    SourceArn: `arn:${partition}:s3:::${bucketName}`,
    SourceAccount: accountId,
  };

  return awsFactory.send('Lambda', new AddPermissionCommand(payload), { region });
}

async function removePermission(config) {
  const { functionName, bucketName, region } = config;

  const payload = {
    FunctionName: functionName,
    StatementId: getStatementId(functionName, bucketName),
  };
  return awsFactory.send('Lambda', new RemovePermissionCommand(payload), { region });
}

module.exports = {
  getStatementId,
  addPermission,
  removePermission,
};
