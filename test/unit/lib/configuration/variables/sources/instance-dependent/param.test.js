'use strict';

const { expect } = require('chai');
const _ = require('lodash');

const resolveMeta = require('../../../../../../../lib/configuration/variables/resolve-meta');
const resolve = require('../../../../../../../lib/configuration/variables/resolve');
const selfSource = require('../../../../../../../lib/configuration/variables/sources/self');
const getParamSource = require('../../../../../../../lib/configuration/variables/sources/instance-dependent/param');
const Serverless = require('../../../../../../../lib/serverless');

describe('test/unit/lib/configuration/variables/sources/instance-dependent/param.test.js', () => {
  let configuration;
  let variablesMeta;
  let serverlessInstance;

  const initializeServerless = async ({ configExt, options, setupOptions = {} } = {}) => {
    configuration = {
      service: 'foo',
      provider: {
        name: 'aws',
        deploymentBucket: '${param:bucket}',
        timeout: '${param:timeout}',
      },
      custom: {
        missingAddress: '${param:}',
        unsupportedAddress: '${param:foo}',
        nonStringAddress: '${param:${self:custom.someObject}}',
        someObject: {},
      },
      params: {
        default: {
          bucket: 'global.bucket',
          timeout: 10,
        },
        dev: {
          bucket: 'my.bucket',
        },
      },
    };
    if (configExt) {
      configuration = _.merge(configuration, configExt);
    }
    variablesMeta = resolveMeta(configuration);
    serverlessInstance = new Serverless({
      configuration,
      serviceDir: process.cwd(),
      configurationFilename: 'serverless.yml',
      commands: ['package'],
      options: options || {},
    });
    serverlessInstance.init();
    await resolve({
      serviceDir: process.cwd(),
      configuration,
      variablesMeta,
      sources: {
        self: selfSource,
        param: getParamSource(setupOptions.withoutInstance ? null : serverlessInstance),
      },
      options: options || {},
      fulfilledSources: new Set(['self', 'param']),
    });
  };

  it('should resolve ${param:timeout}', async () => {
    await initializeServerless();
    if (variablesMeta.get('param\0timeout')) throw variablesMeta.get('param\0timeout').error;
    expect(configuration.provider.timeout).to.equal(10);
  });

  it('should resolve ${param:bucket} for different stages', async () => {
    // Dev by default
    await initializeServerless();
    expect(configuration.provider.deploymentBucket).to.equal('my.bucket');

    // Forced prod
    await initializeServerless({
      configExt: {
        provider: {
          stage: 'prod',
        },
      },
    });
    expect(configuration.provider.deploymentBucket).to.equal('global.bucket');
  });

  it('should resolve ${param:bucket} when no serverless instance available', async () => {
    await initializeServerless({ setupOptions: { withoutInstance: true } });
    expect(variablesMeta.get('provider\0timeout')).to.have.property('variables');
    expect(variablesMeta.get('provider\0timeout')).to.not.have.property('error');
  });

  it('should report with an error missing address', async () => {
    await initializeServerless();
    expect(variablesMeta.get('custom\0missingAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });

  it('should report with an error unsupported address', async () => {
    await initializeServerless();
    expect(variablesMeta.get('custom\0unsupportedAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });

  it('should report with an error a non-string address', async () => {
    await initializeServerless();
    expect(variablesMeta.get('custom\0nonStringAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });
});
