'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const overrideEnv = require('process-utils/override-env');

const { expect } = chai;

describe('test/unit/lib/aws/config.test.js', () => {
  function loadConfig() {
    function FakeNodeHttpHandler(options) {
      this.options = options;
    }

    function FakeHttpsProxyAgent(options) {
      this.options = options;
    }

    class FakeHttpsAgent {
      constructor(options) {
        this.options = options;
      }
    }

    return proxyquire('../../../../lib/aws/config', {
      '@smithy/node-http-handler': { NodeHttpHandler: FakeNodeHttpHandler },
      'https-proxy-agent': FakeHttpsProxyAgent,
      'https': { Agent: FakeHttpsAgent },
    });
  }

  it('preserves explicit maxAttempts values including zero', async () => {
    await overrideEnv(async () => {
      const { buildClientConfig } = loadConfig();

      expect(buildClientConfig({ maxAttempts: 0 }).maxAttempts).to.equal(0);
      expect(buildClientConfig({ maxAttempts: 1 }).maxAttempts).to.equal(1);
    });
  });

  it('uses NodeHttpHandler for timeout config', async () => {
    await overrideEnv(async () => {
      process.env.AWS_CLIENT_TIMEOUT = '1234';
      const { buildClientConfig } = loadConfig();

      const config = buildClientConfig();

      expect(config.requestHandler.options).to.deep.equal({ requestTimeout: 1234 });
    });
  });

  it('passes proxy and CA options when constructing the proxy agent', async () => {
    await overrideEnv(async () => {
      process.env.HTTPS_PROXY = 'https://proxy.example.com:1234';
      process.env.HTTPS_CA = 'certificate';
      const { buildClientConfig } = loadConfig();

      const config = buildClientConfig();

      expect(config.requestHandler.options.httpsAgent.options).to.include({
        protocol: 'https:',
        host: 'proxy.example.com:1234',
        rejectUnauthorized: true,
      });
      expect(config.requestHandler.options.httpsAgent.options.ca).to.deep.equal(['certificate']);
    });
  });

  it('detects S3 acceleration only for compatible methods', () => {
    const { shouldUseS3Acceleration } = loadConfig();

    expect(shouldUseS3Acceleration('upload', { isS3TransferAccelerationEnabled: true })).to.equal(
      true
    );
    expect(
      shouldUseS3Acceleration('putObject', { isS3TransferAccelerationEnabled: true })
    ).to.equal(true);
    expect(
      shouldUseS3Acceleration('getObject', { isS3TransferAccelerationEnabled: true })
    ).to.equal(false);
  });
});
