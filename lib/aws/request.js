'use strict';

const memoize = require('memoizee');
const promiseLimit = require('ext/promise/limit').bind(Promise);
const sdk = require('./sdk-v2');
const { log } = require('../utils/serverless-utils/log');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const https = require('https');
const fs = require('fs');
const deepSortObjectByKey = require('../utils/deep-sort-object-by-key');
const ensureString = require('type/string/ensure');
const isObject = require('type/object/is');
const wait = require('../utils/sleep');
const AWSClientFactory = require('./client-factory');
const { createCommand } = require('./commands');
const { buildClientConfig } = require('./config');
const { toV3CredentialsProvider } = require('./credentials');
const { createAwsServerlessError } = require('./error-utils');
const { normalizeV3Response } = require('./response-normalizer');

// Activate AWS SDK logging
const awsLog = log.get('aws');

// Use HTTPS Proxy (Optional)
const proxy =
  process.env.proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.https_proxy;

const proxyOptions = {};
if (proxy) {
  // not relying on recommended WHATWG URL
  // due to missing support for it in https-proxy-agent
  // https://github.com/TooTallNate/node-https-proxy-agent/issues/117
  Object.assign(proxyOptions, url.parse(proxy));
}

const ca = process.env.ca || process.env.HTTPS_CA || process.env.https_ca;

let caCerts = [];

if (ca) {
  // Can be a single certificate or multiple, comma separated.
  const caArr = ca.split(',');
  // Replace the newline -- https://stackoverflow.com/questions/30400341
  caCerts = caCerts.concat(caArr.map((cert) => cert.replace(/\\n/g, '\n')));
}

const cafile = process.env.cafile || process.env.HTTPS_CAFILE || process.env.https_cafile;

if (cafile) {
  // Can be a single certificate file path or multiple paths, comma separated.
  const caPathArr = cafile.split(',');
  caCerts = caCerts.concat(caPathArr.map((cafilePath) => fs.readFileSync(cafilePath.trim())));
}

if (caCerts.length > 0) {
  Object.assign(proxyOptions, {
    rejectUnauthorized: true,
    ca: caCerts,
  });
}

// Passes also certifications
if (proxy) {
  sdk.config.httpOptions.agent = new HttpsProxyAgent(proxyOptions);
} else if (proxyOptions.ca) {
  // Update the agent -- http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-registering-certs.html
  sdk.config.httpOptions.agent = new https.Agent(proxyOptions);
}

// Configure the AWS Client timeout (Optional).  The default is 120000 (2 minutes)
const timeout = process.env.AWS_CLIENT_TIMEOUT || process.env.aws_client_timeout;
if (timeout) {
  sdk.config.httpOptions.timeout = parseInt(timeout, 10);
}
const requestQueue = promiseLimit(2, async (task) => task());

const MAX_RETRIES = (() => {
  const userValue = Number(process.env.SLS_AWS_REQUEST_MAX_RETRIES);
  return userValue >= 0 ? userValue : 4;
})();

const accelerationCompatibleS3Methods = new Set(['upload', 'putObject']);
let v3ClientFactory;

const shouldS3Accelerate = (method, params) => {
  if (
    accelerationCompatibleS3Methods.has(method) &&
    params &&
    params.isS3TransferAccelerationEnabled
  ) {
    log.notice('Using S3 Transfer Acceleration Endpoint...');
    return true;
  }
  return false;
};

const getServiceInstance = memoize(
  (service, method) => {
    const Service = service.name.split('.').reduce((current, key) => {
      return current ? current[key] : undefined;
    }, sdk);
    // we translate params to an object for the service creation by selecting keys of interest
    const serviceParams = { ...service.params };
    if (service.name === 'S3') {
      serviceParams.useAccelerateEndpoint = shouldS3Accelerate(method, service.params);
    }
    return new Service(serviceParams);
  },
  {
    normalizer: ([service, method]) => {
      return [JSON.stringify(deepSortObjectByKey(service)), method].join('|');
    },
  }
);

let requestCounter = 0;

function getV3ClientFactory() {
  if (!v3ClientFactory) v3ClientFactory = new AWSClientFactory();
  return v3ClientFactory;
}

