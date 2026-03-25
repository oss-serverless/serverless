'use strict';

const _ = require('lodash');
const awsRequest = require('../lib/aws-request');

// Support for both AWS SDK v2 and v3
const getAPIGatewayClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === '1') {
    // AWS SDK v3
    const { APIGatewayClient } = require('@aws-sdk/client-api-gateway');
    const {
      CreateRestApiCommand,
      DeleteRestApiCommand,
      GetResourcesCommand,
      GetRestApisCommand,
    } = require('@aws-sdk/client-api-gateway');

    const client = new APIGatewayClient({ region: 'us-east-1' });

    return {
      createRestApi: (params) => client.send(new CreateRestApiCommand(params)),
      deleteRestApi: (params) => client.send(new DeleteRestApiCommand(params)),
      getResources: (params) => client.send(new GetResourcesCommand(params)),
      getRestApis: (params) => client.send(new GetRestApisCommand(params)),
    };
  }
  // AWS SDK v2
  const APIGatewayService = require('aws-sdk').APIGateway;
  return {
    createRestApi: (params) => awsRequest(APIGatewayService, 'createRestApi', params),
    deleteRestApi: (params) => awsRequest(APIGatewayService, 'deleteRestApi', params),
    getResources: (params) => awsRequest(APIGatewayService, 'getResources', params),
    getRestApis: (params) => awsRequest(APIGatewayService, 'getRestApis', params),
  };
};

const apiGateway = getAPIGatewayClient();

async function createRestApi(name) {
  const params = {
    name,
  };

  return apiGateway.createRestApi(params);
}

async function deleteRestApi(restApiId) {
  const params = {
    restApiId,
  };

  return apiGateway.deleteRestApi(params);
}

async function getResources(restApiId) {
  const params = {
    restApiId,
  };

  return apiGateway.getResources(params).then((data) => data.items);
}

async function findRestApis(name) {
  const params = {
    limit: 500,
  };

  async function recursiveFind(found, position) {
    if (position) params.position = position;
    return apiGateway.getRestApis(params).then((result) => {
      const matches = result.items.filter((restApi) => restApi.name.match(name));
      if (matches.length) {
        _.merge(found, matches);
      }
      if (result.position) return recursiveFind(found, result.position);
      return found;
    });
  }

  return recursiveFind([]);
}

module.exports = {
  createRestApi,
  deleteRestApi,
  getResources,
  findRestApis,
};
