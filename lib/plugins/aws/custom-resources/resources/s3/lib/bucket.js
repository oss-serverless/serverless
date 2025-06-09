'use strict';

const crypto = require('crypto');
const { MAX_AWS_REQUEST_TRY } = require('../../utils');
const {
  GetBucketNotificationConfigurationCommand,
  PutBucketNotificationConfigurationCommand,
} = require('@aws-sdk/client-s3');
const AWSClientFactory = require('../../../../../../aws/client-factory');

const awsFactory = new AWSClientFactory({ maxAttempts: MAX_AWS_REQUEST_TRY });

function generateId(functionName, bucketConfig) {
  const md5 = crypto.createHash('md5').update(JSON.stringify(bucketConfig)).digest('hex');
  return `${functionName}-${md5}`;
}

function createFilter(config) {
  const rules = config.Rules;
  if (rules && rules.length) {
    const FilterRules = rules.map((rule) => {
      const key = Object.keys(rule)[0];
      const Name = key.toLowerCase();
      const Value = rule[key];
      return {
        Name,
        Value,
      };
    });
    return {
      Key: {
        FilterRules,
      },
    };
  }
  return undefined;
}

async function getConfiguration(config) {
  const { bucketName, region } = config;

  const Bucket = bucketName;
  const payload = {
    Bucket,
  };

  return awsFactory.send('S3', new GetBucketNotificationConfigurationCommand(payload), { region });
}

async function updateConfiguration(config) {
  const { lambdaArn, functionName, bucketName, bucketConfigs, region } = config;

  const Bucket = bucketName;

  return getConfiguration(config).then((NotificationConfiguration) => {
    // remove configurations for this specific function
    if (
      NotificationConfiguration.LambdaFunctionConfigurations &&
      NotificationConfiguration.LambdaFunctionConfigurations.length > 0
    ) {
      NotificationConfiguration.LambdaFunctionConfigurations =
        NotificationConfiguration.LambdaFunctionConfigurations.filter(
          (conf) => !conf.Id.startsWith(functionName)
        );
    }

    // add the events to the existing NotificationConfiguration
    bucketConfigs.forEach((bucketConfig) => {
      const Events = [bucketConfig.Event];
      const LambdaFunctionArn = lambdaArn;
      const Id = generateId(functionName, bucketConfig);
      const Filter = createFilter(bucketConfig);
      if (NotificationConfiguration.LambdaFunctionConfigurations) {
        NotificationConfiguration.LambdaFunctionConfigurations.push({
          Events,
          LambdaFunctionArn,
          Filter,
          Id,
        });
      } else {
        NotificationConfiguration.LambdaFunctionConfigurations = [
          {
            Events,
            LambdaFunctionArn,
            Filter,
            Id,
          },
        ];
      }
    });

    const payload = {
      Bucket,
      NotificationConfiguration,
    };
    return awsFactory.send('S3', new PutBucketNotificationConfigurationCommand(payload), {
      region,
    });
  });
}

async function removeConfiguration(config) {
  const { functionName, bucketName, region } = config;

  const Bucket = bucketName;

  return getConfiguration(config).then((NotificationConfiguration) => {
    // remove configurations for this specific function
    if (
      NotificationConfiguration.LambdaFunctionConfigurations &&
      NotificationConfiguration.LambdaFunctionConfigurations.length > 0
    ) {
      NotificationConfiguration.LambdaFunctionConfigurations =
        NotificationConfiguration.LambdaFunctionConfigurations.filter(
          (conf) => !conf.Id.startsWith(functionName)
        );
    }

    const payload = {
      Bucket,
      NotificationConfiguration,
    };
    return awsFactory.send('S3', new PutBucketNotificationConfigurationCommand(payload), {
      region,
    });
  });
}

module.exports = {
  updateConfiguration,
  removeConfiguration,
};
