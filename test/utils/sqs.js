'use strict';

const awsRequest = require('../lib/aws-request');

const getSQSClient = () => {
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
