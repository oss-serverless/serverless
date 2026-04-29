'use strict';

const sinon = require('sinon');
const chai = require('chai');
const AwsProvider = require('../../../../../../../lib/plugins/aws/provider');
const AwsDeploy = require('../../../../../../../lib/plugins/aws/deploy/index');
const Serverless = require('../../../../../../../lib/serverless');

const expect = chai.expect;

describe('cleanupS3Bucket', () => {
  let serverless;
  let provider;
  let awsDeploy;
  let s3Key;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless({ commands: [], options: {} });
    serverless.serviceDir = 'foo';
    provider = new AwsProvider(serverless, options);
    serverless.setProvider('aws', provider);
    serverless.service.service = 'cleanupS3Bucket';
    const prefix = provider.getDeploymentPrefix();
    s3Key = `${prefix}/${serverless.service.service}/${provider.getStage()}`;
    awsDeploy = new AwsDeploy(serverless, options);
    awsDeploy.bucketName = 'deployment-bucket';
    awsDeploy.serverless.cli = new serverless.classes.CLI();
  });

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

  const createWrappedStatusOnlyListError = () => {
    const error = createStatusOnlyListError();
    error.code = 'AWS_S3_LIST_OBJECTS_V2_ERROR';
    return error;
  };

  describe('#getObjectsToRemove()', () => {
    it('should resolve if no objects are found', async () => {
      const serviceObjects = {
        Contents: [],
      };

      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

      return awsDeploy.getObjectsToRemove().then(() => {
        expect(listObjectsStub).to.have.been.calledOnce;
        expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
          Bucket: awsDeploy.bucketName,
          Prefix: `${s3Key}/`,
        });
        awsDeploy.provider.request.restore();
      });
    });

    it('should return all service objects except the default preserved deployments', async () => {
      const deploymentDirectories = [
        '1000000000000-2001-09-09T01:46:40.000Z',
        '1000000001000-2001-09-09T01:46:41.000Z',
        '1000000002000-2001-09-09T01:46:42.000Z',
        '1000000003000-2001-09-09T01:46:43.000Z',
        '1000000004000-2001-09-09T01:46:44.000Z',
        '1000000005000-2001-09-09T01:46:45.000Z',
      ];
      const serviceObjects = {
        Contents: deploymentDirectories.flatMap((directory) => [
          { Key: `${s3Key}/${directory}/artifact.zip` },
          { Key: `${s3Key}/${directory}/cloudformation.json` },
        ]),
      };

      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

      return awsDeploy.getObjectsToRemove().then((objectsToRemove) => {
        expect(objectsToRemove).to.deep.equal([
          { Key: `${s3Key}/${deploymentDirectories[0]}/artifact.zip` },
          { Key: `${s3Key}/${deploymentDirectories[0]}/cloudformation.json` },
        ]);
        expect(listObjectsStub.calledOnce).to.be.equal(true);
        expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
          Bucket: awsDeploy.bucketName,
          Prefix: `${s3Key}/`,
        });
        awsDeploy.provider.request.restore();
      });
    });

    it('should not rewrite specific S3 list authentication failures', async () => {
      const listError = createSignatureMismatchListError();
      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').rejects(listError);

      try {
        await awsDeploy.getObjectsToRemove();
        throw new Error('Expected getObjectsToRemove to reject');
      } catch (error) {
        expect(error).to.equal(listError);
      } finally {
        expect(listObjectsStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should rewrite status-only S3 list access denied failures', async () => {
      const listError = createStatusOnlyListError();
      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').rejects(listError);

      try {
        await expect(awsDeploy.getObjectsToRemove()).to.be.eventually.rejected.and.have.property(
          'code',
          'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
        );
      } finally {
        expect(listObjectsStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should rewrite wrapped status-only S3 list access denied failures', async () => {
      const listError = createWrappedStatusOnlyListError();
      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').rejects(listError);

      try {
        await expect(awsDeploy.getObjectsToRemove()).to.be.eventually.rejected.and.have.property(
          'code',
          'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
        );
      } finally {
        expect(listObjectsStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should rewrite explicit S3 list access denied failures', async () => {
      const listError = createAccessDeniedListError();
      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').rejects(listError);

      try {
        await expect(awsDeploy.getObjectsToRemove()).to.be.eventually.rejected.and.have.property(
          'code',
          'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
        );
      } finally {
        expect(listObjectsStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should list all paginated deployment objects before selecting objects to remove', async () => {
      serverless.service.provider.deploymentBucketObject = {
        maxPreviousDeploymentArtifacts: 1,
      };
      const oldKey = `${s3Key}/141264711231-2016-08-18T15:43:00/artifact.zip`;
      const newKey = `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip`;
      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request');
      listObjectsStub
        .withArgs('S3', 'listObjectsV2')
        .onFirstCall()
        .resolves({
          Contents: [{ Key: oldKey }],
          NextContinuationToken: 'next-page',
        })
        .onSecondCall()
        .resolves({
          Contents: [{ Key: newKey }],
        });

      try {
        const objectsToRemove = await awsDeploy.getObjectsToRemove();

        expect(objectsToRemove).to.deep.equal([{ Key: oldKey }]);
        expect(listObjectsStub).to.have.been.calledTwice;
        expect(listObjectsStub.firstCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/`,
          },
        ]);
        expect(listObjectsStub.secondCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/`,
            ContinuationToken: 'next-page',
          },
        ]);
      } finally {
        awsDeploy.provider.request.restore();
        delete serverless.service.provider.deploymentBucketObject;
      }
    });

    it('should return an empty array if there are less than 4 directories available', async () => {
      const serviceObjects = {
        Contents: [
          { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip` },
          { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/cloudformation.json` },
          { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/artifact.zip` },
          { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/cloudformation.json` },
          { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/artifact.zip` },
          { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/cloudformation.json` },
        ],
      };

      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

      return awsDeploy.getObjectsToRemove().then((objectsToRemove) => {
        expect(objectsToRemove.length).to.equal(0);
        expect(listObjectsStub.calledOnce).to.be.equal(true);
        expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
          Bucket: awsDeploy.bucketName,
          Prefix: `${s3Key}/`,
        });
        awsDeploy.provider.request.restore();
      });
    });

    it('should return an empty array if there are exactly 4 directories available', async () => {
      const serviceObjects = {
        Contents: [
          { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip` },
          { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/cloudformation.json` },
          { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/artifact.zip` },
          { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/cloudformation.json` },
          { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/artifact.zip` },
          { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/cloudformation.json` },
          { Key: `${s3Key}/142003031341-2016-08-18T12:46:04/artifact.zip` },
          { Key: `${s3Key}/142003031341-2016-08-18T12:46:04/cloudformation.json` },
        ],
      };

      const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

      return awsDeploy.getObjectsToRemove().then((objectsToRemove) => {
        expect(objectsToRemove).to.have.lengthOf(0);
        expect(listObjectsStub).to.have.been.calledOnce;
        expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
          Bucket: awsDeploy.bucketName,
          Prefix: `${s3Key}/`,
        });
        awsDeploy.provider.request.restore();
      });
    });

    describe('custom maxPreviousDeploymentArtifacts', () => {
      afterEach(() => {
        // restore to not conflict with other tests
        delete serverless.service.provider.deploymentBucketObject;
      });

      it('should allow configuring the number of artifacts to preserve', async () => {
        // configure the provider to allow only a single artifact
        serverless.service.provider.deploymentBucketObject = {
          maxPreviousDeploymentArtifacts: 1,
        };

        const serviceObjects = {
          Contents: [
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/artifact.zip` },
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/cloudformation.json` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/cloudformation.json` },
            { Key: `${s3Key}/141264711231-2016-08-18T15:43:00/artifact.zip` },
            { Key: `${s3Key}/141264711231-2016-08-18T15:43:00/cloudformation.json` },
          ],
        };

        const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

        return awsDeploy.getObjectsToRemove().then((objectsToRemove) => {
          expect(objectsToRemove).to.deep.include.members([
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/artifact.zip` },
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/cloudformation.json` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/cloudformation.json` },
          ]);

          expect(objectsToRemove).to.not.deep.include({
            Key: `${s3Key}/141264711231-2016-08-18T15:43:00/artifact.zip`,
          });

          expect(objectsToRemove).to.not.deep.include({
            Key: `${s3Key}/141264711231-2016-08-18T15:43:00/cloudformation.json`,
          });

          expect(listObjectsStub.calledOnce).to.be.equal(true);
          expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/`,
          });
          awsDeploy.provider.request.restore();
        });
      });

      it('should preserve zero when configuring the number of artifacts to preserve', async () => {
        serverless.service.provider.deploymentBucketObject = {
          maxPreviousDeploymentArtifacts: 0,
        };

        const serviceObjects = {
          Contents: [
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/artifact.zip` },
            { Key: `${s3Key}/141321321541-2016-08-18T11:23:02/cloudformation.json` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/artifact.zip` },
            { Key: `${s3Key}/151224711231-2016-08-18T15:42:00/cloudformation.json` },
            { Key: `${s3Key}/141264711231-2016-08-18T15:43:00/artifact.zip` },
            { Key: `${s3Key}/141264711231-2016-08-18T15:43:00/cloudformation.json` },
          ],
        };

        const listObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves(serviceObjects);

        return awsDeploy.getObjectsToRemove().then((objectsToRemove) => {
          expect(objectsToRemove).to.deep.equal(serviceObjects.Contents);

          expect(listObjectsStub.calledOnce).to.be.equal(true);
          expect(listObjectsStub).to.have.been.calledWithExactly('S3', 'listObjectsV2', {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/`,
          });
          awsDeploy.provider.request.restore();
        });
      });
    });
  });

  describe('#removeObjects()', () => {
    let deleteObjectsStub;

    beforeEach(() => {
      deleteObjectsStub = sinon.stub(awsDeploy.provider, 'request').resolves();
    });

    afterEach(() => {
      if (awsDeploy.provider.request.restore) awsDeploy.provider.request.restore();
    });

    it('should resolve if no service objects are found in the S3 bucket', async () =>
      awsDeploy.removeObjects().then(() => {
        expect(deleteObjectsStub.calledOnce).to.be.equal(false);
        awsDeploy.provider.request.restore();
      }));

    it('should remove all old service files from the S3 bucket if available', async () => {
      const objectsToRemove = [
        { Key: `${s3Key}/113304333331-2016-08-18T13:40:06/artifact.zip` },
        { Key: `${s3Key}/113304333331-2016-08-18T13:40:06/cloudformation.json` },
        { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/artifact.zip` },
        { Key: `${s3Key}/141264711231-2016-08-18T15:42:00/cloudformation.json` },
      ];

      return awsDeploy.removeObjects(objectsToRemove).then(() => {
        expect(deleteObjectsStub).to.have.been.calledOnce;
        expect(deleteObjectsStub).to.have.been.calledWithExactly('S3', 'deleteObjects', {
          Bucket: awsDeploy.bucketName,
          Delete: {
            Objects: objectsToRemove,
          },
        });
        awsDeploy.provider.request.restore();
      });
    });

    it('should remove service files in batches of 1000 objects', async () => {
      const objectsToRemove = Array.from({ length: 1001 }, (ignored, index) => ({
        Key: `${s3Key}/artifact-${index}.zip`,
      }));

      await awsDeploy.removeObjects(objectsToRemove);

      expect(deleteObjectsStub).to.have.been.calledTwice;
      expect(deleteObjectsStub.firstCall.args).to.deep.equal([
        'S3',
        'deleteObjects',
        {
          Bucket: awsDeploy.bucketName,
          Delete: {
            Objects: objectsToRemove.slice(0, 1000),
          },
        },
      ]);
      expect(deleteObjectsStub.secondCall.args).to.deep.equal([
        'S3',
        'deleteObjects',
        {
          Bucket: awsDeploy.bucketName,
          Delete: {
            Objects: objectsToRemove.slice(1000),
          },
        },
      ]);
    });

    it('should fail when a delete objects batch returns a generic partial failure', async () => {
      deleteObjectsStub.resolves({
        Errors: [{ Code: 'InternalError' }],
      });

      await expect(
        awsDeploy.removeObjects([{ Key: `${s3Key}/artifact.zip` }])
      ).to.be.eventually.rejected.and.have.property('code', 'CANNOT_DELETE_S3_OBJECTS_GENERIC');
    });

    it('should fail when a delete objects batch returns an access denied partial failure', async () => {
      deleteObjectsStub.resolves({
        Errors: [{ Code: 'AccessDenied' }],
      });

      await expect(
        awsDeploy.removeObjects([{ Key: `${s3Key}/artifact.zip` }])
      ).to.be.eventually.rejected.and.have.property(
        'code',
        'CANNOT_DELETE_S3_OBJECTS_ACCESS_DENIED'
      );
    });
  });

  describe('#cleanupArtifactsForEmptyChangeSet()', () => {
    it('should remove artifacts from all listed pages', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const firstKey = `${s3Key}/${deploymentDirectory}/artifact.zip`;
      const secondKey = `${s3Key}/${deploymentDirectory}/compiled-cloudformation-template.json`;
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      requestStub
        .withArgs('S3', 'listObjectsV2')
        .onFirstCall()
        .resolves({
          Contents: [{ Key: firstKey }],
          NextContinuationToken: 'next-page',
        })
        .onSecondCall()
        .resolves({ Contents: [{ Key: secondKey }] });
      requestStub.withArgs('S3', 'deleteObjects').resolves();

      try {
        await awsDeploy.cleanupArtifactsForEmptyChangeSet();

        expect(requestStub.firstCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/${deploymentDirectory}/`,
          },
        ]);
        expect(requestStub.secondCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${s3Key}/${deploymentDirectory}/`,
            ContinuationToken: 'next-page',
          },
        ]);
        const deleteCall = requestStub
          .getCalls()
          .find((call) => call.args[0] === 'S3' && call.args[1] === 'deleteObjects');
        expect(deleteCall.args[2]).to.deep.equal({
          Bucket: awsDeploy.bucketName,
          Delete: {
            Objects: [{ Key: firstKey }, { Key: secondKey }],
          },
        });
      } finally {
        awsDeploy.provider.request.restore();
      }
    });

    it('should list only the selected deployment directory', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      const artifactKey = `${artifactDirectoryName}/artifact.zip`;
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = artifactDirectoryName;
      requestStub.withArgs('S3', 'listObjectsV2').resolves({
        Contents: [{ Key: artifactKey }],
      });
      requestStub.withArgs('S3', 'deleteObjects').resolves();

      try {
        await awsDeploy.cleanupArtifactsForEmptyChangeSet();

        expect(requestStub.firstCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${artifactDirectoryName}/`,
          },
        ]);
      } finally {
        awsDeploy.provider.request.restore();
      }
    });

    it('should not rewrite specific empty-changeset S3 list authentication failures', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const listError = createSignatureMismatchListError();
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      requestStub.withArgs('S3', 'listObjectsV2').rejects(listError);

      try {
        await awsDeploy.cleanupArtifactsForEmptyChangeSet();
        throw new Error('Expected cleanupArtifactsForEmptyChangeSet to reject');
      } catch (error) {
        expect(error).to.equal(listError);
      } finally {
        expect(requestStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should rewrite status-only empty-changeset S3 list access denied failures', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const listError = createStatusOnlyListError();
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      requestStub.withArgs('S3', 'listObjectsV2').rejects(listError);

      try {
        await expect(
          awsDeploy.cleanupArtifactsForEmptyChangeSet()
        ).to.be.eventually.rejected.and.have.property(
          'code',
          'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
        );
      } finally {
        expect(requestStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    it('should rewrite wrapped status-only empty-changeset S3 list access denied failures', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const listError = createWrappedStatusOnlyListError();
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      requestStub.withArgs('S3', 'listObjectsV2').rejects(listError);

      try {
        await expect(
          awsDeploy.cleanupArtifactsForEmptyChangeSet()
        ).to.be.eventually.rejected.and.have.property(
          'code',
          'AWS_S3_LIST_OBJECTS_V2_ACCESS_DENIED'
        );
      } finally {
        expect(requestStub).to.have.been.calledOnce;
        awsDeploy.provider.request.restore();
      }
    });

    for (const { description, resolveArtifactDirectoryName } of [
      {
        description: 'the artifact directory is the stage deployment root',
        resolveArtifactDirectoryName: () => s3Key,
      },
      {
        description: 'the artifact directory is the stage deployment root with a trailing slash',
        resolveArtifactDirectoryName: () => `${s3Key}/`,
      },
      {
        description: 'the artifact directory is not a deployment directory',
        resolveArtifactDirectoryName: () => `${s3Key}/not-a-deployment-directory`,
      },
      {
        description: 'the artifact directory is nested below a deployment directory',
        resolveArtifactDirectoryName: () => `${s3Key}/151224711231-2016-08-18T15:42:00/nested`,
      },
    ]) {
      it(`should reject when ${description}`, async () => {
        const requestStub = sinon.stub(awsDeploy.provider, 'request');
        awsDeploy.serverless.service.package.artifactDirectoryName = resolveArtifactDirectoryName();

        try {
          await expect(
            awsDeploy.cleanupArtifactsForEmptyChangeSet()
          ).to.be.eventually.rejected.and.have.property(
            'code',
            'INVALID_EMPTY_CHANGE_SET_ARTIFACT_DIRECTORY'
          );
          expect(requestStub).to.not.have.been.called;
        } finally {
          awsDeploy.provider.request.restore();
        }
      });
    }

    it('should normalize trailing slashes for a selected deployment directory', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      const artifactKey = `${artifactDirectoryName}/artifact.zip`;
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${artifactDirectoryName}/`;
      requestStub.withArgs('S3', 'listObjectsV2').resolves({
        Contents: [{ Key: artifactKey }],
      });
      requestStub.withArgs('S3', 'deleteObjects').resolves();

      try {
        await awsDeploy.cleanupArtifactsForEmptyChangeSet();

        expect(requestStub.firstCall.args).to.deep.equal([
          'S3',
          'listObjectsV2',
          {
            Bucket: awsDeploy.bucketName,
            Prefix: `${artifactDirectoryName}/`,
          },
        ]);
      } finally {
        awsDeploy.provider.request.restore();
      }
    });

    it('should not rewrite delete failures as list failures', async () => {
      const deploymentDirectory = '151224711231-2016-08-18T15:42:00';
      const artifactKey = `${s3Key}/${deploymentDirectory}/artifact.zip`;
      const deleteError = new Error('delete denied');
      deleteError.statusCode = 403;
      const requestStub = sinon.stub(awsDeploy.provider, 'request');
      awsDeploy.serverless.service.package.artifactDirectoryName = `${s3Key}/${deploymentDirectory}`;
      requestStub.withArgs('S3', 'listObjectsV2').resolves({
        Contents: [{ Key: artifactKey }],
      });
      requestStub.withArgs('S3', 'deleteObjects').rejects(deleteError);

      try {
        await awsDeploy.cleanupArtifactsForEmptyChangeSet();
        throw new Error('Expected cleanupArtifactsForEmptyChangeSet to reject');
      } catch (error) {
        expect(error).to.equal(deleteError);
      } finally {
        awsDeploy.provider.request.restore();
      }
    });
  });

  describe('#cleanupS3Bucket()', () => {
    it('should run promise chain in order', async () => {
      const getObjectsToRemoveStub = sinon.stub(awsDeploy, 'getObjectsToRemove').resolves();
      const removeObjectsStub = sinon.stub(awsDeploy, 'removeObjects').resolves();

      return awsDeploy.cleanupS3Bucket().then(() => {
        expect(getObjectsToRemoveStub.calledOnce).to.be.equal(true);
        expect(removeObjectsStub.calledAfter(getObjectsToRemoveStub)).to.be.equal(true);

        awsDeploy.getObjectsToRemove.restore();
        awsDeploy.removeObjects.restore();
      });
    });
  });
});
