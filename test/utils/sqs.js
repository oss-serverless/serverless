'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getSQSClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3
    const { SQSClient } = require('@aws-sdk/client-sqs');
    const {
      CreateQueueCommand,
      DeleteQueueCommand,
      GetQueueUrlCommand,
      SendMessageCommand,
    } = require('@aws-sdk/client-sqs');

    const client = new SQSClient({ region: 'us-east-1' });

    return {
      createQueue: (params) => client.send(new CreateQueueCommand(params)),
      deleteQueue: (params) => client.send(new DeleteQueueCommand(params)),
      getQueueUrl: (params) => client.send(new GetQueueUrlCommand(params)),
      sendMessage: (params) => client.send(new SendMessageCommand(params)),
    };
  }
  // AWS SDK v2
  const SQSService = require('aws-sdk').SQS;
  return {
    createQueue: (params) => awsRequest(SQSService, 'createQueue', params),
    deleteQueue: (params) => awsRequest(SQSService, 'deleteQueue', params),
    getQueueUrl: (params) => awsRequest(SQSService, 'getQueueUrl', params),
    sendMessage: (params) => awsRequest(SQSService, 'sendMessage', params),
  };
};

const sqs = getSQSClient();

async function createSqsQueue(queueName) {
  const params = {
    QueueName: queueName,
  };

  return sqs.createQueue(params);
}

async function deleteSqsQueue(queueName) {
  return sqs.getQueueUrl({ QueueName: queueName }).then((data) => {
    const params = {
      QueueUrl: data.QueueUrl,
    };
    return sqs.deleteQueue(params);
  });
}

async function sendSqsMessage(queueName, message) {
  return sqs.getQueueUrl({ QueueName: queueName }).then((data) => {
    const params = {
      QueueUrl: data.QueueUrl,
      MessageBody: message,
    };
    return sqs.sendMessage(params);
  });
}

module.exports = {
  createSqsQueue,
  deleteSqsQueue,
  sendSqsMessage,
};
