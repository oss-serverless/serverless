'use strict';

const sinon = require('sinon');
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

  it('executes expected operations during removal when repository does not exist', async () => {
    describeRepositoriesStub.throws({ providerError: { code: 'RepositoryNotFoundException' } });

    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });

    expect(deleteObjectsStub).to.be.calledWithExactly({
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

    expect(deleteObjectsStub).to.be.calledWithExactly({
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

    expect(deleteObjectsStub).to.be.calledWithExactly({
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

  it('removes ECR repository if it exists', async () => {
    describeRepositoriesStub.resolves();
    const { awsNaming } = await runServerless({
      fixture: 'function',
      command: 'remove',
      awsRequestStubMap,
    });

    expect(deleteRepositoryStub).to.be.calledWithExactly({
      repositoryName: awsNaming.getEcrRepositoryName(),
      registryId: '999999999999',
      force: true,
    });
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

    expect(listObjectVersionsStub).to.be.calledWithExactly({
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

    expect(listObjectVersionsStub).to.be.calledWithExactly({
      Bucket: 'bucket',
      Prefix: `serverless/${serverless.service.service}/dev/`,
    });

    expect(innerDeleteObjectsStub).to.be.calledWithExactly({
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
