'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getKinesisClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3
    const { KinesisClient } = require('@aws-sdk/client-kinesis');
    const { 
      CreateStreamCommand,
      DeleteStreamCommand,
      DescribeStreamCommand,
      PutRecordCommand
    } = require('@aws-sdk/client-kinesis');
    
    const client = new KinesisClient({ region: 'us-east-1' });
    
    return {
      createStream: (params) => client.send(new CreateStreamCommand(params)),
      deleteStream: (params) => client.send(new DeleteStreamCommand(params)),
      describeStream: (params) => client.send(new DescribeStreamCommand(params)),
      putRecord: (params) => client.send(new PutRecordCommand(params)),
    };
  } else {
    // AWS SDK v2
    const KinesisService = require('aws-sdk').Kinesis;
    return {
      createStream: (params) => awsRequest(KinesisService, 'createStream', params),
      deleteStream: (params) => awsRequest(KinesisService, 'deleteStream', params),
      describeStream: (params) => awsRequest(KinesisService, 'describeStream', params),
      putRecord: (params) => awsRequest(KinesisService, 'putRecord', params),
    };
  }
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

  return kinesis.createStream(params).then(() =>
    waitForKinesisStream(streamName)
  );
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
