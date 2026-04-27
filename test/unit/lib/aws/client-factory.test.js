'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const { expect } = chai;

describe('test/unit/lib/aws/client-factory.test.js', () => {
  let instances;
  let sendStub;
  let uploadDoneStub;
  let uploadOptions;
  let AWSClientFactory;

  beforeEach(() => {
    instances = [];
    sendStub = sinon.stub().resolves({ ok: true });
    uploadDoneStub = sinon.stub().resolves({ uploaded: true });
    uploadOptions = null;

    class FakeS3Client {
      constructor(config) {
        this.config = config;
        this.send = sendStub;
        instances.push(this);
      }
    }

    function FakeUpload(options) {
      uploadOptions = options;
      this.done = uploadDoneStub;
    }

    AWSClientFactory = proxyquire('../../../../lib/aws/client-factory', {
      '@aws-sdk/client-s3': { S3Client: FakeS3Client },
      '@aws-sdk/lib-storage': { Upload: FakeUpload },
    });
  });

  it('reuses clients for the same service and config', () => {
    const factory = new AWSClientFactory();

    const firstClient = factory.getClient('S3', { region: 'us-east-1' });
    const secondClient = factory.getClient('S3', { region: 'us-east-1' });

    expect(firstClient).to.equal(secondClient);
    expect(instances).to.have.length(1);
  });

  it('creates separate clients for different regions', () => {
    const factory = new AWSClientFactory();

    const firstClient = factory.getClient('S3', { region: 'us-east-1' });
    const secondClient = factory.getClient('S3', { region: 'eu-west-1' });

    expect(firstClient).to.not.equal(secondClient);
    expect(instances).to.have.length(2);
  });

  it('does not include credential secrets in cache keys', () => {
    const cacheKey = AWSClientFactory.createClientCacheKey('S3', {
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret-value',
        sessionToken: 'session-token',
      },
    });

    expect(cacheKey).to.include('AKIAEXAMPLE');
    expect(cacheKey).to.not.include('secret-value');
    expect(cacheKey).to.not.include('session-token');
  });

  it('sends normal commands with client.send', async () => {
    const factory = new AWSClientFactory();
    const command = { command: true };

    const result = await factory.send('S3', command, { region: 'us-east-1' });

    expect(result).to.deep.equal({ ok: true });
    expect(sendStub).to.have.been.calledOnceWithExactly(command);
  });

  it('sends S3 upload markers with lib-storage Upload', async () => {
    const factory = new AWSClientFactory();
    const command = { _isUploadRequest: true, params: { Bucket: 'bucket', Key: 'key' } };

    const result = await factory.send('S3', command, { region: 'us-east-1' });

    expect(result).to.deep.equal({ uploaded: true });
    expect(uploadOptions).to.deep.equal({ client: instances[0], params: command.params });
    expect(uploadDoneStub).to.have.been.calledOnce;
    expect(sendStub).to.not.have.been.called;
  });
});
