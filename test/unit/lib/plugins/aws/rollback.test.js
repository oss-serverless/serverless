'use strict';

const runServerless = require('../../../../utils/run-serverless');
const AwsProvider = require('../../../../../lib/plugins/aws/provider');
const AwsRollback = require('../../../../../lib/plugins/aws/rollback');
const Serverless = require('../../../../../lib/serverless');
const chai = require('chai');
const assert = require('chai').assert;
const sinon = require('sinon');

const expect = chai.expect;

describe('AwsRollback', () => {
  let awsRollback;
  let s3Key;
  let spawnStub;
  let serverless;
  let provider;
  const selectedDeploymentKey =
    'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json';

  const createInstance = (options) => {
    serverless = new Serverless({ commands: [], options: {} });
    provider = new AwsProvider(serverless, options);
    serverless.setProvider('aws', provider);
    serverless.service.service = 'rollback';

    spawnStub = sinon.stub(serverless.pluginManager, 'spawn');

    awsRollback = new AwsRollback(serverless, options);
    awsRollback.serverless.cli = new serverless.classes.CLI();
    const prefix = provider.getDeploymentPrefix();
    s3Key = `${prefix}/${serverless.service.service}/${provider.getStage()}`;
  };

  beforeEach(() =>
    createInstance({
      stage: 'dev',
      region: 'us-east-1',
      timestamp: 1476779096930,
    })
  );

  afterEach(() => {
    if (provider.request.restore) provider.request.restore();
    serverless.pluginManager.spawn.restore();
  });

  function stubSelectedDeploymentList(requestStub) {
    requestStub.withArgs('S3', 'listObjectsV2').resolves({
      Contents: [{ Key: selectedDeploymentKey }],
    });
  }

  function expectGetStateFileCall(requestStub) {
    expect(requestStub).to.have.been.calledWithExactly('S3', 'getObject', {
      Bucket: awsRollback.bucketName,
      Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/serverless-state.json',
    });
  }

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

  const createWrappedStatusOnlyListError = () => {
    const error = new Error('forbidden');
    error.code = 'AWS_S3_LIST_OBJECTS_V2_ERROR';
    error.providerError = {
      statusCode: 403,
    };
    return error;
  };

  describe('#constructor()', () => {
    it('should have hooks', () => expect(awsRollback.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(awsRollback.provider).to.be.instanceof(AwsProvider));
  });

  describe('hooks', () => {
    it('should run "before:rollback:initialize" hook promise chain in order', async () => {
      const validateStub = sinon.stub(awsRollback, 'validate').resolves();

      return awsRollback.hooks['before:rollback:initialize']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
      });
    });

    it('should run "rollback:rollback" promise chain in order', async () => {
      const setBucketNameStub = sinon.stub(awsRollback, 'setBucketName').resolves();
      const setStackToUpdateStub = sinon.stub(awsRollback, 'setStackToUpdate').resolves();
      const updateStackStub = sinon.stub(awsRollback, 'updateStack').resolves();

      return awsRollback.hooks['rollback:rollback']().then(() => {
        expect(setBucketNameStub.calledOnce).to.be.equal(true);
        expect(setStackToUpdateStub.calledAfter(setBucketNameStub)).to.be.equal(true);
        expect(updateStackStub.calledAfter(setStackToUpdateStub)).to.be.equal(true);
      });
    });

    it('should run "deploy:list" if timestamp is not specified', async () => {
      const spawnDeployListStub = spawnStub.withArgs('deploy:list').resolves();
      awsRollback.options.timestamp = undefined;

      return awsRollback.hooks['rollback:rollback']().then(() => {
        expect(spawnDeployListStub.calledOnce).to.be.equal(true);
      });
    });
  });

  describe('#setStackToUpdate()', () => {
    it('should resolve when the timestamp argument is passed as a string', async () => {
      createInstance({
        stage: 'dev',
        region: 'us-east-1',
        timestamp: '1476779096930',
      });

      const s3Objects = [
        {
          Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
        },
        {
          Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/test.zip',
        },
      ];
      const s3Response = {
        Contents: s3Objects,
      };

      const requestStub = sinon.stub(awsRollback.provider, 'request');
      requestStub.withArgs('S3', 'listObjectsV2').resolves(s3Response);
      requestStub.withArgs('S3', 'getObject').resolves({ Body: '{}' });

      return awsRollback.setStackToUpdate().then(() => {
        expect(awsRollback.serverless.service.package.artifactDirectoryName).to.be.equal(
          'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z'
        );

        awsRollback.provider.request.restore();
      });
    });

    it('should reject in case no deployments are available', async () => {
      const s3Response = {
        Contents: [],
      };
      const listObjectsStub = sinon.stub(awsRollback.provider, 'request');
      listObjectsStub.withArgs('S3', 'listObjectsV2').resolves(s3Response);
      listObjectsStub.withArgs('S3', 'getObject').resolves({ Body: '{}' });

      return awsRollback
        .setStackToUpdate()
        .then(() => {
          assert.isNotOk(true, 'setStackToUpdate should not resolve');
        })
        .catch((error) => {
          expect(error.code).to.equal('ROLLBACK_DEPLOYMENTS_NOT_FOUND');
          expect(listObjectsStub.calledOnce).to.be.equal(true);
          expect(
            listObjectsStub.calledWithExactly('S3', 'listObjectsV2', {
              Bucket: awsRollback.bucketName,
              Prefix: `${s3Key}/`,
            })
          ).to.be.equal(true);
          awsRollback.provider.request.restore();
        });
    });

    it('should reject in case this specific deployments is not available', async () => {
      const s3Objects = [
        {
          Key: 'serverless/rollback/dev/2000000000000-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
        },
        {
          Key: 'serverless/rollback/dev/2000000000000-2016-10-18T08:24:56.930Z/test.zip',
        },
      ];
      const s3Response = {
        Contents: s3Objects,
      };

      const listObjectsStub = sinon.stub(awsRollback.provider, 'request');
      listObjectsStub.withArgs('S3', 'listObjectsV2').resolves(s3Response);
      listObjectsStub.withArgs('S3', 'getObject').resolves({ Body: '{}' });

      return awsRollback
        .setStackToUpdate()
        .then(() => {
          assert.isNotOk(true, 'setStackToUpdate should not resolve');
        })
        .catch((error) => {
          expect(error.code).to.equal('ROLLBACK_DEPLOYMENT_NOT_FOUND');
          expect(listObjectsStub.calledOnce).to.be.equal(true);
          expect(
            listObjectsStub.calledWithExactly('S3', 'listObjectsV2', {
              Bucket: awsRollback.bucketName,
              Prefix: `${s3Key}/`,
            })
          ).to.be.equal(true);
          awsRollback.provider.request.restore();
        });
    });

    it('should resolve set the artifactDirectoryName and resolve', async () => {
      const s3Objects = [
        {
          Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
        },
        {
          Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/test.zip',
        },
      ];
      const s3Response = {
        Contents: s3Objects,
      };

      const listObjectsStub = sinon.stub(awsRollback.provider, 'request');
      listObjectsStub.withArgs('S3', 'listObjectsV2').resolves(s3Response);
      listObjectsStub.withArgs('S3', 'getObject').resolves({ Body: '{}' });

      return awsRollback.setStackToUpdate().then(() => {
        expect(awsRollback.serverless.service.package.artifactDirectoryName).to.be.equal(
          'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z'
        );
        expect(
          listObjectsStub.calledWithExactly('S3', 'listObjectsV2', {
            Bucket: awsRollback.bucketName,
            Prefix: `${s3Key}/`,
          })
        ).to.be.equal(true);
        awsRollback.provider.request.restore();
      });
    });

    it('should resolve when the target deployment is found on a later S3 page', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      requestStub
        .withArgs('S3', 'listObjectsV2')
        .onFirstCall()
        .resolves({
          Contents: [],
          NextContinuationToken: 'next-page',
        })
        .onSecondCall()
        .resolves({
          Contents: [
            {
              Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
            },
          ],
        });
      requestStub.withArgs('S3', 'getObject').resolves({ Body: '{}' });

      await awsRollback.setStackToUpdate();

      expect(awsRollback.serverless.service.package.artifactDirectoryName).to.equal(
        'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z'
      );
      expect(requestStub.secondCall.args).to.deep.equal([
        'S3',
        'listObjectsV2',
        {
          Bucket: awsRollback.bucketName,
          Prefix: `${s3Key}/`,
          ContinuationToken: 'next-page',
        },
      ]);
    });

    it('should not rewrite specific S3 list authentication failures', async () => {
      const listError = createSignatureMismatchListError();
      sinon
        .stub(awsRollback.provider, 'request')
        .withArgs('S3', 'listObjectsV2')
        .rejects(listError);

      try {
        await awsRollback.setStackToUpdate();
        throw new Error('Expected setStackToUpdate to reject');
      } catch (error) {
        expect(error).to.equal(listError);
      }
    });

    it('should rewrite explicit S3 list access denied failures', async () => {
      const listError = createAccessDeniedListError();
      sinon
        .stub(awsRollback.provider, 'request')
        .withArgs('S3', 'listObjectsV2')
        .rejects(listError);

      await expect(awsRollback.setStackToUpdate()).to.be.eventually.rejected.and.have.property(
        'code',
        'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
      );
    });

    it('should rewrite wrapped status-only S3 list access denied failures', async () => {
      const listError = createWrappedStatusOnlyListError();
      sinon
        .stub(awsRollback.provider, 'request')
        .withArgs('S3', 'listObjectsV2')
        .rejects(listError);

      await expect(awsRollback.setStackToUpdate()).to.be.eventually.rejected.and.have.property(
        'code',
        'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
      );
    });

    it('should read the state file for the selected deployment', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      requestStub.withArgs('S3', 'listObjectsV2').resolves({
        Contents: [
          {
            Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
          },
        ],
      });
      requestStub.withArgs('S3', 'getObject').resolves({
        Body: JSON.stringify({ service: { service: 'rollback' } }),
      });

      await awsRollback.setStackToUpdate();

      expect(requestStub).to.have.been.calledWithExactly('S3', 'getObject', {
        Bucket: awsRollback.bucketName,
        Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/serverless-state.json',
      });
    });

    it('should continue when the selected deployment has no state file', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      stubSelectedDeploymentList(requestStub);
      requestStub.withArgs('S3', 'getObject').rejects({
        code: 'AWS_S3_GET_OBJECT_NO_SUCH_KEY',
      });

      await expect(awsRollback.setStackToUpdate()).to.eventually.be.fulfilled;
      expectGetStateFileCall(requestStub);
    });

    it('should reject malformed deployment state JSON', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      stubSelectedDeploymentList(requestStub);
      requestStub.withArgs('S3', 'getObject').resolves({
        Body: '{not-json',
      });

      await expect(awsRollback.setStackToUpdate()).to.be.rejectedWith(SyntaxError);
      expectGetStateFileCall(requestStub);
    });

    it('should reject empty deployment state JSON', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      stubSelectedDeploymentList(requestStub);
      requestStub.withArgs('S3', 'getObject').resolves({
        Body: '',
      });

      await expect(awsRollback.setStackToUpdate()).to.be.rejectedWith(SyntaxError);
      expectGetStateFileCall(requestStub);
    });

    it('should reject rollback for unsupported console deployment state', async () => {
      const requestStub = sinon.stub(awsRollback.provider, 'request');
      requestStub.withArgs('S3', 'listObjectsV2').resolves({
        Contents: [
          {
            Key: 'serverless/rollback/dev/1476779096930-2016-10-18T08:24:56.930Z/compiled-cloudformation-template.json',
          },
        ],
      });
      requestStub.withArgs('S3', 'getObject').resolves({
        Body: JSON.stringify({ console: true }),
      });

      await expect(awsRollback.setStackToUpdate()).to.be.eventually.rejected.and.have.property(
        'code',
        'CONSOLE_ACTIVATION_MISMATCH_ROLLBACK'
      );
    });
  });
});

describe('test/unit/lib/plugins/aws/rollback.test.js', () => {
  it('Should gently handle error of listing objects from S3 bucket', async () => {
    await expect(
      runServerless({
        fixture: 'function',
        command: 'rollback',
        awsRequestStubMap: {
          CloudFormation: {
            describeStacks: {},
            describeStackResource: {
              StackResourceDetail: { PhysicalResourceId: 'deployment-bucket' },
            },
          },
          STS: {
            getCallerIdentity: {
              ResponseMetadata: { RequestId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
              UserId: 'XXXXXXXXXXXXXXXXXXXXX',
              Account: '999999999999',
              Arn: 'arn:aws:iam::999999999999:user/test',
            },
          },
          S3: {
            headObject: () => {},
            headBucket: () => {},
            listObjectsV2: () => {
              const err = new Error('error!');
              err.code = 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED';
              throw err;
            },
          },
        },
      })
    ).to.eventually.be.rejected.and.have.property('code', 'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED');
  });
});
