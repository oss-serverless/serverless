'use strict';

const ServerlessError = require('../../../serverless-error');
const { CloudFormationClient, ListExportsCommand } = require('@aws-sdk/client-cloudformation');

async function resolveCfImportValue(provider, name, sdkParams = {}) {
  const cloudFormation = new CloudFormationClient(await provider.getAwsSdkV3Config());
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
