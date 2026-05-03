'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDeepStrictEqual } = require('node:util');
const limit = require('ext/promise/limit').bind(Promise);
const glob = require('../../../../utils/glob');
const getHashForFilePath = require('../../../../utils/get-hash-for-file-path');
const normalizeFiles = require('../../lib/normalize-files');
const parseDeploymentObjectKey = require('../../utils/parse-deployment-object-key');
const ServerlessError = require('../../../../serverless-error');
const log = require('../../../../utils/serverless-utils/log').log.get('check-for-changes');

const fsp = fs.promises;

const isOtelExtensionName = RegExp.prototype.test.bind(/^sls-otel\.\d+\.\d+\.\d+\.zip$/);
const maxConcurrentArtifactHashes = 3;

function getDeploymentDirectoryTimestamp(directory) {
  return Number(directory.slice(0, directory.indexOf('-')));
}

function isCloudFormationMissingResourceError(error) {
  const message = error && error.message;
  return (
    typeof message === 'string' &&
    (message.includes('does not exist for stack') ||
      message === 'Resource does not exist' ||
      (message.startsWith('Resource ') && message.includes(' does not exist')))
  );
}

function isCloudWatchLogsResourceNotFoundError(error) {
  const providerError = error && error.providerError;
  const errorCode =
    (providerError && (providerError.code || providerError.Code || providerError.name)) ||
    (error && (error.code || error.Code || error.name));
  return errorCode === 'ResourceNotFoundException';
}

