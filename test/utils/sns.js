'use strict';

const awsRequest = require('../lib/aws-request');

const getSNSClient = () => {
  const SNSService = require('aws-sdk').SNS;
  return {
    createTopic: (params) => awsRequest(SNSService, 'createTopic', params),
    deleteTopic: (params) => awsRequest(SNSService, 'deleteTopic', params),
    listTopics: (params) => awsRequest(SNSService, 'listTopics', params),
    publish: (params) => awsRequest(SNSService, 'publish', params),
  };
};

const sns = getSNSClient();

async function createSnsTopic(topicName) {
  const params = {
    Name: topicName,
  };

  return sns.createTopic(params);
}

async function resolveTopicArn(topicName, nextToken = null) {
  return sns.listTopics({ NextToken: nextToken }).then((data) => {
    const targetTopic = data.Topics.find((topic) => RegExp(topicName, 'g').test(topic.TopicArn));

    if (targetTopic) return targetTopic.TopicArn;

    if (data.NextToken) return resolveTopicArn(topicName, data.NextToken);
    return null;
  });
}

async function removeSnsTopic(topicName) {
  return resolveTopicArn(topicName).then((topicArn) => {
    const params = {
      TopicArn: topicArn,
    };

    return sns.deleteTopic(params);
  });
}

async function publishSnsMessage(topicName, message, messageAttributes = null) {
  return resolveTopicArn(topicName).then((topicArn) => {
    const params = {
      Message: message,
      TopicArn: topicArn,
    };
    if (messageAttributes) {
      params.MessageAttributes = messageAttributes;
    }

    return sns.publish(params);
  });
}

module.exports = {
  createSnsTopic,
  removeSnsTopic,
  publishSnsMessage,
};
