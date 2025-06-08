'use strict';

module.exports = {
  /**
   * Helper method to route ECR requests through v2 or v3 based on feature flag
   * @private
   */
  async _ecrRequest(method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3('ECR', method, params);
    }
    return this.provider.request('ECR', method, params);
  },

  async removeEcrRepository() {
    const registryId = await this.provider.getAccountId();
    const repositoryName = this.provider.naming.getEcrRepositoryName();
    const params = {
      registryId,
      repositoryName,
      force: true, // To ensure removal of non-empty repository
    };

    await this._ecrRequest('deleteRepository', params);
  },
};
