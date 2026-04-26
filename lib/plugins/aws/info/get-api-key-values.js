'use strict';

const isObject = require('type/object/is');

module.exports = {
  async getApiKeyValues() {
    const info = this.gatheredData.info;
    info.apiKeys = [];

    // check if the user has set api keys
    const apiKeyDefinitions =
      (this.serverless.service.provider.apiGateway &&
        this.serverless.service.provider.apiGateway.apiKeys) ||
      this.serverless.service.provider.apiKeys;
    const apiKeyNames = [];
    if (Array.isArray(apiKeyDefinitions) && apiKeyDefinitions.length) {
      apiKeyDefinitions.forEach((definition) => {
        // different API key types are nested in separate arrays
        if (isObject(definition)) {
          const keyTypeName = Object.keys(definition)[0];
          if (Array.isArray(definition[keyTypeName])) {
            definition[keyTypeName].forEach((keyName) => apiKeyNames.push(keyName));
          } else if (definition.name) {
            apiKeyNames.push(definition.name);
          }
        } else if (typeof definition === 'string') {
          // plain strings are simple, non-nested API keys
          apiKeyNames.push(definition);
        }
      });
    }

    if (apiKeyNames.length) {
      return this.provider
        .request('CloudFormation', 'describeStackResources', {
          StackName: this.provider.naming.getStackName(),
        })
        .then((resources) => {
          const apiKeys = (resources.StackResources || [])
            .filter((resource) => resource.ResourceType === 'AWS::ApiGateway::ApiKey')
            .map((resource) => resource.PhysicalResourceId);
          return Promise.all(
            apiKeys.map((apiKey) =>
              this.provider.request('APIGateway', 'getApiKey', {
                apiKey,
                includeValue: true,
              })
            )
          );
        })
        .then((apiKeys) => {
          if (apiKeys && apiKeys.length) {
            info.apiKeys = apiKeys.map((apiKey) => ({
              name: apiKey.name,
              value: apiKey.value,
              description: apiKey.description,
              customerId: apiKey.customerId,
            }));
          }
          return undefined;
        });
    }
    return undefined;
  },
};
