'use strict';

const {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');
const ServerlessError = require('../../../../serverless-error');
const { isCloudFormationMissingStackError } = require('../../../../aws/aws-sdk-v3-error');

function getCloudFormationClient(context) {
  context.cloudFormationClientPromise ||= context.provider
    .getAwsSdkV3Config()
    .then((config) => new CloudFormationClient(config));
  return context.cloudFormationClientPromise;
}

module.exports = {
  async ensureStackIsNotDeletionProtected() {
    const stackName = this.provider.naming.getStackName();
    const cloudFormation = await getCloudFormationClient(this);
    let stack;

    try {
      const result = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
      stack = result.Stacks && result.Stacks[0];
    } catch (error) {
      if (isCloudFormationMissingStackError(error)) return;
      throw error;
    }

    if (!stack || !stack.EnableTerminationProtection) return;

    throw new ServerlessError(
      `Cannot remove stack "${stackName}" because deletion protection is enabled. Disable provider.deletionProtection and deploy the service before removing it.`,
      'AWS_CLOUDFORMATION_DELETION_PROTECTION_ENABLED'
    );
  },

  async remove() {
    const stackName = this.provider.naming.getStackName();
    const params = {
      StackName: stackName,
    };

    const customDeploymentRole = this.provider.getCustomDeploymentRole();
    if (customDeploymentRole) {
      params.RoleARN = customDeploymentRole;
    }

    const cfData = {
      StackId: stackName,
    };

    const cloudFormation = await getCloudFormationClient(this);
    await cloudFormation.send(new DeleteStackCommand(params));
    return cfData;
  },

  async removeStack() {
    return this.remove();
  },
};
