'use strict';

const awsRequest = require('../lib/aws-request');

const getKinesisClient = () => {
  const KinesisService = require('aws-sdk').Kinesis;
  return {
    createStream: (params) => awsRequest(KinesisService, 'createStream', params),
    deleteStream: (params) => awsRequest(KinesisService, 'deleteStream', params),
    describeStream: (params) => awsRequest(KinesisService, 'describeStream', params),
    putRecord: (params) => awsRequest(KinesisService, 'putRecord', params),
  };
};

const kinesis = getKinesisClient();

async function waitForKinesisStream(streamName) {
  const params = {
    StreamName: streamName,
  };
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      kinesis.describeStream(params).then((data) => {
        const status = data.StreamDescription.StreamStatus;
        if (status === 'ACTIVE') {
          clearInterval(interval);
          return resolve(data);
        }
        return null;
      });
    }, 2000);
  });
}

async function createKinesisStream(streamName) {
  const params = {
    ShardCount: 1, // prevent complications from shards being processed in parallel
    StreamName: streamName,
  };

  return kinesis.createStream(params).then(() => waitForKinesisStream(streamName));
}

async function deleteKinesisStream(streamName) {
  const params = {
    StreamName: streamName,
  };

  return kinesis.deleteStream(params);
}

async function putKinesisRecord(streamName, message) {
  const params = {
    StreamName: streamName,
    Data: message,
    PartitionKey: streamName, // test streams are single shards
  };

  return kinesis.putRecord(params);
}

module.exports = {
  createKinesisStream,
  deleteKinesisStream,
  putKinesisRecord,
};
