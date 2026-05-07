'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');

const { expect } = chai;

describe('test/unit/src/utils/aws/config.test.js', () => {
  const envKeys = [
    'AWS_REGION',
    'AWS_DEFAULT_REGION',
    'SLS_AWS_REQUEST_MAX_RETRIES',
    'AWS_CLIENT_TIMEOUT',
    'aws_client_timeout',
    'proxy',
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'ca',
    'HTTPS_CA',
    'https_ca',
    'cafile',
    'HTTPS_CAFILE',
    'https_cafile',
  ];

  async function withEnv(callback) {
    const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

    for (const key of envKeys) delete process.env[key];

    try {
      return await callback();
    } finally {
      for (const key of envKeys) {
        const value = originalEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  function loadConfig() {
    function FakeNodeHttpHandler(options) {
      this.options = options;
    }

    function FakeHttpsProxyAgent(proxy, options) {
      this.proxy = proxy;
      this.options = options;
    }

    class FakeHttpsAgent {
      constructor(options) {
        this.options = options;
      }
    }

    return proxyquire('../../../../../../lib/compose/utils/aws/config', {
      '@smithy/node-http-handler': { NodeHttpHandler: FakeNodeHttpHandler },
      'https-proxy-agent': { HttpsProxyAgent: FakeHttpsProxyAgent },
      'https': { Agent: FakeHttpsAgent },
    });
  }

  it('preserves explicit maxAttempts values including zero', async () => {
    await withEnv(async () => {
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig({ maxAttempts: 0 }).maxAttempts).to.equal(0);
      expect(buildClientConfig({ maxAttempts: 1 }).maxAttempts).to.equal(1);
    });
  });

  it('maps Serverless retry count to SDK v3 maxAttempts', async () => {
    await withEnv(async () => {
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig().maxAttempts).to.equal(5);

      process.env.SLS_AWS_REQUEST_MAX_RETRIES = '0';
      expect(buildClientConfig().maxAttempts).to.equal(1);

      process.env.SLS_AWS_REQUEST_MAX_RETRIES = '2';
      expect(buildClientConfig().maxAttempts).to.equal(3);
    });
  });

  it('falls back to environment region only when region is undefined', async () => {
    await withEnv(async () => {
      process.env.AWS_REGION = 'eu-west-1';
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig().region).to.equal('eu-west-1');
      expect(buildClientConfig({ region: undefined }).region).to.equal('eu-west-1');
      expect(buildClientConfig({ region: '' }).region).to.equal('');
      expect(buildClientConfig({ region: null }).region).to.equal(null);
    });
  });

  it('uses AWS_DEFAULT_REGION before hardcoded us-east-1 fallback', async () => {
    await withEnv(async () => {
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig().region).to.equal('us-east-1');

      process.env.AWS_DEFAULT_REGION = 'ap-south-1';
      expect(buildClientConfig().region).to.equal('ap-south-1');

      process.env.AWS_REGION = 'eu-west-1';
      expect(buildClientConfig().region).to.equal('eu-west-1');
    });
  });

  it('uses NodeHttpHandler for timeout config', async () => {
    await withEnv(async () => {
      process.env.AWS_CLIENT_TIMEOUT = '1234';
      const { buildClientConfig } = loadConfig();

      const config = buildClientConfig();

      expect(config.requestHandler.options).to.deep.equal({ requestTimeout: 1234 });
    });
  });

  it('preserves explicit zero timeout config', async () => {
    await withEnv(async () => {
      process.env.AWS_CLIENT_TIMEOUT = '0';
      const { buildClientConfig } = loadConfig();

      const config = buildClientConfig();

      expect(config.requestHandler.options).to.deep.equal({ requestTimeout: 0 });
    });
  });

  it('passes proxy and CA options when constructing the proxy agent', async () => {
    await withEnv(async () => {
      process.env.HTTPS_PROXY = 'https://proxy.example.com:1234';
      process.env.HTTPS_CA = 'certificate';
      const { buildClientConfig } = loadConfig();

      const config = buildClientConfig();

      expect(config.requestHandler.options.httpsAgent.proxy).to.equal(
        'https://proxy.example.com:1234'
      );
      expect(config.requestHandler.options.httpsAgent.options).to.include({
        rejectUnauthorized: true,
      });
      expect(config.requestHandler.options.httpsAgent.options.ca).to.deep.equal(['certificate']);
    });
  });

  it('passes custom user agent config through', async () => {
    await withEnv(async () => {
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig({ customUserAgent: 'custom-agent' }).customUserAgent).to.equal(
        'custom-agent'
      );
    });
  });

  it('passes SDK v3 client options through', async () => {
    await withEnv(async () => {
      const { buildClientConfig } = loadConfig();
      const requestHandler = {};

      expect(
        buildClientConfig({
          endpoint: 'http://localhost:4566',
          forcePathStyle: true,
          requestHandler,
        })
      ).to.include({
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
        requestHandler,
      });
    });
  });
});
