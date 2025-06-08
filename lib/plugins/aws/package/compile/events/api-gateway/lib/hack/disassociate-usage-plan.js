'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const { log } = require('@serverless/utils/log');

module.exports = {
  /**
   * Helper method to route AWS requests through v2 or v3 based on feature flag
   * @private
   */
  async _awsRequest(service, method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3(service, method, params);
    }
    return this.provider.request(service, method, params);
  },

  async disassociateUsagePlan() {
    const apiKeys = _.get(this.serverless.service.provider.apiGateway, 'apiKeys');

    if (apiKeys && apiKeys.length) {
      log.info('Removing usage plan association');
      const stackName = `${this.provider.naming.getStackName()}`;
      return BbPromise.all([
        this._awsRequest('CloudFormation', 'describeStackResource', {
          StackName: stackName,
          LogicalResourceId: this.provider.naming.getRestApiLogicalId(),
        }),
        this._awsRequest('APIGateway', 'getUsagePlans', {}),
      ])
        .then((data) =>
          data[1].items.filter((item) =>
            item.apiStages
              .map((apistage) => apistage.apiId)
              .includes(data[0].StackResourceDetail.PhysicalResourceId)
          )
        )
        .then((items) =>
          BbPromise.all(
            items
              .map((item) =>
                item.apiStages.map((apiStage) =>
                  this._awsRequest('APIGateway', 'updateUsagePlan', {
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
          )
        );
    }

    return BbPromise.resolve();
  },
};
