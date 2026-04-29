'use strict';

const findAndGroupDeployments = require('../../utils/find-and-group-deployments');
const getS3ObjectsFromStacks = require('../../utils/get-s3-objects-from-stacks');
const isS3ListAccessDeniedError = require('../../utils/is-s3-list-access-denied-error');
const parseDeploymentObjectKey = require('../../utils/parse-deployment-object-key');
const ServerlessError = require('../../../../serverless-error');
const { log } = require('../../../../utils/serverless-utils/log');

const maxDeleteObjectsCount = 1000;

const createS3ListObjectsAccessDeniedError = () =>
  new ServerlessError(
    'Could not list objects in the deployment bucket. Make sure you have sufficient permissions to access it.',
    'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
  );

const createDeleteObjectsError = (bucketName, firstError) => {
  const firstErrorCode = firstError.Code || firstError.code;

  if (firstErrorCode === 'AccessDenied') {
    return new ServerlessError(
      `Could not remove deployment artifacts from the S3 deployment bucket (${bucketName}). Make sure that you have permissions that allow S3 objects deletion. First encountered S3 error code: ${firstErrorCode}`,
      'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED'
    );
  }

  return new ServerlessError(
    `Could not remove deployment artifacts from the S3 deployment bucket (${bucketName}). First encountered S3 error code: ${firstErrorCode}`,
    'CANNOT_DELETE_S3_OBJECTS_GENERIC'
  );
};

async function listObjectsV2(provider, params) {
  const Contents = [];
  let ContinuationToken;

  do {
    const response = await provider.request('S3', 'listObjectsV2', {
      ...params,
      ...(ContinuationToken ? { ContinuationToken } : {}),
    });

    Contents.push(...(response?.Contents || []));
    ContinuationToken = response && response.NextContinuationToken;
  } while (ContinuationToken);

  return { Contents };
}

module.exports = {
  async getObjectsToRemove() {
    const stacksToKeepCount =
      this.serverless.service.provider.deploymentBucketObject?.maxPreviousDeploymentArtifacts ?? 5;

    const service = this.serverless.service.service;
    const stage = this.provider.getStage();
    const prefix = this.provider.getDeploymentPrefix();

    try {
      const response = await listObjectsV2(this.provider, {
        Bucket: this.bucketName,
        Prefix: `${prefix}/${service}/${stage}/`,
      });

      const stacks = findAndGroupDeployments(response, prefix, service, stage);
      const stacksToRemove = stacks.slice(0, -stacksToKeepCount || Infinity);

      return getS3ObjectsFromStacks(stacksToRemove, prefix, service, stage);
    } catch (err) {
      if (isS3ListAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
      throw err;
    }
  },

  async removeObjects(objectsToRemove) {
    if (!objectsToRemove || !objectsToRemove.length) return;

    for (let index = 0; index < objectsToRemove.length; index += maxDeleteObjectsCount) {
      const batch = objectsToRemove.slice(index, index + maxDeleteObjectsCount);
      const result = await this.provider.request('S3', 'deleteObjects', {
        Bucket: this.bucketName,
        Delete: { Objects: batch },
      });

      if (result && result.Errors && result.Errors.length) {
        throw createDeleteObjectsError(this.bucketName, result.Errors[0]);
      }
    }
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
    const service = this.serverless.service.service;
    const stage = this.provider.getStage();
    const deploymentPrefix = this.provider.getDeploymentPrefix();

    try {
      const artifactDirectoryName = this.serverless.service.package.artifactDirectoryName.replace(
        /\/+$/,
        ''
      );
      const parsedArtifactDirectory = parseDeploymentObjectKey(
        `${artifactDirectoryName}/${this.provider.naming.getServiceStateFileName()}`,
        deploymentPrefix,
        service,
        stage
      );
      if (
        !parsedArtifactDirectory ||
        `${deploymentPrefix}/${service}/${stage}/${parsedArtifactDirectory.directory}` !==
          artifactDirectoryName
      ) {
        throw new ServerlessError(
          'Cannot clean up artifacts for empty changeset because the deployment artifact directory does not point to a single deployment directory.',
          'INVALID_EMPTY_CHANGE_SET_ARTIFACT_DIRECTORY'
        );
      }
      response = await listObjectsV2(this.provider, {
        Bucket: this.bucketName,
        Prefix: `${artifactDirectoryName}/`,
      });
    } catch (err) {
      if (isS3ListAccessDeniedError(err)) throw createS3ListObjectsAccessDeniedError();
      throw err;
    }

    const objectsToRemove = getS3ObjectsFromStacks(
      findAndGroupDeployments(response, deploymentPrefix, service, stage),
      deploymentPrefix,
      service,
      stage
    );
    await this.removeObjects(objectsToRemove);
  },
};
