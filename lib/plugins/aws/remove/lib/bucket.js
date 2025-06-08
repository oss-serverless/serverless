'use strict';

const { log } = require('@serverless/utils/log');
const ServerlessError = require('../../../../serverless-error');

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

  async setServerlessDeploymentBucketName() {
    try {
      const bucketName = await this.provider.getServerlessDeploymentBucketName();
      this.bucketName = bucketName;
    } catch (err) {
      // If there is a validation error with expected message, it means that logical resource for
      // S3 bucket does not exist and we want to proceed with empty `bucketName`
      if (
        err.providerError.code !== 'ValidationError' ||
        !err.message.includes('does not exist for stack')
      ) {
        throw err;
      }
    }
  },

  async listObjectsV2() {
    this.objectsInBucket = [];

    const serviceStage = `${this.serverless.service.service}/${this.provider.getStage()}`;

    let result;
    try {
      result = await this._s3Request('listObjectsV2', {
        Bucket: this.bucketName,
        Prefix: `${this.provider.getDeploymentPrefix()}/${serviceStage}`,
      });
    } catch (err) {
      if (err.code === 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED') {
        throw new ServerlessError(
          'Could not list objects in the deployment bucket. Make sure you have sufficient permissions to access it.',
          err.code
        );
      }
      throw err;
    }

    if (result) {
      result.Contents.forEach((object) => {
        this.objectsInBucket.push({
          Key: object.Key,
        });
      });
    }
  },

  async listObjectVersions() {
    this.objectsInBucket = [];

    const serviceStage = `${this.serverless.service.service}/${this.provider.getStage()}`;

    const result = await this._s3Request('listObjectVersions', {
      Bucket: this.bucketName,
      Prefix: `${this.provider.getDeploymentPrefix()}/${serviceStage}`,
    });

    if (result) {
      if (result.Versions) {
        result.Versions.forEach((object) => {
          this.objectsInBucket.push({
            Key: object.Key,
            VersionId: object.VersionId,
          });
        });
      }

      if (result.DeleteMarkers) {
        result.DeleteMarkers.forEach((object) => {
          this.objectsInBucket.push({
            Key: object.Key,
            VersionId: object.VersionId,
          });
        });
      }
    }
  },

  async listObjects() {
    const deploymentBucketObject = this.serverless.service.provider.deploymentBucketObject;
    return deploymentBucketObject && deploymentBucketObject.versioning
      ? this.listObjectVersions()
      : this.listObjectsV2();
  },

  async deleteObjects() {
    if (this.objectsInBucket.length) {
      const data = await this._s3Request('deleteObjects', {
        Bucket: this.bucketName,
        Delete: {
          Objects: this.objectsInBucket,
        },
      });
      if (data && data.Errors && data.Errors.length) {
        const firstErrorCode = data.Errors[0].Code;

        if (firstErrorCode === 'AccessDenied') {
          throw new ServerlessError(
            `Could not empty the S3 deployment bucket (${this.bucketName}). Make sure that you have permissions that allow S3 objects deletion. First encountered S3 error code: ${firstErrorCode}`,
            'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED'
          );
        }

        throw new ServerlessError(
          `Could not empty the S3 deployment bucket (${this.bucketName}). First encountered S3 error code: ${firstErrorCode}`,
          'CANNOT_DELETE_S3_OBJECTS_GENERIC'
        );
      }
    }
  },

  async emptyS3Bucket() {
    await this.setServerlessDeploymentBucketName();
    if (this.bucketName && (await this.checkIfBucketExists(this.bucketName))) {
      await this.listObjects();
      await this.deleteObjects();
    } else {
      log.info('S3 bucket not found. Skipping S3 bucket objects removal');
    }
  },
};
