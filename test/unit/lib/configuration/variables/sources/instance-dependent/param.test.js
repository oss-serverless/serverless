'use strict';

const { expect } = require('chai');

const resolveMeta = require('../../../../../../../lib/configuration/variables/resolve-meta');
const resolve = require('../../../../../../../lib/configuration/variables/resolve');
const selfSource = require('../../../../../../../lib/configuration/variables/sources/self');
const getParamSource = require('../../../../../../../lib/configuration/variables/sources/instance-dependent/param');
const Serverless = require('../../../../../../../lib/serverless');

describe('test/unit/lib/configuration/variables/sources/instance-dependent/param.test.js', () => {
  const runServerless = async ({
    cliParameters = [],
    stageParameters = {},
    stage,
    resolveWithoutInstance = false,
  } = {}) => {
    const configuration = {
      service: 'param-test-service',
      provider: {
        stage,
        name: 'aws',
        deploymentBucket: '${param:bucket}',
        timeout: '${param:timeout}',
        region: '${param:region}',
      },
      custom: {
        missingAddress: '${param:}',
        unsupportedAddress: '${param:foo}',
        nonStringAddress: '${param:${self:custom.someObject}}',
        someObject: {},
      },
      params: stageParameters,
    };

    const variablesMeta = resolveMeta(configuration);

    const serverlessInstance = new Serverless({
      configuration,
      options: {
        param: cliParameters,
      },
      serviceDir: process.cwd(),
      configurationFilename: 'serverless.yml',
      commands: ['package'],
    });

    serverlessInstance.init();

    await resolve({
      serviceDir: process.cwd(),
      configuration,
      variablesMeta,
      sources: {
        self: selfSource,
        param: getParamSource(resolveWithoutInstance ? null : serverlessInstance),
      },
      options: {
        param: cliParameters,
      },
      fulfilledSources: new Set(['self', 'param']),
    });

    return {
      configuration,
      serverlessInstance,
      variablesMeta,
    };
  };

  it('should resolve parameters from CLI parameters', async () => {
    const { configuration } = await runServerless({
      cliParameters: ['region=eu-west-1'],
    });
    expect(configuration.provider.region).to.equal('eu-west-1');
  });

  it('should resolve parameter from parameters for the configured stage', async () => {
    const { configuration } = await runServerless({
      stageParameters: {
        staging: {
          timeout: 10,
        },
      },
      stage: 'staging',
    });
    expect(configuration.provider.timeout).to.equal(10);
  });

  it('should resolve parameter from default parameters if the parameter is not set for the configured stage', async () => {
    const { configuration } = await runServerless({
      stageParameters: {
        staging: {},
        default: {
          bucket: 'global.bucket',
        },
      },
      stage: 'staging',
    });
    expect(configuration.provider.deploymentBucket).to.equal('global.bucket');
  });

  it('should resolve parameter from `dev` parameter if the stage is not configured', async () => {
    const { configuration } = await runServerless({
      stageParameters: {
        dev: {
          timeout: 5,
        },
        staging: {
          timeout: 10,
        },
      },
    });
    expect(configuration.provider.timeout).to.equal(5);
  });

  it('should treat CLI parameters with a higher precedence than stage parameters', async () => {
    const { configuration } = await runServerless({
      cliParameters: ['region=eu-west-2'],
      stageParameters: {
        staging: {
          region: 'eu-west-1',
        },
      },
      stage: 'staging',
    });
    expect(configuration.provider.region).to.equal('eu-west-2');
  });

  it('should report with an error when the CLI parameter is invalid', async () => {
    const { variablesMeta } = await runServerless({
      cliParameters: ['region'],
    });

    expect(variablesMeta.get('provider\0region').error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
  });

  it('should report with an error when the address is missing', async () => {
    const { variablesMeta } = await runServerless();
    expect(variablesMeta.get('custom\0missingAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });

  it('should report with an error when the address is not supported', async () => {
    const { variablesMeta } = await runServerless();
    expect(variablesMeta.get('custom\0unsupportedAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });

  it('should report with an error when the address it not a string', async () => {
    const { variablesMeta } = await runServerless();
    expect(variablesMeta.get('custom\0nonStringAddress').error.code).to.equal(
      'VARIABLE_RESOLUTION_ERROR'
    );
  });

  it('should still resolve variables when no Serverless instance is available', async () => {
    const { variablesMeta } = await runServerless({
      cliParameters: ['timeout=10'],
      resolveWithoutInstance: true,
    });
    expect(variablesMeta.get('provider\0timeout')).to.have.property('variables');
    expect(variablesMeta.get('provider\0timeout')).to.not.have.property('error');
  });
});
