'use strict';

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
