'use strict';

const _ = require('lodash');
const memoizee = require('memoizee');
const ensureString = require('type/string/ensure');
const ServerlessError = require('../../../../serverless-error');

const resolveParams = memoizee(async (stage, serverlessInstance) => {
  const configParams = new Map(
    Object.entries(_.get(serverlessInstance.configurationInput, 'params') || {})
  );

  const resultParams = Object.create(null);

  for (const [name, value] of Object.entries(configParams.get(stage) || {})) {
    if (value == null) continue;
    if (resultParams[name] != null) continue;
    resultParams[name] = { value, type: 'configServiceStage' };
  }

  for (const [name, value] of new Map(Object.entries(configParams.get('default') || {}))) {
    if (value == null) continue;
    if (resultParams[name] != null) continue;
    resultParams[name] = { value, type: 'configService' };
  }

  return resultParams;
});

module.exports = (serverlessInstance) => {
  return {
    resolve: async ({ address, resolveConfigurationProperty, options }) => {
      if (!address) {
        throw new ServerlessError(
          'Missing address argument in variable "param" source',
          'MISSING_PARAM_SOURCE_ADDRESS'
        );
      }
      address = ensureString(address, {
        Error: ServerlessError,
        errorMessage: 'Non-string address argument in variable "param" source: %v',
        errorCode: 'INVALID_PARAM_SOURCE_ADDRESS',
      });
      if (!serverlessInstance) return { value: null, isPending: true };

      let stage = options.stage;
      if (!stage) stage = await resolveConfigurationProperty(['provider', 'stage']);
      if (!stage) stage = 'dev';

      const params = await resolveParams(stage, serverlessInstance);
      const value = params[address] ? params[address].value : null;
      const result = { value };

      if (value == null) {
        throw new ServerlessError(
          `The param "${address}" cannot be resolved from stage params. If you are using Serverless Framework Compose, make sure to run commands via Compose so that all parameters can be resolved`,
          'MISSING_PARAM_SOURCE_ADDRESS'
        );
      }

      return result;
    },
  };
};
