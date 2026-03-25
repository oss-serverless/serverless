'use strict';

const isPlainObject = require('type/plain-object/is');
const isThenable = require('type/thenable/is');
const ensureConstructor = require('type/constructor/ensure');
const ensurePlainObject = require('type/plain-object/ensure');
const memoizeWeak = require('memoizee/weak');
const awsLog = require('log').get('aws');
const wait = require('timers-ext/promise/sleep');

const getClientInstance = memoizeWeak(
  (Client, options) => {
    const params = { region: 'us-east-1', ...options };
    return new Client(params);
  },
  { normalizer: (ignore, [options]) => JSON.stringify(options) }
);

const resolveClientData = (clientOrClientConfig) => {
  if (isPlainObject(clientOrClientConfig)) {
    return [
      ensureConstructor(clientOrClientConfig.client),
      ensurePlainObject(clientOrClientConfig.params, { default: {} }),
    ];
  }
  return [ensureConstructor(clientOrClientConfig), {}];
};

let lastAwsRequestId = 0;
module.exports = function awsRequest(clientOrClientConfig, method, ...args) {
  const requestId = ++lastAwsRequestId;
  awsLog.debug('[%d] %O %s %O', requestId, clientOrClientConfig, method, args);
  const instance = getClientInstance(...resolveClientData(clientOrClientConfig));
  const response = instance[method](...args);
  const promise = isThenable(response) ? response : response.promise();
  return promise.then(
    (result) => {
      awsLog.debug('[%d] %O', requestId, result);
      return result;
    },
    (error) => {
      awsLog.debug('[%d] %O', requestId, error);
      const shouldRetry = (() => {
        if (error.statusCode === 403) return false;
        if (error.retryable) return true;
        if (error.Reason === 'CallerRateLimitExceeded') return true;
        if (error.message.includes('Rate exceeded')) return true;
        if (error.message.includes('Too Many Requests')) return true;
        return false;
      })();
      if (shouldRetry) {
        awsLog.debug('[%d] retry', requestId);
        return wait(4000 + Math.random() * 3000).then(() =>
          awsRequest(clientOrClientConfig, method, ...args)
        );
      }
      throw error;
    }
  );
};