function buildV3ClientConfig(service, method) {
  const serviceParams = service.params || {};
  const clientConfig = buildClientConfig({
    region: serviceParams.region,
    credentials: toV3CredentialsProvider(serviceParams),
    maxAttempts: 1,
  });

  if (service.name === 'S3' && shouldS3Accelerate(method, serviceParams)) {
    clientConfig.useAccelerateEndpoint = true;
  }

  return clientConfig;
}

async function sendV2Request(service, method, args) {
  const awsService = getServiceInstance(service, method);
  const req = awsService[method](...args);
  return req.promise();
}

async function sendV3Request(service, method, args) {
  const command = createCommand(service.name, method, args[0]);
  const clientConfig = buildV3ClientConfig(service, method);
  const result = await getV3ClientFactory().send(service.name, command, clientConfig);
  return normalizeV3Response(service.name, method, result);
}

function shouldUseV3() {
  return process.env.SLS_AWS_SDK_V3 === '1';
}

function isV3MappingError(error) {
  return (
    error &&
    (error.code === 'AWS_SDK_V3_UNKNOWN_SERVICE' || error.code === 'AWS_SDK_V3_UNKNOWN_METHOD')
  );
}

/** Execute request to AWS service
 * @param {Object|string} [service] - Description of the service to call
 * @prop [service.name] - Name of the service to call, support subclasses
 * @prop [service.params] - Parameters to apply when creating the service and doing the request
 * @prop [service.params.credentials] - AWS Credentials to use
 * @prop [service.params.useCache ] - Wether to reuse result of the same request cached locally
 * @prop [service.params.region] - Region in which the call should be made (default to us-east-1)
 * @prop [service.params.isS3TransferAccelerationEnabled] - Use s3 acceleration when available for the request
 * @param {String} method - Method to call
 * @param {Array} args - Argument for the method call
 */
async function awsRequest(service, method, ...args) {
  // Checks regarding expectations on service object
  if (isObject(service)) {
    ensureString(service.name, { name: 'service.name' });
  } else {
    ensureString(service, { name: 'service' });
    service = { name: service };
  }
  const BASE_BACKOFF = 5000;
  const persistentRequest = async (f, numTry = 0) => {
    try {
      return await f();
    } catch (e) {
      const { providerError } = e;
      if (
        numTry < MAX_RETRIES &&
        providerError &&
        ((providerError.retryable &&
          providerError.statusCode !== 403 &&
          providerError.code !== 'CredentialsError' &&
          providerError.code !== 'ExpiredTokenException') ||
          providerError.statusCode === 429)
      ) {
        const nextTryNum = numTry + 1;
        const jitter = Math.random() * 3000 - 1000;
        // backoff is between 4 and 7 seconds
        const backOff = BASE_BACKOFF + jitter;
        log.info(
          [
            `Recoverable error occurred (${e.message}), sleeping for ~${Math.round(
              backOff / 1000
            )} seconds.`,
            `Try ${nextTryNum} of ${MAX_RETRIES}`,
          ].join(' ')
        );
        await wait(backOff);
        return persistentRequest(f, nextTryNum);
      }
      throw e;
    }
  };
  const request = await requestQueue(() =>
    persistentRequest(async () => {
      const requestId = ++requestCounter;
      awsLog.debug('[%d] %O %s %O', requestId, service, method, args);
      const sendRequest = shouldUseV3() ? sendV3Request : sendV2Request;
      try {
        const result = await sendRequest(service, method, args);
        awsLog.debug('[%d] %O', requestId, result);
        return result;
      } catch (err) {
        awsLog.debug('[%d] %O', requestId, err);
        if (isV3MappingError(err)) throw err;
        if (err.stack) {
          log.debug(`${err.stack}\n${'-'.repeat(100)}`);
        }
        throw createAwsServerlessError({
          error: err,
          serviceName: service.name,
          methodName: method,
        });
      }
    })
  );
  return request;
}

awsRequest.memoized = memoize(awsRequest, {
  promise: true,
  normalizer: ([service, method, args]) => {
    if (!isObject(service)) service = { name: ensureString(service) };
    return [
      JSON.stringify(deepSortObjectByKey(service)),
      method,
      JSON.stringify(deepSortObjectByKey(args)),
    ].join('|');
  },
});

module.exports = awsRequest;
