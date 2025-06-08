'use strict';

const BbPromise = require('bluebird');

module.exports = {
  /**
   * Helper method to route CloudFormation requests through v2 or v3 based on feature flag
   * @private
   */
  async _cloudFormationRequest(method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3('CloudFormation', method, params);
    }
    return this.provider.request('CloudFormation', method, params);
  },

  async getResourceCount(nextToken, resourceCount = 0) {
    const params = {
      StackName: this.provider.naming.getStackName(),
      NextToken: nextToken,
    };
    return this._cloudFormationRequest('listStackResources', params).then((result) => {
      if (Object.keys(result).length) {
        this.gatheredData.info.resourceCount = resourceCount + result.StackResourceSummaries.length;
        if (result.NextToken) {
          return this.getResourceCount(result.NextToken, this.gatheredData.info.resourceCount);
        }
      }
      return BbPromise.resolve();
    });
  },
};
