'use strict';

const ServerlessError = require('../../../serverless-error');

async function resolveCfImportValue(provider, name, sdkParams = {}) {
  const requestMethod = provider._v3Enabled ? 'requestV3' : 'request';
  return provider[requestMethod]('CloudFormation', 'listExports', sdkParams).then((result) => {
    const targetExportMeta = result.Exports.find((exportMeta) => exportMeta.Name === name);
    if (targetExportMeta) return targetExportMeta.Value;
    if (result.NextToken) {
      return resolveCfImportValue(provider, name, { NextToken: result.NextToken });
    }

    throw new ServerlessError(
      `Could not resolve Fn::ImportValue with name ${name}. Are you sure this value is exported ?`,
      'CF_IMPORT_RESOLUTION'
    );
  });
}

module.exports = resolveCfImportValue;
