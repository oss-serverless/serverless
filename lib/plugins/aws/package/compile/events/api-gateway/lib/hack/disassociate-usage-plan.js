'use strict';

const { log } = require('../../../../../../../../utils/serverless-utils/log');

async function getAllUsagePlans(provider) {
  const items = [];
  let position;

  do {
    const params = position ? { position, limit: 500 } : { limit: 500 };
    const response = await provider.request('APIGateway', 'getUsagePlans', params);
    items.push(...(response.items || []));
    position = response.position;
  } while (position);

  return items;
}

module.exports = {
  async disassociateUsagePlan() {
    const apiKeys =
      this.serverless.service.provider.apiGateway &&
      this.serverless.service.provider.apiGateway.apiKeys;

    if (apiKeys && apiKeys.length) {
      log.info('Removing usage plan association');
      const stackName = `${this.provider.naming.getStackName()}`;
      const [stackResource, usagePlans] = await Promise.all([
        this.provider.request('CloudFormation', 'describeStackResource', {
          StackName: stackName,
          LogicalResourceId: this.provider.naming.getRestApiLogicalId(),
        }),
        getAllUsagePlans(this.provider),
      ]);
      const restApiId = stackResource.StackResourceDetail.PhysicalResourceId;

      return Promise.all(
        usagePlans.flatMap((item) =>
          (item.apiStages || [])
            .filter((apiStage) => apiStage.apiId === restApiId)
            .map((apiStage) =>
              this.provider.request('APIGateway', 'updateUsagePlan', {
                usagePlanId: item.id,
                patchOperations: [
                  {
                    op: 'remove',
                    path: '/apiStages',
                    value: `${apiStage.apiId}:${apiStage.stage}`,
                  },
                ],
              })
            )
        )
      );
    }
  },
};
