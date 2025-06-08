'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getEventBridgeClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3
    const { EventBridgeClient } = require('@aws-sdk/client-eventbridge');
    const {
      CreateEventBusCommand,
      DeleteEventBusCommand,
      DescribeEventBusCommand,
      PutEventsCommand,
    } = require('@aws-sdk/client-eventbridge');

    const client = new EventBridgeClient({ region: 'us-east-1' });

    return {
      createEventBus: (params) => client.send(new CreateEventBusCommand(params)),
      deleteEventBus: (params) => client.send(new DeleteEventBusCommand(params)),
      describeEventBus: (params) => client.send(new DescribeEventBusCommand(params)),
      putEvents: (params) => client.send(new PutEventsCommand(params)),
    };
  } else {
    // AWS SDK v2
    const EventBridgeService = require('aws-sdk').EventBridge;
    return {
      createEventBus: (params) => awsRequest(EventBridgeService, 'createEventBus', params),
      deleteEventBus: (params) => awsRequest(EventBridgeService, 'deleteEventBus', params),
      describeEventBus: (params) => awsRequest(EventBridgeService, 'describeEventBus', params),
      putEvents: (params) => awsRequest(EventBridgeService, 'putEvents', params),
    };
  }
};

const eventBridge = getEventBridgeClient();

async function createEventBus(name) {
  return eventBridge.createEventBus({ Name: name });
}

async function deleteEventBus(name) {
  return eventBridge.deleteEventBus({ Name: name });
}

async function describeEventBus(name) {
  return eventBridge.describeEventBus({ Name: name });
}

async function putEvents(EventBusName, Entries) {
  Entries.map((entry) => (entry.EventBusName = EventBusName));
  const params = {
    Entries,
  };
  return eventBridge.putEvents(params);
}

module.exports = {
  createEventBus,
  deleteEventBus,
  describeEventBus,
  putEvents,
};
