'use strict';

const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getIoTClients = () => {
  if (process.env.SLS_AWS_SDK_V3 === 'true') {
    // AWS SDK v3 - dual service pattern (IoT + IoTDataPlane)
    const { IoTClient, DescribeEndpointCommand } = require('@aws-sdk/client-iot');
    const { IoTDataPlaneClient, PublishCommand } = require('@aws-sdk/client-iot-data-plane');

    const iotClient = new IoTClient({ region: 'us-east-1' });

    return {
      iot: {
        describeEndpoint: (params) => iotClient.send(new DescribeEndpointCommand(params)),
      },
      createIoTDataClient: (endpoint) => {
        const iotDataClient = new IoTDataPlaneClient({
          region: 'us-east-1',
          endpoint: `https://${endpoint}`,
        });
        return {
          publish: (params) => iotDataClient.send(new PublishCommand(params)),
        };
      },
    };
  } else {
    // AWS SDK v2
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
  }
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
