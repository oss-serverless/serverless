'use strict';

const ServerlessError = require('../../../serverless-error');
const { CloudFormationClient, ListExportsCommand } = require('@aws-sdk/client-cloudformation');

function getCloudFormationClient(provider) {
  provider.resolveCfImportValueCloudFormationClientPromise ||= provider
    .getAwsSdkV3Config()
    .then((config) => new CloudFormationClient(config));
  return provider.resolveCfImportValueCloudFormationClientPromise;
}

async function resolveCfImportValue(provider, name, sdkParams = {}) {
  const cloudFormation = await getCloudFormationClient(provider);
  let nextToken = sdkParams.NextToken;

  do {
    const input = { ...sdkParams };
    if (nextToken) input.NextToken = nextToken;
    else delete input.NextToken;

    const result = await cloudFormation.send(new ListExportsCommand(input));
    const targetExportMeta = (result.Exports || []).find((exportMeta) => exportMeta.Name === name);
    if (targetExportMeta) return targetExportMeta.Value;
    nextToken = result.NextToken;
  } while (nextToken);

  throw new ServerlessError(
    `Could not resolve Fn::ImportValue with name ${name}. Are you sure this value is exported?`,
    'CF_IMPORT_RESOLUTION'
  );
}

module.exports = resolveCfImportValue;
