'use strict';

const { log } = require('@serverless/utils/log');

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

  async checkIfEcrRepositoryExists() {
    const registryId = await this.provider.getAccountId();
    const repositoryName = this.provider.naming.getEcrRepositoryName();
    try {
      await this._ecrRequest('describeRepositories', {
        repositoryNames: [repositoryName],
        registryId,
      });
      return true;
    } catch (err) {
      if (err.providerError && err.providerError.code === 'RepositoryNotFoundException') {
        return false;
      }
      if (err.providerError && err.providerError.code === 'AccessDeniedException') {
        if (this.serverless.service.provider.ecr && this.serverless.service.provider.ecr.images) {
          log.warning(
            'Could not access ECR repository due to denied access, but there are images defined in "provider.ecr". ECR repository removal will be skipped.'
          );
        }
        // Check if user has images defined and issue warning that we could not
        return false;
      }
      throw err;
    }
  },
};
