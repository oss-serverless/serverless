'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const stream = require('stream');

const S3StateStorage = require('../../../../../lib/compose/state/S3StateStorage');

const expect = chai.expect;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('test/unit/src/state/S3StateStorage.test.js', () => {
  const bucketName = 'dummy-bucket';
  const stateKey = 'dummy-key';

  it('properly reads state from S3 bucket', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      getObject: sinon.stub().resolves({
        Body: stream.Readable.from([
          Buffer.from(JSON.stringify({ components: { resources: { state: {} } } })),
        ]),
      }),
    };
    s3StateStorage.s3Client = mockedS3Client;
    const result = await s3StateStorage.readState();
    expect(result).to.deep.equal({ components: { resources: { state: {} } } });
    expect(Object.getPrototypeOf(result.components)).to.equal(null);
    expect(mockedS3Client.getObject).to.have.been.calledOnceWithExactly({
      Bucket: bucketName,
      Key: stateKey,
    });
  });

  it('normalizes reserved component ids from remote state while preserving nested payload data', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      getObject: sinon.stub().resolves({
        Body: stream.Readable.from([
          Buffer.from(
            JSON.stringify({
              components: {
                __proto__: {
                  outputs: { hidden: true },
                },
                constructor: {
                  outputs: { hidden: true },
                },
                prototype: {
                  outputs: { hidden: true },
                },
                resources: {
                  outputs: JSON.parse('{"__proto__":{"value":"ok"}}'),
                },
              },
            })
          ),
        ]),
      }),
    };
    s3StateStorage.s3Client = mockedS3Client;

    const result = await s3StateStorage.readState();

    expect(Object.keys(result.components)).to.deep.equal(['resources']);
    expect(
      Object.getOwnPropertyDescriptor(result.components.resources.outputs, '__proto__').value
    ).to.deep.equal({ value: 'ok' });
  });

  it('gracefully handles situation where state file in S3 is not present', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const getError = new Error();
    getError.Code = 'NoSuchKey';
    const mockedS3Client = {
      getObject: sinon.stub().rejects(getError),
    };
    s3StateStorage.s3Client = mockedS3Client;
    const result = await s3StateStorage.readState();
    expect(result).to.deep.equal({});
    expect(mockedS3Client.getObject).to.have.been.calledOnceWithExactly({
      Bucket: bucketName,
      Key: stateKey,
    });
  });

  it('gracefully handles SDK v3 NoSuchKey errors when state file in S3 is not present', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const getError = new Error();
    getError.name = 'NoSuchKey';
    const mockedS3Client = {
      getObject: sinon.stub().rejects(getError),
    };
    s3StateStorage.s3Client = mockedS3Client;
    const result = await s3StateStorage.readState();
    expect(result).to.deep.equal({});
  });

  it('rejects if error other than NoSuchKey has been reported when reading state from S3', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      getObject: sinon.stub().rejects(new Error()),
    };
    s3StateStorage.s3Client = mockedS3Client;
    await expect(s3StateStorage.readState()).to.have.been.eventually.rejected.and.have.property(
      'code',
      'CANNOT_READ_S3_REMOTE_STATE'
    );
  });

  it('properly updates state in S3 bucket', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      putObject: sinon.stub().resolves(),
    };
    s3StateStorage.s3Client = mockedS3Client;
    s3StateStorage.state = { dummy: true };
    await s3StateStorage.writeState();
    expect(mockedS3Client.putObject).to.have.been.calledOnceWithExactly({
      Bucket: bucketName,
      Key: stateKey,
      Body: JSON.stringify({ dummy: true }),
    });
  });

  it('properly removes state from S3 bucket', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      deleteObject: sinon.stub().resolves(),
    };
    s3StateStorage.s3Client = mockedS3Client;
    await s3StateStorage.removeState();
    expect(mockedS3Client.deleteObject).to.have.been.calledOnceWithExactly({
      Bucket: bucketName,
      Key: stateKey,
    });
  });

  it('passes full client config into the S3 client constructor', () => {
    const S3 = sinon.stub().returns({});
    const S3StateStorageWithStubbedClient = proxyquire
      .noCallThru()
      .load('../../../../../lib/compose/state/S3StateStorage', {
        '@aws-sdk/client-s3': { S3 },
      });

    const stateStorage = new S3StateStorageWithStubbedClient({
      bucketName,
      stateKey,
      region: 'eu-central-1',
      clientConfig: {
        region: 'eu-central-1',
        credentials: 'creds',
        retryMode: 'standard',
      },
    });

    expect(stateStorage).to.be.instanceOf(S3StateStorageWithStubbedClient);
    expect(S3).to.have.been.calledOnceWithExactly({
      region: 'eu-central-1',
      credentials: 'creds',
      retryMode: 'standard',
    });
  });

  it('serializes concurrent state writes', async () => {
    const firstWrite = createDeferred();
    const secondWrite = createDeferred();
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      putObject: sinon.stub().callsFake(() => {
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        const currentWrite = mockedS3Client.putObject.callCount === 1 ? firstWrite : secondWrite;
        return currentWrite.promise.finally(() => {
          activeWrites -= 1;
        });
      }),
    };

    s3StateStorage.s3Client = mockedS3Client;
    s3StateStorage.state = { first: true };

    const firstPromise = s3StateStorage.writeState();
    s3StateStorage.state = { second: true };
    const secondPromise = s3StateStorage.writeState();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedS3Client.putObject.calledOnce).to.equal(true);

    firstWrite.resolve();
    await firstPromise;
    await Promise.resolve();

    expect(mockedS3Client.putObject.calledTwice).to.equal(true);

    secondWrite.resolve();
    await Promise.all([firstPromise, secondPromise]);

    expect(maxActiveWrites).to.equal(1);
  });

  it('continues queued state writes after a failed write', async () => {
    const s3StateStorage = new S3StateStorage({ bucketName, stateKey });
    const mockedS3Client = {
      putObject: sinon.stub(),
    };

    mockedS3Client.putObject.onFirstCall().callsFake(() => {
      throw new Error('boom');
    });
    mockedS3Client.putObject.onSecondCall().resolves();

    s3StateStorage.s3Client = mockedS3Client;
    s3StateStorage.state = { first: true };

    const firstPromise = s3StateStorage.writeState();
    const firstErrorPromise = firstPromise.then(
      () => null,
      (error) => error
    );
    s3StateStorage.state = { second: true };
    const secondPromise = s3StateStorage.writeState();

    const firstError = await firstErrorPromise;
    expect(firstError).to.have.property('code', 'CANNOT_UPDATE_S3_REMOTE_STATE');

    await Promise.resolve();
    await Promise.resolve();

    expect(mockedS3Client.putObject.calledTwice).to.equal(true);

    await secondPromise;
    expect(mockedS3Client.putObject.secondCall).to.have.been.calledWithExactly({
      Bucket: bucketName,
      Key: stateKey,
      Body: JSON.stringify({ second: true }),
    });
  });
});
