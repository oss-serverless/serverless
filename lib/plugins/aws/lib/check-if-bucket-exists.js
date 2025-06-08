'use strict';

const ServerlessError = require('../../../serverless-error');

module.exports = {
  /**
   * Helper method to route S3 requests through v2 or v3 based on feature flag
   * @private
   */
  async _s3Request(method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3('S3', method, params);
    }
    return this.provider.request('S3', method, params);
  },

  async checkIfBucketExists(bucketName) {
    try {
      await this._s3Request('headBucket', {
        Bucket: bucketName,
      });
      return true;
    } catch (err) {
      if (err.code === 'AWS_S3_HEAD_BUCKET_NOT_FOUND') {
        return false;
      }

      if (err.code === 'AWS_S3_HEAD_BUCKET_FORBIDDEN') {
        throw new ServerlessError(
          'Could not access the deployment bucket. Make sure you have sufficient permissions to access it.',
          err.code
        );
      }

      throw err;
    }
  },
};
