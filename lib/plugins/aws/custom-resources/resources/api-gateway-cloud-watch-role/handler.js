'use strict';

const { wait, MAX_AWS_REQUEST_TRY } = require('../utils');
const { getEnvironment, handlerWrapper } = require('../utils');
const { GetAccountCommand, UpdateAccountCommand } = require('@aws-sdk/client-api-gateway');
const {
  ListAttachedRolePoliciesCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
} = require('@aws-sdk/client-iam');
const AWSClientFactory = require('../../../../../aws/client-factory');

const awsFactory = new AWSClientFactory({ maxAttempts: MAX_AWS_REQUEST_TRY });

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
  const { RoleArn } = event.ResourceProperties;
  const { Partition: partition, AccountId: accountId, Region: region } = getEnvironment(context);

  const assignedRoleArn = (
    await awsFactory.send('APIGateway', new GetAccountCommand({}), { region })
  ).cloudwatchRoleArn;

  let roleArn = `arn:${partition}:iam::${accountId}:role/serverlessApiGatewayCloudWatchRole`;
  if (RoleArn) {
    // if there's a roleArn in the Resource Properties, just re-use it here
    roleArn = RoleArn;
  } else {
    // Create an own API Gateway role if the roleArn was not set via Resource Properties
    const apiGatewayPushToCloudWatchLogsPolicyArn = `arn:${partition}:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`;

    const roleName = roleArn.slice(roleArn.lastIndexOf('/') + 1);

    const attachedPolicies = await (async () => {
      try {
        return (
          await awsFactory.send(
            'IAM',
            new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
            { region }
          )
        ).AttachedPolicies;
      } catch (error) {
        if (error.code === 'NoSuchEntity') {
          // Role doesn't exist yet, create;
          await awsFactory.send(
            'IAM',
            new CreateRoleCommand({
              AssumeRolePolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Principal: {
                      Service: ['apigateway.amazonaws.com'],
                    },
                    Action: ['sts:AssumeRole'],
                  },
                ],
              }),
              Path: '/',
              RoleName: roleName,
            }),
            { region }
          );
          return [];
        }
        throw error;
      }
    })();

    if (
      !attachedPolicies.some(
        (policy) => policy.PolicyArn === apiGatewayPushToCloudWatchLogsPolicyArn
      )
    ) {
      await awsFactory.send(
        'IAM',
        new AttachRolePolicyCommand({
          PolicyArn: apiGatewayPushToCloudWatchLogsPolicyArn,
          RoleName: roleName,
        }),
        { region }
      );
    }
  }

  // there's nothing to do if the role is the same
  if (roleArn === assignedRoleArn) return null;

  const updateAccount = async (counter = 1) => {
    try {
      await awsFactory.send(
        'APIGateway',
        new UpdateAccountCommand({
          patchOperations: [
            {
              op: 'replace',
              path: '/cloudwatchRoleArn',
              value: roleArn,
            },
          ],
        }),
        { region }
      );
    } catch (error) {
      if (counter < 10) {
        // Observed fails with errors marked as non-retryable. Still they're outcome of
        // temporary state where just created AWS role is not being ready for use (yet)
        await wait(10000);
        return updateAccount(++counter);
      }
      throw error;
    }
    return null;
  };

  return updateAccount();
}

function update() {
  // No actions
}

function remove() {
  // No actions
}

module.exports = {
  handler: handlerWrapper(handler, 'CustomResourceApiGatewayAccountCloudWatchRole'),
};
