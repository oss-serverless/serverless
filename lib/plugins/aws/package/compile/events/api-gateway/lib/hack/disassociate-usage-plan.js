'use strict';

const { log } = require('../../../../../../../../utils/serverless-utils/log');

module.exports = {
  async disassociateUsagePlan() {
    const apiKeys =
      this.serverless.service.provider.apiGateway &&
      this.serverless.service.provider.apiGateway.apiKeys;

    if (apiKeys && apiKeys.length) {
      log.info('Removing usage plan association');
      const stackName = `${this.provider.naming.getStackName()}`;
      const data = await Promise.all([
        this.provider.request('CloudFormation', 'describeStackResource', {
          StackName: stackName,
          LogicalResourceId: this.provider.naming.getRestApiLogicalId(),
        }),
        this.provider.request('APIGateway', 'getUsagePlans', {}),
      ]);
      const items = data[1].items.filter((item) =>
        item.apiStages
          .map((apistage) => apistage.apiId)
          .includes(data[0].StackResourceDetail.PhysicalResourceId)
      );

      return Promise.all(
        items
          .map((item) =>
            item.apiStages.map((apiStage) =>
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
          .flat(Infinity)
      );
    }
  },
};
