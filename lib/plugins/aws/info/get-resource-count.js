'use strict';

const {
  CloudFormationClient,
  ListStackResourcesCommand,
} = require('@aws-sdk/client-cloudformation');

function getCloudFormationClient(context) {
  context.cloudFormationClientPromise ||= context.provider
    .getAwsSdkV3Config()
    .then((config) => new CloudFormationClient(config));
  return context.cloudFormationClientPromise;
}

module.exports = {
  async getResourceCount() {
    const cloudFormation = await getCloudFormationClient(this);
    const stackName = this.provider.naming.getStackName();
    let nextToken;
    let resourceCount = 0;

    do {
      const input = { StackName: stackName };
      if (nextToken) input.NextToken = nextToken;
      const result = await cloudFormation.send(new ListStackResourcesCommand(input));
      resourceCount += (result.StackResourceSummaries || []).length;
      this.gatheredData.info.resourceCount = resourceCount;
      nextToken = result.NextToken;
    } while (nextToken);

    return undefined;
  },
};
