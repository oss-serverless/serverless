'use strict';

module.exports = {
  /**
   * Helper method to route CloudFormation requests through v2 or v3 based on feature flag
   * @private
   */
  async _cloudFormationRequest(method, params) {
    return this.provider._awsRequest('CloudFormation', method, params);
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

    return this._cloudFormationRequest('deleteStack', params).then(() => cfData);
  },

  async removeStack() {
    return this.remove();
  },
};
