'use strict';

const ensureObject = require('type/object/ensure');
const ensurePlainObject = require('type/plain-object/ensure');
const ensureFunction = require('type/plain-function/ensure');
const sinon = require('sinon');

module.exports = (provider, config) => {
  ensureObject(provider);
  ensureFunction(provider.request);
  ensurePlainObject(config);

  if (provider.request.restore) provider.request.restore();

  return sinon.stub(provider, 'request').callsFake(
    (service, methodName, ...args) =>
      new Promise((resolve, reject) => {
        if (!config[service] || !config[service][methodName]) {
          reject(new Error(`Missing AWS request stub configuration for ${service}.${methodName}`));
          return;
        }

        const method = config[service][methodName];
        resolve(typeof method === 'function' ? method(...args) : method);
      })
  );
};
