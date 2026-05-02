'use strict';

module.exports = {
  async getResourceCount() {
    const stackName = this.provider.naming.getStackName();
    let nextToken;
    let resourceCount = 0;

    do {
      const params = { StackName: stackName };
      if (nextToken) params.NextToken = nextToken;
      const result = await this.provider.request('CloudFormation', 'listStackResources', params);
      resourceCount += (result.StackResourceSummaries || []).length;
      this.gatheredData.info.resourceCount = resourceCount;
      nextToken = result.NextToken;
    } while (nextToken);

    return undefined;
  },
};
