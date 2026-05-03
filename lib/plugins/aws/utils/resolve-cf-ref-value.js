'use strict';

const ServerlessError = require('../../../serverless-error');

async function resolveCfRefValue(provider, resourceLogicalId, sdkParams = {}) {
  return provider
    .request('CloudFormation', 'listStackResources', {
      ...sdkParams,
      StackName: provider.naming.getStackName(),
    })
    .then((result) => {
      const targetStackResource = (result.StackResourceSummaries || []).find(
        (stackResource) => stackResource.LogicalResourceId === resourceLogicalId
      );
      if (targetStackResource) return targetStackResource.PhysicalResourceId;
      if (result.NextToken) {
        return resolveCfRefValue(provider, resourceLogicalId, {
          ...sdkParams,
          NextToken: result.NextToken,
        });
      }

      throw new ServerlessError(
        `Could not resolve Ref with name ${resourceLogicalId}. Are you sure this value matches a resource logical ID?`,
        'CF_REF_RESOLUTION'
      );
    });
}

module.exports = resolveCfRefValue;
