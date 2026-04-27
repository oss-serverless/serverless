'use strict';

const awsRequest = require('../lib/aws-request');

const getEventBridgeClient = () => {
  const EventBridgeService = require('aws-sdk').EventBridge;
  return {
    createEventBus: (params) => awsRequest(EventBridgeService, 'createEventBus', params),
    deleteEventBus: (params) => awsRequest(EventBridgeService, 'deleteEventBus', params),
    describeEventBus: (params) => awsRequest(EventBridgeService, 'describeEventBus', params),
    putEvents: (params) => awsRequest(EventBridgeService, 'putEvents', params),
  };
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
