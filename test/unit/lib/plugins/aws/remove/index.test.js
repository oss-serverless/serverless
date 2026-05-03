'use strict';

const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const emptyS3Bucket = require('../../../../../../lib/plugins/aws/remove/lib/bucket');
const runServerless = require('../../../../../utils/run-serverless');

const expect = require('chai').expect;

describe('test/unit/lib/plugins/aws/remove/index.test.js', () => {
  const deleteObjectsStub = sinon.stub().resolves();
  const deleteStackStub = sinon.stub().resolves();
  const describeStackEventsStub = sinon.stub().resolves({
    StackEvents: [
      {
        EventId: '1e2f3g4h',
        StackName: 'new-service-dev',
        LogicalResourceId: 'new-service-dev',
        ResourceType: 'AWS::CloudFormation::Stack',
        Timestamp: new Date(),
        ResourceStatus: 'DELETE_COMPLETE',
      },
    ],
  });
  const describeRepositoriesStub = sinon.stub();
  const deleteRepositoryStub = sinon.stub().resolves();
  const awsRequestStubMap = {
    ECR: {
      deleteRepository: deleteRepositoryStub,
      describeRepositories: describeRepositoriesStub,
    },
    S3: {
      deleteObjects: deleteObjectsStub,
      listObjectsV2: { Contents: [{ Key: 'first' }, { Key: 'second' }] },
      headBucket: {},
    },
    CloudFormation: {
      describeStackEvents: describeStackEventsStub,
      deleteStack: deleteStackStub,
      describeStackResource: { StackResourceDetail: { PhysicalResourceId: 'resource-id' } },
    },
    STS: {
      getCallerIdentity: {
        ResponseMetadata: { RequestId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
        UserId: 'XXXXXXXXXXXXXXXXXXXXX',
        Account: '999999999999',
        Arn: 'arn:aws:iam::999999999999:user/test',
      },
    },
  };

  const createSignatureMismatchListError = () => {
    const error = new Error('signature mismatch');
    error.providerError = {
      code: 'SignatureDoesNotMatch',
      statusCode: 403,
    };
    return error;
  };

  const createAccessDeniedListError = () => {
    const error = new Error('access denied');
    error.providerError = {
      code: 'AccessDenied',
      statusCode: 403,
    };
    return error;
  };

  const createStatusOnlyListError = () => {
    const error = new Error('forbidden');
    error.providerError = {
      statusCode: 403,
    };
    return error;
  };

  const createWrappedStatusOnlyListError = (code) => {
    const error = createStatusOnlyListError();
    error.code = code;
    return error;
  };

  beforeEach(() => {
    deleteObjectsStub.resetHistory();
    deleteStackStub.resetHistory();
    describeStackEventsStub.resetHistory();
    describeRepositoriesStub.reset();
    deleteRepositoryStub.resetHistory();
  });

  it('preserves deleteObjectBatches one-argument plugin method signature', async () => {
    const sendStub = sinon.stub(S3Client.prototype, 'send').resolves({});
    const provider = {
      getAwsSdkV3Config: sinon.stub().resolves({ region: 'us-east-1' }),
    };

    try {
      await emptyS3Bucket.deleteObjectBatches.call(
        {
          bucketName: 'bucket',
          provider,
        },
        [{ Key: 'first' }]
      );

      expect(provider.getAwsSdkV3Config).to.have.been.calledOnceWithExactly();
      expect(sendStub).to.have.been.calledOnce;
      expect(sendStub.firstCall.args[0]).to.be.instanceOf(DeleteObjectsCommand);
      expect(sendStub.firstCall.args[0].input).to.deep.equal({
        Bucket: 'bucket',
        Delete: { Objects: [{ Key: 'first' }] },
      });
    } finally {
      S3Client.prototype.send.restore();
    }
  });

  it('uses an existing S3 client promise when deleting object batches', async () => {
    const send = sinon.stub().resolves({});
    const provider = {
      getAwsSdkV3Config: sinon.stub().throws(new Error('Expected existing S3 client to be reused')),
    };
    const context = {
      bucketName: 'bucket',
      provider,
      s3ClientPromise: Promise.resolve({ send }),
    };

    await emptyS3Bucket.deleteObjectBatches.call(context, [{ Key: 'first' }]);

    expect(provider.getAwsSdkV3Config).to.not.have.been.called;
    expect(send).to.have.been.calledOnce;
    expect(send.firstCall.args[0]).to.be.instanceOf(DeleteObjectsCommand);
    expect(send.firstCall.args[0].input).to.deep.equal({
      Bucket: 'bucket',
      Delete: { Objects: [{ Key: 'first' }] },
    });
  });

  it('reuses one S3 client across listObjectsV2 and deleteObjectBatches', async () => {
    const s3Clients = [];
    const sends = [];
    class FakeCommand {
      constructor(input) {
        this.input = input;
      }
    }
    class FakeListObjectsV2Command extends FakeCommand {}
    class FakeListObjectVersionsCommand extends FakeCommand {}
    class FakeDeleteObjectsCommand extends FakeCommand {}
    class FakeS3Client {
      constructor(config) {
        this.config = config;
        s3Clients.push(this);
      }

      async send(command) {
        sends.push({ client: this, command });
        if (command instanceof FakeListObjectsV2Command) {
          return { Contents: [{ Key: 'serverless/service/dev/123/file.zip' }] };
        }
        if (command instanceof FakeDeleteObjectsCommand) return {};
        throw new Error(`Unexpected S3 command ${command.constructor.name}`);
      }
    }
    const bucket = proxyquire('../../../../../../lib/plugins/aws/remove/lib/bucket', {
      '@aws-sdk/client-s3': {
        S3Client: FakeS3Client,
        DeleteObjectsCommand: FakeDeleteObjectsCommand,
        ListObjectsV2Command: FakeListObjectsV2Command,
        ListObjectVersionsCommand: FakeListObjectVersionsCommand,
      },
    });
    const context = {
      bucketName: 'bucket',
      provider: {
        getAwsSdkV3Config: sinon.stub().resolves({ region: 'us-east-1' }),
        getDeploymentPrefix: sinon.stub().returns('serverless'),
        getStage: sinon.stub().returns('dev'),
      },
      serverless: {
        service: {
          service: 'service',
        },
      },
      ...bucket,
    };

    await context.listObjectsV2();

    expect(s3Clients).to.have.length(1);
    expect(sends).to.have.length(2);
    expect(sends[0].client).to.equal(s3Clients[0]);
    expect(sends[1].client).to.equal(s3Clients[0]);
    expect(sends[0].command).to.be.instanceOf(FakeListObjectsV2Command);
    expect(sends[0].command.input).to.deep.equal({
      Bucket: 'bucket',
      Prefix: 'serverless/service/dev/',
    });
    expect(sends[1].command).to.be.instanceOf(FakeDeleteObjectsCommand);
    expect(sends[1].command.input).to.deep.equal({
      Bucket: 'bucket',
      Delete: {
        Objects: [{ Key: 'serverless/service/dev/123/file.zip' }],
      },
    });
  });

  it('executes expected operations during removal when repository does not exist', async () => {
    describeRepositoriesStub.throws({ providerError: { code: 'RepositoryNotFoundException' } });

    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });

    expect(deleteObjectsStub).to.be.calledOnce;
    expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: [{ Key: 'first' }, { Key: 'second' }],
      },
    });
    expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
    expect(describeStackEventsStub).to.be.calledWithExactly({
      StackName: awsNaming.getStackName(),
    });
    expect(deleteStackStub.calledAfter(deleteObjectsStub)).to.be.true;
    expect(describeStackEventsStub.calledAfter(deleteStackStub)).to.be.true;
    expect(deleteRepositoryStub).not.to.be.called;
  });

  it('executes expected operations during removal when repository cannot be accessed due to denied access', async () => {
    describeRepositoriesStub.throws({ providerError: { code: 'AccessDeniedException' } });

    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });

    expect(deleteObjectsStub).to.be.calledOnce;
    expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: [{ Key: 'first' }, { Key: 'second' }],
      },
    });
    expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
    expect(describeStackEventsStub).to.be.calledWithExactly({
      StackName: awsNaming.getStackName(),
    });
    expect(deleteStackStub.calledAfter(deleteObjectsStub)).to.be.true;
    expect(describeStackEventsStub.calledAfter(deleteStackStub)).to.be.true;
    expect(deleteRepositoryStub).not.to.be.called;
  });

  for (const [description, error] of [
    [
      'repository does not exist with native SDK v3 error',
      Object.assign(new Error('Repository not found'), { name: 'RepositoryNotFoundException' }),
    ],
    [
      'repository cannot be accessed with native SDK v3 error',
      Object.assign(new Error('Access denied'), { name: 'AccessDeniedException' }),
    ],
  ]) {
    it(`executes expected operations during removal when ${description}`, async () => {
      describeRepositoriesStub.throws(error);

      const { awsNaming, awsSdkV3Stub, serverless } = await runServerless({
        fixture: 'function',
        command: 'remove',
        awsRequestStubMap,
      });

      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
      expect(describeStackEventsStub).to.be.calledWithExactly({
        StackName: awsNaming.getStackName(),
      });
      expect(deleteRepositoryStub).not.to.be.called;
      const ecrSends = awsSdkV3Stub.sends.filter(({ service }) => service === 'ECR');
      expect(ecrSends).to.have.length(1);
      expect(ecrSends[0]).to.include({ method: 'describeRepositories' });
      expect(ecrSends[0].input).to.deep.equal({
        repositoryNames: [awsNaming.getEcrRepositoryName()],
        registryId: '999999999999',
      });
      expect(ecrSends[0].clientConfig.region).to.equal('us-east-1');
      expect(ecrSends[0].clientConfig.credentials).to.equal(
        serverless.getProvider('aws').getAwsSdkV3CredentialsProvider()
      );
    });
  }

  it('executes expected operations related to files removal when S3 bucket has files', async () => {
    await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          headBucket: {},
        },
      },
    });

    expect(deleteObjectsStub).not.to.be.called;
  });

  it('executes expected operations related to files removal when S3 bucket is empty', async () => {
    await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });

    expect(deleteObjectsStub).to.be.calledOnce;
    expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: [{ Key: 'first' }, { Key: 'second' }],
      },
    });
  });

  it('deletes each page of S3 objects as it is listed', async () => {
    const listObjectsV2Stub = sinon
      .stub()
      .onFirstCall()
      .returns({
        Contents: [{ Key: 'first' }],
        NextContinuationToken: 'next-page',
      })
      .onSecondCall()
      .returns({ Contents: [{ Key: 'second' }] });
    const innerDeleteObjectsStub = sinon.stub().resolves();

    const { serverless } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          deleteObjects: innerDeleteObjectsStub,
          listObjectsV2: listObjectsV2Stub,
          headBucket: {},
        },
      },
    });

    expect(listObjectsV2Stub).to.have.been.calledTwice;
    expect(listObjectsV2Stub.firstCall.args[0]).to.include({
      Bucket: 'resource-id',
      Prefix: `serverless/${serverless.service.service}/dev/`,
    });
    expect(listObjectsV2Stub.secondCall.args[0]).to.include({
      Bucket: 'resource-id',
      Prefix: `serverless/${serverless.service.service}/dev/`,
      ContinuationToken: 'next-page',
    });
    expect(innerDeleteObjectsStub).to.have.been.calledTwice;
    expect(innerDeleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: [{ Key: 'first' }],
      },
    });
    expect(innerDeleteObjectsStub.secondCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: [{ Key: 'second' }],
      },
    });
    expect(innerDeleteObjectsStub.firstCall.calledAfter(listObjectsV2Stub.firstCall)).to.be.true;
    expect(listObjectsV2Stub.secondCall.calledAfter(innerDeleteObjectsStub.firstCall)).to.be.true;
    expect(innerDeleteObjectsStub.secondCall.calledAfter(listObjectsV2Stub.secondCall)).to.be.true;
  });

  it('deletes S3 bucket objects in batches of 1000', async () => {
    const objects = Array.from({ length: 1001 }, (ignored, index) => ({ Key: `object-${index}` }));
    const innerDeleteObjectsStub = sinon.stub().resolves();

    await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          deleteObjects: innerDeleteObjectsStub,
          listObjectsV2: { Contents: objects },
          headBucket: {},
        },
      },
    });

    expect(innerDeleteObjectsStub).to.have.been.calledTwice;
    expect(innerDeleteObjectsStub.firstCall.args[0].Delete.Objects).to.have.lengthOf(1000);
    expect(innerDeleteObjectsStub.secondCall.args[0]).to.deep.equal({
      Bucket: 'resource-id',
      Delete: {
        Objects: objects.slice(1000),
      },
    });
  });

  it('skips attempts to remove S3 objects if S3 bucket not found', async () => {
    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [{ Key: 'first' }, { Key: 'second' }] },
          headBucket: () => {
            const err = new Error('err');
            err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
            throw err;
          },
        },
      },
    });

    expect(deleteObjectsStub).not.to.be.called;
    expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
    expect(describeStackEventsStub).to.be.calledWithExactly({
      StackName: awsNaming.getStackName(),
    });
    expect(describeStackEventsStub.calledAfter(deleteStackStub)).to.be.true;
  });

  it('skips attempts to remove S3 objects if S3 bucket resource missing from CloudFormation template', async () => {
    const headBucketStub = sinon.stub();
    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          ...awsRequestStubMap.S3,
          headBucket: headBucketStub,
        },
        CloudFormation: {
          ...awsRequestStubMap.CloudFormation,
          describeStackResource: () => {
            const err = new Error('does not exist for stack');
            err.providerError = {
              code: 'ValidationError',
            };
            throw err;
          },
        },
      },
    });

    expect(headBucketStub).not.to.be.called;
    expect(deleteObjectsStub).not.to.be.called;
    expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
    expect(describeStackEventsStub).to.be.calledWithExactly({
      StackName: awsNaming.getStackName(),
    });
    expect(describeStackEventsStub.calledAfter(deleteStackStub)).to.be.true;
  });

  it('skips S3 object removal if SDK v3 reports deployment bucket resource missing', async () => {
    const headBucketStub = sinon.stub();
    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          ...awsRequestStubMap.S3,
          headBucket: headBucketStub,
        },
        CloudFormation: {
          ...awsRequestStubMap.CloudFormation,
          describeStackResource: () => {
            const err = new Error('Resource does not exist for stack new-service-dev');
            err.name = 'ValidationError';
            throw err;
          },
        },
      },
    });

    expect(headBucketStub).not.to.be.called;
    expect(deleteObjectsStub).not.to.be.called;
    expect(deleteStackStub).to.be.calledWithExactly({ StackName: awsNaming.getStackName() });
    expect(describeStackEventsStub).to.be.calledWithExactly({
      StackName: awsNaming.getStackName(),
    });
    expect(describeStackEventsStub.calledAfter(deleteStackStub)).to.be.true;
  });

  it('rethrows unexpected SDK v3 deployment bucket lookup validation errors', async () => {
    await expect(
      runServerless({
        fixture: 'function',
        command: 'remove',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          CloudFormation: {
            ...awsRequestStubMap.CloudFormation,
            describeStackResource: () => {
              const err = new Error('Some other validation failure');
              err.name = 'ValidationError';
              throw err;
            },
          },
        },
      })
    ).to.be.eventually.rejectedWith('Some other validation failure');
  });

  it('rethrows inherited SDK v3 deployment bucket lookup missing-resource messages', async () => {
    await expect(
      runServerless({
        fixture: 'function',
        command: 'remove',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          CloudFormation: {
            ...awsRequestStubMap.CloudFormation,
            describeStackResource: () => {
              const err = Object.assign(Object.create({ message: 'does not exist for stack' }), {
                name: 'ValidationError',
              });
              throw err;
            },
          },
        },
      })
    ).to.be.eventually.rejectedWith('does not exist for stack');
  });

  it('removes ECR repository if it exists', async () => {
    describeRepositoriesStub.resolves();
    const { awsNaming, awsSdkV3Stub, serverless } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });
    const ecrSends = awsSdkV3Stub.sends.filter(({ service }) => service === 'ECR');

    expect(ecrSends.map(({ method }) => method)).to.deep.equal([
      'describeRepositories',
      'deleteRepository',
    ]);
    expect(ecrSends[0].input).to.deep.equal({
      repositoryNames: [awsNaming.getEcrRepositoryName()],
      registryId: '999999999999',
    });
    expect(ecrSends[1].input).to.deep.equal({
      repositoryName: awsNaming.getEcrRepositoryName(),
      registryId: '999999999999',
      force: true,
    });
    const expectedCredentials = serverless.getProvider('aws').getAwsSdkV3CredentialsProvider();
    expect(
      ecrSends.every(
        ({ clientConfig }) =>
          clientConfig.region === 'us-east-1' && clientConfig.credentials === expectedCredentials
      )
    ).to.equal(true);
    expect(deleteRepositoryStub).to.be.calledWithExactly({
      repositoryName: awsNaming.getEcrRepositoryName(),
      registryId: '999999999999',
      force: true,
    });
    expect(
      awsSdkV3Stub.sends.some(
        ({ service, method, input }) =>
          service === 'ECR' &&
          method === 'deleteRepository' &&
          input.repositoryName === awsNaming.getEcrRepositoryName() &&
          input.registryId === '999999999999' &&
          input.force === true
      )
    ).to.equal(true);
  });

  it('should execute expected operations with versioning enabled if no object versions are present', async () => {
    const listObjectVersionsStub = sinon.stub().resolves();

    const { serverless } = await runServerless({
      command: 'remove',
      fixture: 'function',
      configExt: {
        provider: {
          deploymentPrefix: 'serverless',
          deploymentBucket: {
            name: 'bucket',
            versioning: true,
          },
        },
      },
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          listObjectVersions: listObjectVersionsStub,
          headBucket: {},
        },
      },
    });

    expect(listObjectVersionsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Prefix: `serverless/${serverless.service.service}/dev/`,
    });
  });

  it('should execute expected operations with versioning enabled if object versions are present', async () => {
    const listObjectVersionsStub = sinon.stub().resolves({
      Versions: [
        { Key: 'object1', VersionId: null },
        { Key: 'object2', VersionId: 'v1' },
      ],
      DeleteMarkers: [{ Key: 'object3', VersionId: 'v2' }],
    });

    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [
        { Key: 'object1', VersionId: null },
        { Key: 'object2', VersionId: 'v1' },
        { Key: 'object3', VersionId: 'v2' },
      ],
    });

    const { serverless } = await runServerless({
      command: 'remove',
      fixture: 'function',
      configExt: {
        provider: {
          deploymentPrefix: 'serverless',
          deploymentBucket: {
            name: 'bucket',
            versioning: true,
          },
        },
      },
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          listObjectVersions: listObjectVersionsStub,
          deleteObjects: innerDeleteObjectsStub,
          headBucket: {},
        },
      },
    });

    expect(listObjectVersionsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Prefix: `serverless/${serverless.service.service}/dev/`,
    });

    expect(innerDeleteObjectsStub).to.be.calledOnce;
    expect(innerDeleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Delete: {
        Objects: [
          { Key: 'object1', VersionId: null },
          { Key: 'object2', VersionId: 'v1' },
          { Key: 'object3', VersionId: 'v2' },
        ],
      },
    });
  });

  it('deletes each page of object versions as it is listed', async () => {
    const listObjectVersionsStub = sinon
      .stub()
      .onFirstCall()
      .returns({
        Versions: [{ Key: 'object1', VersionId: 'v1' }],
        NextKeyMarker: 'next-key',
        NextVersionIdMarker: 'next-version',
      })
      .onSecondCall()
      .returns({
        DeleteMarkers: [{ Key: 'object2', VersionId: 'v2' }],
      });
    const innerDeleteObjectsStub = sinon.stub().resolves();

    const { serverless } = await runServerless({
      command: 'remove',
      fixture: 'function',
      configExt: {
        provider: {
          deploymentPrefix: 'serverless',
          deploymentBucket: {
            name: 'bucket',
            versioning: true,
          },
        },
      },
      awsRequestStubMap: {
        ...awsRequestStubMap,
        S3: {
          listObjectVersions: listObjectVersionsStub,
          deleteObjects: innerDeleteObjectsStub,
          headBucket: {},
        },
      },
    });

    expect(listObjectVersionsStub).to.have.been.calledTwice;
    expect(listObjectVersionsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Prefix: `serverless/${serverless.service.service}/dev/`,
    });
    expect(listObjectVersionsStub.secondCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Prefix: `serverless/${serverless.service.service}/dev/`,
      KeyMarker: 'next-key',
      VersionIdMarker: 'next-version',
    });
    expect(innerDeleteObjectsStub).to.have.been.calledTwice;
    expect(innerDeleteObjectsStub.firstCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Delete: {
        Objects: [{ Key: 'object1', VersionId: 'v1' }],
      },
    });
    expect(innerDeleteObjectsStub.secondCall.args[0]).to.deep.equal({
      Bucket: 'bucket',
      Delete: {
        Objects: [{ Key: 'object2', VersionId: 'v2' }],
      },
    });
    expect(innerDeleteObjectsStub.firstCall.calledAfter(listObjectVersionsStub.firstCall)).to.be
      .true;
    expect(listObjectVersionsStub.secondCall.calledAfter(innerDeleteObjectsStub.firstCall)).to.be
      .true;
    expect(innerDeleteObjectsStub.secondCall.calledAfter(listObjectVersionsStub.secondCall)).to.be
      .true;
  });

  it('preserves specific S3 object-version list authentication failures during remove', async () => {
    const listError = createSignatureMismatchListError();

    try {
      await runServerless({
        command: 'remove',
        fixture: 'function',
        configExt: {
          provider: {
            deploymentBucket: {
              name: 'bucket',
              versioning: true,
            },
          },
        },
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectVersions: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      });
      throw new Error('Expected remove to reject');
    } catch (error) {
      expect(error).to.equal(listError);
    }
  });

  it('rewrites wrapped status-only S3 object-version list access denied failures during remove', async () => {
    const listError = createWrappedStatusOnlyListError('AWS_S3_LIST_OBJECT_VERSIONS_ERROR');

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        configExt: {
          provider: {
            deploymentBucket: {
              name: 'bucket',
              versioning: true,
            },
          },
        },
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectVersions: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });

  it('should throw an error when cannot list object versions from the bucket', async () => {
    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        configExt: {
          provider: {
            deploymentBucket: {
              name: 'bucket',
              versioning: true,
            },
          },
        },
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            listObjectVersions: () => {
              const err = new Error('ff');
              err.providerError = { statusCode: 403 };
              throw err;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });

  it('should throw an error when deleteObjects operation was not successful', async () => {
    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [],
      Errors: [
        {
          Code: 'InternalError',
        },
      ],
    });

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            deleteObjects: innerDeleteObjectsStub,
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_GENERIC');
  });

  it('does not rewrite deleteObjects access denied failures as list failures', async () => {
    const deleteError = new Error('delete denied');
    deleteError.code = 'AccessDenied';

    try {
      await runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: { Contents: [{ Key: 'first' }] },
            deleteObjects: sinon.stub().rejects(deleteError),
            headBucket: {},
          },
        },
      });
      throw new Error('Expected remove to reject');
    } catch (error) {
      expect(error).to.equal(deleteError);
    }
  });

  it('should throw an error when deleteObjects operation was not successful due to "AccessDenied"', async () => {
    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [],
      Errors: [
        {
          Code: 'AccessDenied',
        },
      ],
    });

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            deleteObjects: innerDeleteObjectsStub,
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED');
  });

  it('treats deleteObjects errors with lowercase code property as access denied failures', async () => {
    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [],
      Errors: [{ code: 'AccessDenied' }],
    });

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            deleteObjects: innerDeleteObjectsStub,
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED');
  });

  it('treats SDK v3 deleteObjects access denied names as access denied failures', async () => {
    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [],
      Errors: [{ name: 'AccessDenied' }],
    });

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            deleteObjects: innerDeleteObjectsStub,
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED');
  });

  it('does not treat inherited deleteObjects error codes as access denied failures', async () => {
    const innerDeleteObjectsStub = sinon.stub().resolves({
      Deleted: [],
      Errors: [Object.create({ Code: 'AccessDenied' })],
    });

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            deleteObjects: innerDeleteObjectsStub,
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_GENERIC');
  });

  it('preserves specific S3 list authentication failures during remove', async () => {
    const listError = createSignatureMismatchListError();

    try {
      await runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      });
      throw new Error('Expected remove to reject');
    } catch (error) {
      expect(error).to.equal(listError);
    }
  });

  it('rewrites explicit S3 list access denied failures during remove', async () => {
    const listError = createAccessDeniedListError();

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });

  it('rewrites status-only S3 object-list access denied failures during remove', async () => {
    const listError = createStatusOnlyListError();

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });

  it('rewrites wrapped status-only S3 object-list access denied failures during remove', async () => {
    const listError = createWrappedStatusOnlyListError('AWS_S3_LIST_OBJECTS_V2_ERROR');

    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: () => {
              throw listError;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });

  it('should throw an error when cannot list objects from the bucket', async () => {
    await expect(
      runServerless({
        command: 'remove',
        fixture: 'function',
        awsRequestStubMap: {
          ...awsRequestStubMap,
          S3: {
            ...awsRequestStubMap.S3,
            listObjectsV2: () => {
              const err = new Error('ff');
              err.code = 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED';
              throw err;
            },
            headBucket: {},
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });
});
