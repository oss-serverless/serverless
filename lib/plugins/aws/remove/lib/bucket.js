'use strict';

const { log } = require('../../../../utils/serverless-utils/log');
const ServerlessError = require('../../../../serverless-error');

const maxDeleteObjectsCount = 1000;

const getErrorCode = (error) =>
  error && (error.code || error.Code || (error.providerError && error.providerError.code));

const getErrorStatusCode = (error) =>
  error && ((error.providerError && error.providerError.statusCode) || error.statusCode);

const isS3ListObjectsAccessDeniedError = (error) =>
  getErrorCode(error) === 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED' ||
  getErrorCode(error) === 'AccessDenied' ||
  getErrorStatusCode(error) === 403;

const createS3ListObjectsAccessDeniedError = () =>
  new ServerlessError(
    'Could not list objects in the deployment bucket. Make sure you have sufficient permissions to access it.',
    'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
  );

module.exports = {
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

    const prefix = `${this.provider.getDeploymentPrefix()}/${
      this.serverless.service.service
    }/${this.provider.getStage()}/`;

    try {
      let ContinuationToken;

      do {
        const result = await this.provider.request('S3', 'listObjectsV2', {
          Bucket: this.bucketName,
          Prefix: prefix,
          ...(ContinuationToken ? { ContinuationToken } : {}),
        });

        for (const object of result?.Contents || []) {
          this.objectsInBucket.push({
            Key: object.Key,
          });
        }

        ContinuationToken = result && result.NextContinuationToken;
      } while (ContinuationToken);
    } catch (err) {
      if (isS3ListObjectsAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
      throw err;
    }
  },

  async listObjectVersions() {
    this.objectsInBucket = [];

    const prefix = `${this.provider.getDeploymentPrefix()}/${
      this.serverless.service.service
    }/${this.provider.getStage()}/`;

    try {
      let KeyMarker;
      let VersionIdMarker;

      do {
        const result = await this.provider.request('S3', 'listObjectVersions', {
          Bucket: this.bucketName,
          Prefix: prefix,
          ...(KeyMarker ? { KeyMarker } : {}),
          ...(VersionIdMarker ? { VersionIdMarker } : {}),
        });

        for (const object of result?.Versions || []) {
          this.objectsInBucket.push({
            Key: object.Key,
            VersionId: object.VersionId,
          });
        }

        for (const object of result?.DeleteMarkers || []) {
          this.objectsInBucket.push({
            Key: object.Key,
            VersionId: object.VersionId,
          });
        }

        KeyMarker = result && result.NextKeyMarker;
        VersionIdMarker = result && result.NextVersionIdMarker;
      } while (KeyMarker || VersionIdMarker);
    } catch (err) {
      if (isS3ListObjectsAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
      throw err;
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
      for (let index = 0; index < this.objectsInBucket.length; index += maxDeleteObjectsCount) {
        const batch = this.objectsInBucket.slice(index, index + maxDeleteObjectsCount);
        const data = await this.provider.request('S3', 'deleteObjects', {
          Bucket: this.bucketName,
          Delete: {
            Objects: batch,
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
