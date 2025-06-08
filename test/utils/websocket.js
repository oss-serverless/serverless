'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getApiGatewayV2Client = () => {
  if (process.env.SLS_AWS_SDK_V3 === '1') {
    // AWS SDK v3
    const { ApiGatewayV2Client } = require('@aws-sdk/client-apigatewayv2');
    const {
      CreateApiCommand,
      DeleteApiCommand,
      CreateStageCommand,
      DeleteStageCommand,
      GetRoutesCommand,
    } = require('@aws-sdk/client-apigatewayv2');

    const client = new ApiGatewayV2Client({ region: 'us-east-1' });

    return {
      createApi: (params) => client.send(new CreateApiCommand(params)),
      deleteApi: (params) => client.send(new DeleteApiCommand(params)),
      createStage: (params) => client.send(new CreateStageCommand(params)),
      deleteStage: (params) => client.send(new DeleteStageCommand(params)),
      getRoutes: (params) => client.send(new GetRoutesCommand(params)),
    };
  }
  // AWS SDK v2
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
