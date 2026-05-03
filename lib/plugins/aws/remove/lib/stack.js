'use strict';

const { CloudFormationClient, DeleteStackCommand } = require('@aws-sdk/client-cloudformation');

function getCloudFormationClient(context) {
  context.cloudFormationClientPromise ||= context.provider
    .getAwsSdkV3Config()
    .then((config) => new CloudFormationClient(config));
  return context.cloudFormationClientPromise;
}

module.exports = {
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
