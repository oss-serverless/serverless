'use strict';

const ServerlessError = require('../../../serverless-error');

async function resolveCfRefValue(provider, resourceLogicalId, sdkParams = {}) {
  const requestMethod = provider._v3Enabled ? 'requestV3' : 'request';
  return provider[requestMethod](
    'CloudFormation',
    'listStackResources',
    Object.assign(sdkParams, { StackName: provider.naming.getStackName() })
  ).then((result) => {
    const targetStackResource = result.StackResourceSummaries.find(
      (stackResource) => stackResource.LogicalResourceId === resourceLogicalId
    );
    if (targetStackResource) return targetStackResource.PhysicalResourceId;
    if (result.NextToken) {
      return resolveCfRefValue(provider, resourceLogicalId, { NextToken: result.NextToken });
    }

    throw new ServerlessError(
      `Could not resolve Ref with name ${resourceLogicalId}. Are you sure this value matches one resource logical ID ?`,
      'CF_REF_RESOLUTION'
    );
  });
}

module.exports = resolveCfRefValue;
