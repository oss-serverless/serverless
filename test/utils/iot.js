'use strict';

const awsRequest = require('../lib/aws-request');

const getIoTClients = () => {
  const IotService = require('aws-sdk').Iot;
  const IotDataService = require('aws-sdk').IotData;
  return {
    iot: {
      describeEndpoint: (params) => awsRequest(IotService, 'describeEndpoint', params),
    },
    createIoTDataClient: (endpoint) => ({
      publish: (params) =>
        awsRequest({ client: IotDataService, params: { endpoint } }, 'publish', params),
    }),
  };
};

const { iot, createIoTDataClient } = getIoTClients();

async function resolveIotEndpoint() {
  return iot.describeEndpoint({ endpointType: 'iot:Data-ATS' }).then((data) => {
    return data.endpointAddress;
  });
}

async function publishIotData(topic, message) {
  return resolveIotEndpoint().then((endpoint) => {
    const params = {
      topic,
      payload: Buffer.from(message),
    };

    const iotDataClient = createIoTDataClient(endpoint);
    return iotDataClient.publish(params);
  });
}

module.exports = {
  resolveIotEndpoint,
  publishIotData,
};
