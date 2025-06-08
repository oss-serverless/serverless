'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getDynamoDBClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3 - using DynamoDBDocumentClient from lib-dynamodb
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({ region: 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client);
    
    return {
      put: (params) => docClient.send(new PutCommand(params)),
    };
  } else {
    // AWS SDK v2
    const DDBDocumentClient = require('aws-sdk').DynamoDB.DocumentClient;
    return {
      put: (params) => awsRequest(DDBDocumentClient, 'put', params),
    };
  }
};

const dynamodb = getDynamoDBClient();

async function putDynamoDbItem(tableName, item) {
  const params = {
    TableName: tableName,
    Item: item,
  };

  return dynamodb.put(params);
}

module.exports = {
  putDynamoDbItem,
};
