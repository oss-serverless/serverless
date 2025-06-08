'use strict';

const getS3EndpointForRegion = require('../../utils/get-s3-endpoint-for-region');
const ServerlessError = require('../../../../serverless-error');

module.exports = {
  /**
   * Helper method to route CloudFormation requests through v2 or v3 based on feature flag
   * @private
   */
  async _cloudFormationRequest(method, params) {
    return this.provider._awsRequest('CloudFormation', method, params);
  },

  async validateTemplate() {
    const bucketName = this.bucketName;
    const artifactDirectoryName = this.serverless.service.package.artifactDirectoryName;
    const compiledTemplateFileName = this.provider.naming.getCompiledTemplateS3Suffix();
    const s3Endpoint = getS3EndpointForRegion(this.provider.getRegion());
    const params = {
      TemplateURL: `https://${s3Endpoint}/${bucketName}/${artifactDirectoryName}/${compiledTemplateFileName}`,
    };

    return this._cloudFormationRequest('validateTemplate', params).catch((error) => {
      const errorMessage = ['The CloudFormation template is invalid:', ` ${error.message}`].join(
        ''
      );
      throw new ServerlessError(errorMessage, 'INVALID_AWS_CLOUDFORMATION_TEMPLATE');
    });
  },
};