module.exports = {
  async checkForChanges() {
    this.serverless.service.provider.shouldNotDeploy = false;
    if (this.options.force) {
      log.debug('deployment forced - deploy');
      return this.checkLogGroupSubscriptionFilterResourceLimitExceeded();
    }

    const objs = await this.getMostRecentObjects();
    const [objMetadata, lastModifiedDate] = await Promise.all([
      this.getObjectMetadata(objs),
      this.getFunctionsEarliestLastModifiedDate(),
    ]);
    await this.checkIfDeploymentIsNecessary(objMetadata, lastModifiedDate);
    if (this.serverless.service.provider.shouldNotDeploy) return;

    // perform the subscription filter checking only if a deployment is required
    return this.checkLogGroupSubscriptionFilterResourceLimitExceeded();
  },

  async getMostRecentObjects() {
    const service = this.serverless.service.service;
    const stage = this.provider.getStage();
    const prefix = this.provider.getDeploymentPrefix();

    const params = {
      Bucket: this.bucketName,
      Prefix: `${prefix}/${service}/${stage}/`,
    };

    const result = { Contents: [] };
    let ContinuationToken;

    do {
      try {
        const page = await this.provider.request('S3', 'listObjectsV2', {
          ...params,
          ...(ContinuationToken ? { ContinuationToken } : {}),
        });
        result.Contents.push(...(page?.Contents ?? []));
        ContinuationToken = page && page.NextContinuationToken;
      } catch (error) {
        if (!error.message.includes('The specified bucket does not exist')) throw error;
        const stackName = this.provider.naming.getStackName();
        throw new ServerlessError(
          [
            `The serverless deployment bucket "${params.Bucket}" does not exist.`,
            `Create it manually if you want to reuse the CloudFormation stack "${stackName}",`,
            'or delete the stack if it is no longer required.',
          ].join(' '),
          'DEPLOYMENT_BUCKET_DOES_NOT_EXIST'
        );
      }
    } while (ContinuationToken);

    const deploymentObjects = (result?.Contents ?? []).flatMap((object) => {
      const entry = parseDeploymentObjectKey(object.Key, prefix, service, stage);
      if (!entry) return [];
      return [
        {
          object,
          directory: entry.directory,
          timestamp: getDeploymentDirectoryTimestamp(entry.directory),
        },
      ];
    });
    if (!deploymentObjects.length) {
      return [];
    }

    const ordered = [...deploymentObjects].sort((objectA, objectB) => {
      const timestampDiff = objectB.timestamp - objectA.timestamp;
      if (timestampDiff) return timestampDiff;
      return objectB.object.Key.localeCompare(objectA.object.Key);
    });

    const directory = ordered[0].directory;

    return ordered.filter((entry) => entry.directory === directory).map((entry) => entry.object);
  },

  // Gives the least recent last modify date across all the functions in the service.
  async getFunctionsEarliestLastModifiedDate() {
    let couldNotAccessFunction = false;
    const getFunctionResults = this.serverless.service.getAllFunctions().map((funName) => {
      const functionObj = this.serverless.service.getFunction(funName);
      return this.provider
        .request('Lambda', 'getFunction', {
          FunctionName: functionObj.name,
        })
        .then((res) => new Date(res.Configuration.LastModified))
        .catch((err) => {
          if (err.providerError && err.providerError.statusCode === 403) {
            couldNotAccessFunction = true;
          }
          return new Date(0);
        }); // Function is missing, needs to be deployed
    });

    return Promise.all(getFunctionResults).then((results) => {
      if (couldNotAccessFunction) {
        log.warning(
          'Not authorized to perform: lambda:GetFunction for at least one of the lambda functions. Deployment will not be skipped even if service files did not change.'
        );
      }

      return results.reduce((currentMin, date) => {
        if (!currentMin || date < currentMin) return date;
        return currentMin;
      }, null);
    });
  },

  async getObjectMetadata(objects) {
    return Promise.all(
      objects.map(async (obj) => {
        try {
          const result = await this.provider.request('S3', 'headObject', {
            Bucket: this.bucketName,
            Key: obj.Key,
          });
          result.Key = obj.Key;
          return result;
        } catch (err) {
          if (err.code === 'AWS_S3_HEAD_OBJECT_FORBIDDEN') {
            throw new ServerlessError(
              'Could not access objects in the deployment bucket. Make sure you have sufficient permissions to access it.',
              err.code
            );
          }
          throw err;
        }
      })
    );
  },

  async checkIfDeploymentIsNecessary(objects, funcLastModifiedDate) {
    if (!objects.length) {
      log.debug('no objects to compare - deploy');
      return;
    }
    const remoteHashesMap = new Map();
    for (const {
      Key: name,
      Metadata: { filesha256: hash },
    } of objects) {
      remoteHashesMap.set(name, hash);
    }

    const serverlessDirPath = path.join(this.serverless.serviceDir, '.serverless');

    // create a hash of the CloudFormation body
    const compiledCfTemplate = this.serverless.service.provider.compiledCloudFormationTemplate;
    const stateBasename = this.provider.naming.getServiceStateFileName();
    const stateObject = JSON.parse(
      await fsp.readFile(
        path.join(this.serverless.serviceDir, '.serverless', stateBasename),
        'utf-8'
      )
    );

    const localHashesMap = new Map([
      [
        'compiled-cloudformation-template.json',
        crypto
          .createHash('sha256')
          .update(
            JSON.stringify(normalizeFiles.normalizeCloudFormationTemplate(compiledCfTemplate))
          )
          .digest('base64'),
      ],
      [
        stateBasename,
        crypto
          .createHash('sha256')
          .update(JSON.stringify(normalizeFiles.normalizeState(stateObject)))
          .digest('base64'),
      ],
    ]);

    // create hashes for all the zip files
    const zipFiles = glob
      .sync(['**.zip'], { cwd: serverlessDirPath, dot: true, silent: true })
      .filter((basename) => !isOtelExtensionName(basename));
    if (this.serverless.service.package.artifact) {
      zipFiles.push(
        path.resolve(this.serverless.serviceDir, this.serverless.service.package.artifact)
      );
    }
    // resolve paths and ensure we only hash each unique file once.
    const zipFilePaths = Array.from(
      new Set(zipFiles.map((zipFile) => path.resolve(serverlessDirPath, zipFile)))
    );

    const hashZipFileLimited = limit(maxConcurrentArtifactHashes, async (zipFilePath) => {
      localHashesMap.set(zipFilePath, await getHashForFilePath(zipFilePath));
    });

    await Promise.all(zipFilePaths.map((zipFilePath) => hashZipFileLimited(zipFilePath)));

    // If any objects were changed after the last time the function was updated
    // there could have been a failed deploy.
    const changedAfterDeploy = objects.some((object) => {
      return object.LastModified && object.LastModified > funcLastModifiedDate;
    });

    if (changedAfterDeploy) {
      log.debug('function modification dates changed after last deploy - deploy');
      return;
    }
    log.debug('artifacts on S3 (%o) and locally (%o)', remoteHashesMap, localHashesMap);

    if (
      isDeepStrictEqual(
        Array.from(remoteHashesMap.values()).sort(),
        Array.from(localHashesMap.values()).sort()
      )
    ) {
      log.debug('no changes detected - do not deploy');
      this.serverless.service.provider.shouldNotDeploy = true;
      return;
    }
    log.debug('different artifacts resolved - deploy');
  },

  /**
   * @description Cloudwatch imposes a hard limit of 2 subscription filter per log group.
   * If we change a cloudwatchLog event entry to add a subscription filter to a log group
   * that already had two before, it will throw an error because CloudFormation firstly
   * tries to create and replace the new subscription filter (therefore hitting the limit)
   * before deleting the old one. This precompile process aims to delete existent
   * subscription filters of functions that a new filter was provided, by checking the
   * current ARN with the new one that will be generated.
   * See: https://github.com/serverless/serverless/issues/3447
   */
  async checkLogGroupSubscriptionFilterResourceLimitExceeded() {
    const region = this.provider.getRegion();

    const account = await this.provider.getAccountInfo();
    const accountId = account.accountId;
    const partition = account.partition;

    const functionNames = await this.serverless.service.getAllFunctions();

    const cloudwatchLogEvents = functionNames
      .map((functionName) => {
        const functionObj = this.serverless.service.getFunction(functionName);
        const FunctionName = functionObj.name;
        const events = functionObj.events;
        let logSubscriptionSerialNumber = 0;
        return events
          .filter((event) => !!event.cloudwatchLog)
          .map((event) => {
            const rawLogGroupName = event.cloudwatchLog.logGroup || event.cloudwatchLog;
            const logGroupName = rawLogGroupName.replace(/\r?\n/g, '');

            logSubscriptionSerialNumber++;

            return { FunctionName, functionName, logGroupName, logSubscriptionSerialNumber };
          });
      })
      .flat();

    // Avoid inherited Object.prototype keys in the grouping map.
    const cloudwatchLogEventsMap = cloudwatchLogEvents.reduce((result, event) => {
      (result[event.logGroupName] ||= []).push(event);
      return result;
    }, Object.create(null));
    const logGroupNames = Object.keys(cloudwatchLogEventsMap);
    if (!logGroupNames.length) {
      log.debug('no log groups to investigate');
      return;
    }

    await Promise.all(
      logGroupNames.map((logGroupName) =>
        this.fixLogGroupSubscriptionFilters({
          accountId,
          region,
          partition,
          logGroupName,
          cloudwatchLogEvents: cloudwatchLogEventsMap[logGroupName],
        })
      )
    );
  },

  async fixLogGroupSubscriptionFilters(params) {
    const accountId = params.accountId;
    const region = params.region;
    const partition = params.partition;
    const logGroupName = params.logGroupName;
    const cloudwatchLogEvents = params.cloudwatchLogEvents;
    const CLOUDWATCHLOG_LOG_GROUP_EVENT_PER_FUNCTION_LIMIT = 2;

    const response = await this.provider
      .request('CloudWatchLogs', 'describeSubscriptionFilters', {
        logGroupName,
      })
      .catch((error) => {
        if (isCloudWatchLogsResourceNotFoundError(error)) return { subscriptionFilters: [] };
        throw error;
      });
    const subscriptionFilters = response.subscriptionFilters || [];
    if (subscriptionFilters.length === 0) {
      log.debug('no subscription filters detected');
      return false;
    }

    const stackName = this.provider.naming.getStackName();
    const oldSubscriptionFilters = await Promise.all(
      subscriptionFilters.map(async (subscriptionFilter) => {
        const { destinationArn, filterName } = subscriptionFilter;
        const logicalId = this.getLogicalIdFromFilterName(filterName);
        const isInternal = logicalId
          ? await this.isInternalSubscriptionFilter(stackName, logicalId, filterName)
          : false;

        return { destinationArn, logicalId, filterName, isInternal };
      })
    );

    const newSubscriptionFilters = cloudwatchLogEvents.map((cloudwatchLogEvent) => {
      const destinationArn = `arn:${partition}:lambda:${region}:${accountId}:function:${cloudwatchLogEvent.FunctionName}`;
      const logicalId = this.provider.naming.getCloudWatchLogLogicalId(
        cloudwatchLogEvent.functionName,
        cloudwatchLogEvent.logSubscriptionSerialNumber
      );

      return { destinationArn, logicalId };
    });
    log.debug('new subscription filters %o', newSubscriptionFilters);

    // If subscription filters defined externally cause a situation where we cannot create all
    // subscription filters defined as a part of current service, we want to throw an error
    // instead of silently removing external filters.
    const externalOldSubscriptionFilters = oldSubscriptionFilters.filter(
      (oldSubscriptionFilter) => !oldSubscriptionFilter.isInternal
    );
    log.debug('external subscription filters %o', externalOldSubscriptionFilters);
    if (
      externalOldSubscriptionFilters.length + newSubscriptionFilters.length >
      CLOUDWATCHLOG_LOG_GROUP_EVENT_PER_FUNCTION_LIMIT
    ) {
      const errorMessage = [
        `Only ${CLOUDWATCHLOG_LOG_GROUP_EVENT_PER_FUNCTION_LIMIT} subscription filters can be configured per log group.`,
        ` There are subscription filters defined outside of the service definition for "${logGroupName}" that have to be deleted manually.`,
      ].join('');
      throw new ServerlessError(
        errorMessage,
        'CLOUDWATCHLOG_LOG_GROUP_EVENT_PER_FUNCTION_LIMIT_EXCEEDED'
      );
    }

    const sameDestinationArn = (sf1, sf2) => sf1.destinationArn === sf2.destinationArn;
    const sameLogicalId = (sf1, sf2) => sf1.logicalId === sf2.logicalId;
    const subscriptionFilterComparator = (sf1, sf2) =>
      sameDestinationArn(sf1, sf2) && sameLogicalId(sf1, sf2);

    const internalOldSubscriptionFilters = oldSubscriptionFilters.filter(
      (oldSubscriptionFilter) => oldSubscriptionFilter.isInternal
    );
    const notMatchedInternalOldSubscriptionFilters = internalOldSubscriptionFilters.filter(
      (internalOldSubscriptionFilter) => {
        const matchNewSubscriptionFilter = newSubscriptionFilters.find((newSubscriptionFilter) =>
          subscriptionFilterComparator(newSubscriptionFilter, internalOldSubscriptionFilter)
        );
        return !matchNewSubscriptionFilter;
      }
    );

    return Promise.all(
      notMatchedInternalOldSubscriptionFilters.map((oldSubscriptionFilter) =>
        this.provider.request('CloudWatchLogs', 'deleteSubscriptionFilter', {
          logGroupName,
          filterName: oldSubscriptionFilter.filterName,
        })
      )
    );
  },

  getLogicalIdFromFilterName(filterName) {
    // Filter name format:
    // {stack name}-{logical id}-{random alphanumeric characters}
    // Note that the stack name can include hyphens
    if (typeof filterName !== 'string') return null;
    const split = filterName.split('-');
    if (split.length < 3) return null;
    const logicalId = split[split.length - 2];
    return /^[A-Za-z][A-Za-z0-9]*$/.test(logicalId) ? logicalId : null;
  },

  async isInternalSubscriptionFilter(stackName, logicalResourceId, physicalResourceId) {
    try {
      const { StackResourceDetail } = await this.provider.request(
        'CloudFormation',
        'describeStackResource',
        {
          StackName: stackName,
          LogicalResourceId: logicalResourceId,
        }
      );

      return physicalResourceId === StackResourceDetail.PhysicalResourceId;
    } catch (error) {
      if (isCloudFormationMissingResourceError(error)) return false;
      throw error;
    }
  },
};
