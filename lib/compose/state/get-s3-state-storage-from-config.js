'use strict';

const { getAwsClientConfig } = require('../utils/aws');

const S3StateStorage = require('./S3StateStorage');
const getConfiguredStateBucketName = require('./utils/get-configured-state-bucket-name');
const getStateBucketName = require('./utils/get-state-bucket-name');
const getStateBucketRegion = require('./utils/get-state-bucket-region');
const validateStage = require('../utils/validate-stage');

/**
 * @param {Record<string, any>} stateConfiguration
 * @param {import('../Context')} context
 * @returns {Promise<S3StateStorage>}
 */
const getS3StateStorageFromConfig = async (stateConfiguration, context) => {
  const stage = validateStage(context.stage);
  const bucketName = await getStateBucketName(stateConfiguration, context);
  const stateKey = `${stateConfiguration.prefix ? `${stateConfiguration.prefix}/` : ''}${
    stage
  }/state.json`;

  const configuredBucketName = getConfiguredStateBucketName(stateConfiguration);
  const region = configuredBucketName
    ? await getStateBucketRegion(bucketName, stateConfiguration, context)
    : 'us-east-1';

  const awsClientConfig = getAwsClientConfig({
    profile: stateConfiguration.profile,
    region,
    stage,
  });

  return new S3StateStorage({
    bucketName,
    stateKey,
    region,
    clientConfig: awsClientConfig,
  });
};

module.exports = getS3StateStorageFromConfig;
