'use strict';

const _ = require('lodash');
const findAndGroupDeployments = require('../../utils/find-and-group-deployments');
const getS3ObjectsFromStacks = require('../../utils/get-s3-objects-from-stacks');
const ServerlessError = require('../../../../serverless-error');
const { log } = require('@serverless/utils/log');

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

  async getObjectsToRemove() {
    const stacksToKeepCount = _.get(
      this.serverless,
      'service.provider.deploymentBucketObject.maxPreviousDeploymentArtifacts',
      5
    );

    const service = this.serverless.service.service;
    const stage = this.provider.getStage();
    const prefix = this.provider.getDeploymentPrefix();

    let response;
    try {
      response = await this._s3Request('listObjectsV2', {
        Bucket: this.bucketName,
        Prefix: `${prefix}/${service}/${stage}`,
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
    const stacks = findAndGroupDeployments(response, prefix, service, stage);
    const stacksToRemove = stacks.slice(0, -stacksToKeepCount || Infinity);

    return getS3ObjectsFromStacks(stacksToRemove, prefix, service, stage);
  },

  async removeObjects(objectsToRemove) {
    if (!objectsToRemove || !objectsToRemove.length) return;
    await this._s3Request('deleteObjects', {
      Bucket: this.bucketName,
      Delete: { Objects: objectsToRemove },
    });
  },

  async cleanupS3Bucket() {
    if (this.serverless.service.provider.deploymentWithEmptyChangeSet) {
      log.info('Removing unnecessary service artifacts from S3');
      await this.cleanupArtifactsForEmptyChangeSet();
    } else {
      log.info('Removing old service artifacts from S3');
      const objectsToRemove = await this.getObjectsToRemove();
      await this.removeObjects(objectsToRemove);
    }
  },

  async cleanupArtifactsForEmptyChangeSet() {
    let response;
    try {
      response = await this._s3Request('listObjectsV2', {
        Bucket: this.bucketName,
        Prefix: this.serverless.service.package.artifactDirectoryName,
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
    const service = this.serverless.service.service;
    const stage = this.provider.getStage();
    const deploymentPrefix = this.provider.getDeploymentPrefix();

    const objectsToRemove = getS3ObjectsFromStacks(
      findAndGroupDeployments(response, deploymentPrefix, service, stage),
      deploymentPrefix,
      service,
      stage
    );
    await this.removeObjects(objectsToRemove);
  },
};
