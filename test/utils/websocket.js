'use strict';

const awsRequest = require('../lib/aws-request');

const getApiGatewayV2Client = () => {
  const ApiGatewayV2Service = require('aws-sdk').ApiGatewayV2;
  return {
    createApi: (params) => awsRequest(ApiGatewayV2Service, 'createApi', params),
    deleteApi: (params) => awsRequest(ApiGatewayV2Service, 'deleteApi', params),
    createStage: (params) => awsRequest(ApiGatewayV2Service, 'createStage', params),
    deleteStage: (params) => awsRequest(ApiGatewayV2Service, 'deleteStage', params),
    getRoutes: (params) => awsRequest(ApiGatewayV2Service, 'getRoutes', params),
  };
};

const apiGatewayV2 = getApiGatewayV2Client();

async function createApi(name) {
  return apiGatewayV2.createApi({
    Name: name,
    ProtocolType: 'WEBSOCKET',
    RouteSelectionExpression: '$request.body.action',
  });
}

async function createStage(apiId, stageName) {
  const params = {
    ApiId: apiId,
    StageName: stageName,
  };
  return apiGatewayV2.createStage(params);
}

async function deleteApi(id) {
  return apiGatewayV2.deleteApi({
    ApiId: id,
  });
}

async function deleteStage(apiId, stageName) {
  const params = {
    ApiId: apiId,
    StageName: stageName,
  };
  return apiGatewayV2.deleteStage(params);
}

async function getRoutes(apiId) {
  return apiGatewayV2.getRoutes({ ApiId: apiId }).then((data) => data.Items);
}

module.exports = {
  createApi,
  deleteApi,
  getRoutes,
  createStage,
  deleteStage,
};
