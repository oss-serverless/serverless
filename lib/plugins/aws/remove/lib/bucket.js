'use strict';

const { log } = require('../../../../utils/serverless-utils/log');
const ServerlessError = require('../../../../serverless-error');

const maxDeleteObjectsCount = 1000;
const genericS3ListErrorCodes = new Set([
  'AWS_S3_LIST_OBJECTS_V2_ERROR',
  'AWS_S3_LIST_OBJECT_VERSIONS_ERROR',
]);

const getErrorName = (error) => {
  if (!error || error.name === 'Error' || error.name === ServerlessError.name) return undefined;
  return error.name;
};

const getErrorCode = (error) => {
  if (!error) return undefined;

  if (error.providerError) {
    const providerErrorCode =
      error.providerError.code || error.providerError.Code || getErrorName(error.providerError);
    if (providerErrorCode) return providerErrorCode;
  }

  return error.Code || error.code || getErrorName(error);
};

const getErrorStatusCode = (error) =>
  error &&
  ((error.providerError &&
    (error.providerError.statusCode ||
      (error.providerError.$metadata && error.providerError.$metadata.httpStatusCode))) ||
    error.statusCode ||
    (error.$metadata && error.$metadata.httpStatusCode));

const isS3ListObjectsAccessDeniedError = (error) => {
  const errorCode = getErrorCode(error);

  return (
    errorCode === 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED' ||
    errorCode === 'AccessDenied' ||
    ((!errorCode || genericS3ListErrorCodes.has(errorCode)) && getErrorStatusCode(error) === 403)
  );
};

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
    const prefix = `${this.provider.getDeploymentPrefix()}/${
      this.serverless.service.service
    }/${this.provider.getStage()}/`;

    let ContinuationToken;

    do {
      let result;

      try {
        result = await this.provider.request('S3', 'listObjectsV2', {
          Bucket: this.bucketName,
          Prefix: prefix,
          ...(ContinuationToken ? { ContinuationToken } : {}),
        });
      } catch (err) {
        if (isS3ListObjectsAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
        throw err;
      }

      const pageObjects = (result?.Contents || []).map((object) => ({
        Key: object.Key,
      }));

      const nextContinuationToken = result && result.NextContinuationToken;
      await this.deleteObjectBatches(pageObjects);
      ContinuationToken = nextContinuationToken;
    } while (ContinuationToken);
  },

  async listObjectVersions() {
    const prefix = `${this.provider.getDeploymentPrefix()}/${
      this.serverless.service.service
    }/${this.provider.getStage()}/`;

    let KeyMarker;
    let VersionIdMarker;

    do {
      let result;

      try {
        result = await this.provider.request('S3', 'listObjectVersions', {
          Bucket: this.bucketName,
          Prefix: prefix,
          ...(KeyMarker ? { KeyMarker } : {}),
          ...(VersionIdMarker ? { VersionIdMarker } : {}),
        });
      } catch (err) {
        if (isS3ListObjectsAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
        throw err;
      }

      const pageObjects = [
        ...(result?.Versions || []).map((object) => ({
          Key: object.Key,
          VersionId: object.VersionId,
        })),
        ...(result?.DeleteMarkers || []).map((object) => ({
          Key: object.Key,
          VersionId: object.VersionId,
        })),
      ];

      const nextKeyMarker = result && result.NextKeyMarker;
      const nextVersionIdMarker = result && result.NextVersionIdMarker;
      await this.deleteObjectBatches(pageObjects);
      KeyMarker = nextKeyMarker;
      VersionIdMarker = nextVersionIdMarker;
    } while (KeyMarker || VersionIdMarker);
  },

  async listObjects() {
    const deploymentBucketObject = this.serverless.service.provider.deploymentBucketObject;
    return deploymentBucketObject && deploymentBucketObject.versioning
      ? this.listObjectVersions()
      : this.listObjectsV2();
  },

  async deleteObjectBatches(objects) {
    if (!objects.length) return;

    for (let index = 0; index < objects.length; index += maxDeleteObjectsCount) {
      const batch = objects.slice(index, index + maxDeleteObjectsCount);
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
  },

  async emptyS3Bucket() {
    await this.setServerlessDeploymentBucketName();
    if (this.bucketName && (await this.checkIfBucketExists(this.bucketName))) {
      await this.listObjects();
    } else {
      log.info('S3 bucket not found. Skipping S3 bucket objects removal');
    }
  },
};
