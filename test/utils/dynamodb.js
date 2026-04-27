'use strict';

const awsRequest = require('../lib/aws-request');

const getDynamoDBClient = () => {
  const DDBDocumentClient = require('aws-sdk').DynamoDB.DocumentClient;
  return {
    put: (params) => awsRequest(DDBDocumentClient, 'put', params),
  };
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
