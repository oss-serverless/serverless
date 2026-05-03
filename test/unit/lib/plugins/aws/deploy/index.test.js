'use strict';

const sinon = require('sinon');

const runServerless = require('../../../../../utils/run-serverless');

const expect = require('chai').expect;

describe('test/unit/lib/plugins/aws/deploy/index.test.js', () => {
  const baseAwsRequestStubMap = {
    STS: {
      getCallerIdentity: {
        ResponseMetadata: { RequestId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
        UserId: 'XXXXXXXXXXXXXXXXXXXXX',
        Account: '999999999999',
        Arn: 'arn:aws:iam::999999999999:user/test',
      },
    },
  };

  const createCloudFormationValidationError = (message) =>
    Object.assign(new Error(message), { name: 'ValidationError' });

  const getCloudFormationSends = (awsSdkV3Stub, method) =>
    awsSdkV3Stub.sends.filter(
      ({ service, method: sendMethod }) => service === 'CloudFormation' && sendMethod === method
    );

  describe('with direct create/update calls', () => {
    it('with nonexistent stack - first deploy', async () => {
      const describeStacksStub = sinon
        .stub()
        .onFirstCall()
        .throws(createCloudFormationValidationError('stack does not exist'))
        .onSecondCall()
        .resolves({ Stacks: [{}] });
      const createStackStub = sinon.stub().resolves({});
      const updateStackStub = sinon.stub().resolves({});
      const s3UploadStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves({});
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          upload: s3UploadStub,
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: describeStacksStub,
          createStack: createStackStub,
          updateStack: updateStackStub,
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'CREATE_COMPLETE',
              },
            ],
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      const { serverless, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          provider: {
            deploymentMethod: 'direct',
          },
        },
      });

      expect(createStackStub).to.be.calledOnce;
      expect(updateStackStub).to.be.calledOnce;
      const createStackSends = getCloudFormationSends(awsSdkV3Stub, 'createStack');
      const updateStackSends = getCloudFormationSends(awsSdkV3Stub, 'updateStack');
      const validateTemplateSends = getCloudFormationSends(awsSdkV3Stub, 'validateTemplate');
      expect(createStackSends).to.have.length(1);
      expect(updateStackSends).to.have.length(1);
      expect(validateTemplateSends).to.have.length(1);
      expect(updateStackSends[0].client).to.equal(createStackSends[0].client);
      expect(validateTemplateSends[0].client).to.equal(createStackSends[0].client);
      const expectedCredentials = serverless.getProvider('aws').getAwsSdkV3CredentialsProvider();
      expect(createStackSends[0].clientConfig.region).to.equal('us-east-1');
      expect(createStackSends[0].clientConfig.credentials).to.equal(expectedCredentials);
      expect(updateStackSends[0].clientConfig.region).to.equal('us-east-1');
      expect(updateStackSends[0].clientConfig.credentials).to.equal(expectedCredentials);
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).not.to.be.called;
    });

    it('with nonexistent stack - first deploy with custom deployment bucket', async () => {
      const describeStacksStub = sinon
        .stub()
        .onFirstCall()
        .throws(createCloudFormationValidationError('stack does not exist'))
        .onSecondCall()
        .resolves({ Stacks: [{}] });
      const createStackStub = sinon.stub().resolves({});
      const updateStackStub = sinon.stub().resolves({});
      const s3UploadStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves({});
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          upload: s3UploadStub,
          getBucketLocation: () => {
            return {
              LocationConstraint: 'us-east-1',
            };
          },
          headBucket: () => {
            return {
              BucketRegion: 'us-east-1',
            };
          },
        },
        CloudFormation: {
          describeStacks: describeStacksStub,
          createStack: createStackStub,
          updateStack: updateStackStub,
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'CREATE_COMPLETE',
              },
            ],
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          provider: {
            deploymentBucket: 'existing-s3-bucket',
            deploymentMethod: 'direct',
          },
        },
      });

      expect(createStackStub).to.be.calledOnce;
      expect(updateStackStub).not.to.be.called;
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).not.to.be.called;
    });

    it('does not treat message-only stack-not-found errors as missing stacks', async () => {
      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap: {
            ...baseAwsRequestStubMap,
            CloudFormation: {
              describeStacks: () => {
                throw new Error('stack does not exist');
              },
            },
          },
          configExt: {
            provider: {
              deploymentMethod: 'direct',
            },
          },
        })
      ).to.eventually.be.rejectedWith('stack does not exist');
    });

    it('does not treat credential provider errors as missing stacks', async () => {
      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap: {
            ...baseAwsRequestStubMap,
            CloudFormation: {
              describeStacks: () => {
                throw Object.assign(new Error('stack does not exist'), {
                  name: 'CredentialsProviderError',
                });
              },
            },
          },
          configExt: {
            provider: {
              deploymentMethod: 'direct',
            },
          },
        })
      ).to.eventually.be.rejectedWith('stack does not exist');
    });

    it('with existing stack - subsequent deploy', async () => {
      const s3BucketPrefix = 'serverless/test-aws-deploy-with-existing-stack/dev';
      const s3UploadStub = sinon.stub().resolves();
      const createStackStub = sinon.stub().resolves({});
      const updateStackStub = sinon.stub().resolves({});
      const listObjectsV2Stub = sinon
        .stub()
        .onFirstCall()
        .resolves({ Contents: [] })
        .onSecondCall()
        .resolves({
          Contents: [
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/artifact.zip`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704352-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704352-2020-05-20T15:31:44.359Z/artifact.zip`,
            },
          ],
        });
      const deleteObjectsStub = sinon.stub().resolves();
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: listObjectsV2Stub,
          upload: s3UploadStub,
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          createStack: createStackStub,
          updateStack: updateStackStub,
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          // Default, non-deterministic service-name invalidates this test as S3 Bucket cleanup relies on it
          service: 'test-aws-deploy-with-existing-stack',
          provider: {
            deploymentMethod: 'direct',
            deploymentBucket: {
              maxPreviousDeploymentArtifacts: 1,
            },
          },
        },
      });

      expect(createStackStub).not.to.be.called;
      expect(updateStackStub).to.be.calledOnce;
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
        Bucket: 's3-bucket-resource',
        Delete: {
          Objects: [
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            { Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/artifact.zip` },
          ],
        },
      });
    });

    it('does not treat message-only direct update no-op errors as expected no-ops', async () => {
      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          options: {
            force: true,
          },
          awsRequestStubMap: {
            ...baseAwsRequestStubMap,
            ECR: {
              describeRepositories: sinon.stub().throws({
                providerError: { code: 'RepositoryNotFoundException' },
              }),
            },
            S3: {
              listObjectsV2: { Contents: [] },
              upload: {},
              headBucket: {},
            },
            CloudFormation: {
              describeStacks: { Stacks: [{}] },
              describeStackResource: {
                StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
              },
              validateTemplate: {},
              updateStack: () => {
                throw new Error('No updates are to be performed.');
              },
            },
          },
          configExt: {
            provider: {
              deploymentMethod: 'direct',
            },
          },
        })
      ).to.eventually.be.rejectedWith('No updates are to be performed.');
    });

    it('treats native SDK v3 direct update no-op errors as expected no-ops', async () => {
      await runServerless({
        fixture: 'function',
        command: 'deploy',
        options: {
          force: true,
        },
        awsRequestStubMap: {
          ...baseAwsRequestStubMap,
          ECR: {
            describeRepositories: sinon.stub().throws({
              providerError: { code: 'RepositoryNotFoundException' },
            }),
          },
          S3: {
            listObjectsV2: { Contents: [] },
            upload: {},
            headBucket: {},
          },
          CloudFormation: {
            describeStacks: { Stacks: [{}] },
            describeStackResource: {
              StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
            },
            validateTemplate: {},
            listStackResources: { StackResourceSummaries: [] },
            updateStack: () => {
              throw createCloudFormationValidationError('No updates are to be performed.');
            },
          },
        },
        configExt: {
          provider: {
            deploymentMethod: 'direct',
          },
        },
      });
    });

    it('does not treat message-only deployment bucket lookup errors as missing resources', async () => {
      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap: {
            ...baseAwsRequestStubMap,
            CloudFormation: {
              describeStacks: { Stacks: [{}] },
              validateTemplate: {},
              describeStackResource: () => {
                throw new Error('does not exist for stack');
              },
            },
          },
          lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
        })
      ).to.eventually.be.rejectedWith('does not exist for stack');
    });

    it('with existing stack - with deployment bucket resource missing from CloudFormation template', async () => {
      const createStackStub = sinon.stub().resolves({});
      const updateStackStub = sinon.stub().resolves({});
      const describeStackResourceStub = sinon
        .stub()
        .onFirstCall()
        .throws(() => {
          const err = new Error('does not exist for stack');
          err.providerError = {
            code: 'ValidationError',
          };
          return err;
        })
        .onSecondCall()
        .resolves({
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        });

      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          listObjectsV2: { Contents: [] },
          headBucket: () => {
            const err = new Error();
            err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
            throw err;
          },
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          validateTemplate: {},
          createStack: createStackStub,
          updateStack: updateStackStub,
          getTemplate: () => {
            return {
              TemplateBody: JSON.stringify({}),
            };
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: describeStackResourceStub,
        },
      };

      const { serverless, awsNaming, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          provider: {
            deploymentMethod: 'direct',
          },
        },
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      });

      expect(createStackStub).not.to.be.called;
      expect(updateStackStub).to.be.calledWithExactly({
        StackName: awsNaming.getStackName(),
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        Parameters: [],
        NotificationARNs: [],
        Tags: [{ Key: 'STAGE', Value: 'dev' }],
        TemplateBody: JSON.stringify({
          Resources: serverless.service.provider.coreCloudFormationTemplate.Resources,
          Outputs: serverless.service.provider.coreCloudFormationTemplate.Outputs,
        }),
      });
      const getTemplateSend = getCloudFormationSends(awsSdkV3Stub, 'getTemplate')[0];
      const updateStackSend = getCloudFormationSends(awsSdkV3Stub, 'updateStack')[0];
      expect(getTemplateSend.commandName).to.equal('GetTemplateCommand');
      expect(updateStackSend.client).to.equal(getTemplateSend.client);
      expect(getTemplateSend.input).to.deep.equal({
        StackName: awsNaming.getStackName(),
        TemplateStage: 'Original',
      });
      const expectedCredentials = serverless.getProvider('aws').getAwsSdkV3CredentialsProvider();
      expect(updateStackSend.commandName).to.equal('UpdateStackCommand');
      expect(updateStackSend.clientConfig.credentials).to.equal(expectedCredentials);
    });

    it('with existing stack - repairs missing deployment bucket from YAML template', async () => {
      const updateStackStub = sinon.stub().resolves({});
      const describeStackResourceStub = sinon
        .stub()
        .onFirstCall()
        .throws(() => {
          const err = new Error('does not exist for stack');
          err.providerError = {
            code: 'ValidationError',
          };
          return err;
        })
        .onSecondCall()
        .resolves({
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        });
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          listObjectsV2: { Contents: [] },
          headBucket: () => {
            const err = new Error();
            err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
            throw err;
          },
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          validateTemplate: {},
          updateStack: updateStackStub,
          getTemplate: {
            TemplateBody: [
              'Resources:',
              '  ExistingBucket:',
              '    Type: AWS::S3::Bucket',
              'Outputs:',
              '  ExistingOutput:',
              '    Value: existing',
            ].join('\n'),
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: describeStackResourceStub,
        },
      };

      const { serverless, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          provider: {
            deploymentMethod: 'direct',
          },
        },
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      });

      const templateBody = JSON.parse(updateStackStub.firstCall.args[0].TemplateBody);
      expect(templateBody.Resources.ExistingBucket).to.deep.equal({
        Type: 'AWS::S3::Bucket',
      });
      expect(templateBody.Outputs.ExistingOutput).to.deep.equal({
        Value: 'existing',
      });
      expect(templateBody.Resources).to.include.keys(
        Object.keys(serverless.service.provider.coreCloudFormationTemplate.Resources)
      );
      expect(templateBody.Outputs).to.include.keys(
        Object.keys(serverless.service.provider.coreCloudFormationTemplate.Outputs)
      );
      expect(getCloudFormationSends(awsSdkV3Stub, 'getTemplate')[0].commandName).to.equal(
        'GetTemplateCommand'
      );
      const getTemplateSend = getCloudFormationSends(awsSdkV3Stub, 'getTemplate')[0];
      const updateStackSend = getCloudFormationSends(awsSdkV3Stub, 'updateStack')[0];
      expect(updateStackSend.commandName).to.equal('UpdateStackCommand');
      expect(updateStackSend.client).to.equal(getTemplateSend.client);
    });

    describe('custom deployment-related properties', () => {
      let createStackStub;
      let updateStackStub;
      const deploymentRole = 'arn:xxx';
      const notificationArns = ['arn:xxx', 'arn:yyy'];
      const stackParameters = [
        {
          ParameterKey: 'key',
          ParameterValue: 'val',
        },
        {
          ParameterKey: 'key2',
          ParameterValue: 'val2',
        },
      ];

      const stackPolicy = [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['Update:*'],
          Resource: '*',
        },
      ];

      const rollbackConfiguration = {
        MonitoringTimeInMinutes: 20,
      };

      const disableRollback = true;
      const stackTags = {
        TAG: 'value',
        ANOTHERTAG: 'anotherval',
      };

      before(async () => {
        const describeStacksStub = sinon
          .stub()
          .onFirstCall()
          .throws(createCloudFormationValidationError('stack does not exist'))
          .onSecondCall()
          .resolves({ Stacks: [{}] });
        createStackStub = sinon.stub().resolves({});
        updateStackStub = sinon.stub().resolves({});
        const awsRequestStubMap = {
          ...baseAwsRequestStubMap,
          ECR: {
            describeRepositories: sinon.stub().throws({
              providerError: { code: 'RepositoryNotFoundException' },
            }),
          },
          S3: {
            deleteObjects: {},
            listObjectsV2: { Contents: [] },
            upload: {},
            headBucket: {},
          },
          CloudFormation: {
            describeStacks: describeStacksStub,
            createStack: createStackStub,
            updateStack: updateStackStub,
            describeStackEvents: {
              StackEvents: [
                {
                  EventId: '1e2f3g4h',
                  StackName: 'new-service-dev',
                  LogicalResourceId: 'new-service-dev',
                  ResourceType: 'AWS::CloudFormation::Stack',
                  Timestamp: new Date(),
                  ResourceStatus: 'CREATE_COMPLETE',
                },
              ],
            },
            describeStackResource: {
              StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
            },
            validateTemplate: {},
            listStackResources: {},
          },
        };

        await runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap,
          configExt: {
            provider: {
              deploymentMethod: 'direct',
              notificationArns,
              rollbackConfiguration,
              stackParameters,
              stackPolicy,
              stackTags,
              disableRollback,
              iam: {
                deploymentRole,
              },
            },
          },
        });
      });

      it('should support custom deployment role', () => {
        expect(createStackStub.getCall(0).args[0].RoleARN).to.equal(deploymentRole);
        expect(updateStackStub.getCall(0).args[0].RoleARN).to.equal(deploymentRole);
      });

      it('should support `notificationsArns`', () => {
        expect(createStackStub.getCall(0).args[0].NotificationARNs).to.deep.equal(notificationArns);
        expect(updateStackStub.getCall(0).args[0].NotificationARNs).to.deep.equal(notificationArns);
      });

      it('should support `stackParameters`', () => {
        expect(createStackStub.getCall(0).args[0].Parameters).to.deep.equal(stackParameters);
        expect(updateStackStub.getCall(0).args[0].Parameters).to.deep.equal(stackParameters);
      });

      it('should support `stackPolicy`', () => {
        expect(updateStackStub.getCall(0).args[0].StackPolicyBody).to.deep.equal(
          JSON.stringify({ Statement: stackPolicy })
        );
      });

      it('should support `rollbackConfiguration`', () => {
        expect(updateStackStub.getCall(0).args[0].RollbackConfiguration).to.deep.equal(
          rollbackConfiguration
        );
      });

      it('should support `disableRollback`', () => {
        expect(createStackStub.getCall(0).args[0].DisableRollback).to.be.true;
        expect(updateStackStub.getCall(0).args[0].DisableRollback).to.be.true;
      });

      it('should support `stackTags`', () => {
        expect(createStackStub.getCall(0).args[0].Tags).to.deep.equal([
          { Key: 'STAGE', Value: 'dev' },
          { Key: 'TAG', Value: 'value' },
          { Key: 'ANOTHERTAG', Value: 'anotherval' },
        ]);
        expect(updateStackStub.getCall(0).args[0].Tags).to.deep.equal([
          { Key: 'STAGE', Value: 'dev' },
          { Key: 'TAG', Value: 'value' },
          { Key: 'ANOTHERTAG', Value: 'anotherval' },
        ]);
      });
    });
  });

  describe('with change-sets', () => {
    it('with nonexistent stack - first deploy with custom deployment bucket', async () => {
      const describeStacksStub = sinon
        .stub()
        .onFirstCall()
        .throws(createCloudFormationValidationError('stack does not exist'))
        .onSecondCall()
        .resolves({ Stacks: [{}] });
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const s3UploadStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves({});
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          upload: s3UploadStub,
          getBucketLocation: () => {
            return {
              LocationConstraint: 'us-east-1',
            };
          },
          headBucket: () => {
            return {
              BucketRegion: 'us-east-1',
            };
          },
        },
        CloudFormation: {
          describeStacks: describeStacksStub,
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          deleteChangeSet: {},
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'CREATE_COMPLETE',
              },
            ],
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          provider: {
            deploymentBucket: 'existing-s3-bucket',
          },
        },
      });

      expect(createChangeSetStub).to.be.calledOnce;
      expect(createChangeSetStub.getCall(0).args[0].ChangeSetType).to.equal('CREATE');
      expect(executeChangeSetStub).to.be.calledOnce;
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).not.to.be.called;
    });

    it('with nonexistent stack - first deploy', async () => {
      const describeStacksStub = sinon
        .stub()
        .onFirstCall()
        .throws(createCloudFormationValidationError('stack does not exist'))
        .onSecondCall()
        .resolves({ Stacks: [{}] });
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const s3UploadStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves({});
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          upload: s3UploadStub,
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: describeStacksStub,
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          deleteChangeSet: {},
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'CREATE_COMPLETE',
              },
            ],
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      const { serverless, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
      });

      expect(createChangeSetStub).to.be.calledTwice;
      expect(createChangeSetStub.getCall(0).args[0].ChangeSetType).to.equal('CREATE');
      expect(createChangeSetStub.getCall(1).args[0].ChangeSetType).to.equal('UPDATE');
      expect(executeChangeSetStub).to.be.calledTwice;
      const createChangeSetSends = getCloudFormationSends(awsSdkV3Stub, 'createChangeSet');
      const executeChangeSetSends = getCloudFormationSends(awsSdkV3Stub, 'executeChangeSet');
      expect(createChangeSetSends).to.have.length(2);
      expect(executeChangeSetSends).to.have.length(2);
      const expectedCredentials = serverless.getProvider('aws').getAwsSdkV3CredentialsProvider();
      expect(createChangeSetSends[0].clientConfig.credentials).to.equal(expectedCredentials);
      expect(executeChangeSetSends[0].clientConfig.credentials).to.equal(expectedCredentials);
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).not.to.be.called;
    });

    it('with nonexistent stack - should output an appropriate error message for an abnormal stack state', async () => {
      const describeStacksStub = sinon
        .stub()
        .onFirstCall()
        .resolves({
          Stacks: [
            {
              StackStatus: 'REVIEW_IN_PROGRESS',
            },
          ],
        });
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const s3UploadStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves({});
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: { Contents: [] },
          upload: s3UploadStub,
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: describeStacksStub,
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          deleteChangeSet: {},
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          describeStackEvents: {},
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap,
        })
      ).to.have.been.eventually.rejected.with.property('code', 'AWS_CLOUDFORMATION_INACTIVE_STACK');
    });

    it('with existing stack - subsequent deploy', async () => {
      const s3BucketPrefix = 'serverless/test-aws-deploy-with-existing-stack/dev';
      const s3UploadStub = sinon.stub().resolves();
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const listObjectsV2Stub = sinon
        .stub()
        .onFirstCall()
        .resolves({ Contents: [] })
        .onSecondCall()
        .resolves({
          Contents: [
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/artifact.zip`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704352-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            {
              Key: `${s3BucketPrefix}/1589988704352-2020-05-20T15:31:44.359Z/artifact.zip`,
            },
          ],
        });
      const deleteObjectsStub = sinon.stub().resolves();
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: listObjectsV2Stub,
          upload: s3UploadStub,
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          deleteChangeSet: {},
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        configExt: {
          // Default, non-deterministic service-name invalidates this test as S3 Bucket cleanup relies on it
          service: 'test-aws-deploy-with-existing-stack',
          provider: {
            deploymentBucket: {
              maxPreviousDeploymentArtifacts: 1,
            },
          },
        },
      });

      expect(createChangeSetStub).to.be.calledOnce;
      expect(createChangeSetStub.getCall(0).args[0].ChangeSetType).to.equal('UPDATE');
      expect(executeChangeSetStub).to.be.calledOnce;
      const wasCloudFormationTemplateUploadInitiated = s3UploadStub.args.some((call) =>
        call[0].Key.endsWith('compiled-cloudformation-template.json')
      );
      expect(wasCloudFormationTemplateUploadInitiated).to.be.true;
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
        Bucket: 's3-bucket-resource',
        Delete: {
          Objects: [
            {
              Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/compiled-cloudformation-template.json`,
            },
            { Key: `${s3BucketPrefix}/1589988704351-2020-05-20T15:31:44.359Z/artifact.zip` },
          ],
        },
      });
    });

    it('with existing stack - subsequent deploy with empty changeset', async () => {
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const deleteChangeSetStub = sinon.stub().resolves();
      const deleteObjectsStub = sinon.stub().resolves();
      let objectsToRemove;
      const listObjectsV2Stub = sinon
        .stub()
        .onFirstCall()
        .resolves({ Contents: [] })
        .onSecondCall()
        .callsFake((params) => {
          objectsToRemove = [
            {
              Key: `${params.Prefix}/compiled-cloudformation-template.json`,
            },
            {
              Key: `${params.Prefix}/artifact.zip`,
            },
          ];
          return {
            Contents: objectsToRemove,
          };
        });
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: deleteObjectsStub,
          listObjectsV2: listObjectsV2Stub,
          upload: {},
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          deleteChangeSet: deleteChangeSetStub,
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'FAILED',
            StatusReason: 'No updates are to be performed.',
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
      });

      expect(createChangeSetStub).to.be.calledOnce;
      expect(createChangeSetStub.getCall(0).args[0].ChangeSetType).to.equal('UPDATE');
      expect(executeChangeSetStub).not.to.be.called;
      expect(deleteChangeSetStub).to.be.calledTwice;
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[0]).to.deep.equal({
        Bucket: 's3-bucket-resource',
        Delete: { Objects: objectsToRemove },
      });
    });

    it('should fail if cannot create a change set', async () => {
      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          deleteObjects: {},
          listObjectsV2: { Contents: [] },
          upload: {},
          headBucket: {},
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          deleteChangeSet: {},
          createChangeSet: {},
          executeChangeSet: {},
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'FAILED',
            StatusReason: 'Some internal reason',
          },
          describeStackResource: {
            StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
          },
          validateTemplate: {},
          listStackResources: {},
        },
      };

      await expect(
        runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap,
        })
      ).to.have.been.eventually.rejected.with.property(
        'code',
        'AWS_CLOUD_FORMATION_CHANGE_SET_CREATION_FAILED'
      );
    });

    it('with existing stack - with deployment bucket resource missing from CloudFormation template', async () => {
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const describeStackResourceStub = sinon
        .stub()
        .onFirstCall()
        .throws(() => {
          const err = new Error('does not exist for stack');
          err.providerError = {
            code: 'ValidationError',
          };
          return err;
        })
        .onSecondCall()
        .resolves({
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        });

      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          listObjectsV2: { Contents: [] },
          headBucket: () => {
            const err = new Error();
            err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
            throw err;
          },
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          validateTemplate: {},
          deleteChangeSet: {},
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          getTemplate: () => {
            return {
              TemplateBody: JSON.stringify({}),
            };
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: describeStackResourceStub,
        },
      };

      const { serverless, awsNaming, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      });

      expect(createChangeSetStub).to.be.calledWithExactly({
        StackName: awsNaming.getStackName(),
        ChangeSetName: awsNaming.getStackChangeSetName(),
        ChangeSetType: 'UPDATE',
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        Parameters: [],
        NotificationARNs: [],
        Tags: [{ Key: 'STAGE', Value: 'dev' }],
        TemplateBody: JSON.stringify({
          Resources: serverless.service.provider.coreCloudFormationTemplate.Resources,
          Outputs: serverless.service.provider.coreCloudFormationTemplate.Outputs,
        }),
      });
      expect(executeChangeSetStub).to.be.calledWithExactly({
        StackName: awsNaming.getStackName(),
        ChangeSetName: awsNaming.getStackChangeSetName(),
      });
      const getTemplateSend = getCloudFormationSends(awsSdkV3Stub, 'getTemplate')[0];
      const deleteChangeSetSend = getCloudFormationSends(awsSdkV3Stub, 'deleteChangeSet')[0];
      const createChangeSetSend = getCloudFormationSends(awsSdkV3Stub, 'createChangeSet')[0];
      const executeChangeSetSend = getCloudFormationSends(awsSdkV3Stub, 'executeChangeSet')[0];
      expect(getTemplateSend.commandName).to.equal('GetTemplateCommand');
      expect(deleteChangeSetSend.commandName).to.equal('DeleteChangeSetCommand');
      expect(createChangeSetSend.commandName).to.equal('CreateChangeSetCommand');
      expect(executeChangeSetSend.commandName).to.equal('ExecuteChangeSetCommand');
      expect(deleteChangeSetSend.client).to.equal(getTemplateSend.client);
      expect(createChangeSetSend.client).to.equal(getTemplateSend.client);
      expect(executeChangeSetSend.client).to.equal(getTemplateSend.client);
      expect(createChangeSetSend.clientConfig.credentials).to.equal(
        serverless.getProvider('aws').getAwsSdkV3CredentialsProvider()
      );
    });

    it('with existing stack - repairs missing deployment bucket from YAML template with change set', async () => {
      const createChangeSetStub = sinon.stub().resolves({});
      const executeChangeSetStub = sinon.stub().resolves({});
      const describeStackResourceStub = sinon
        .stub()
        .onFirstCall()
        .throws(() => {
          const err = new Error('does not exist for stack');
          err.providerError = {
            code: 'ValidationError',
          };
          return err;
        })
        .onSecondCall()
        .resolves({
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        });

      const awsRequestStubMap = {
        ...baseAwsRequestStubMap,
        ECR: {
          describeRepositories: sinon.stub().throws({
            providerError: { code: 'RepositoryNotFoundException' },
          }),
        },
        S3: {
          listObjectsV2: { Contents: [] },
          headBucket: () => {
            const err = new Error();
            err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
            throw err;
          },
        },
        CloudFormation: {
          describeStacks: { Stacks: [{}] },
          validateTemplate: {},
          deleteChangeSet: {},
          createChangeSet: createChangeSetStub,
          executeChangeSet: executeChangeSetStub,
          describeChangeSet: {
            ChangeSetName: 'new-service-dev-change-set',
            ChangeSetId: 'some-change-set-id',
            StackName: 'new-service-dev',
            Status: 'CREATE_COMPLETE',
          },
          getTemplate: {
            TemplateBody: [
              'Resources:',
              '  ExistingBucket:',
              '    Type: AWS::S3::Bucket',
              'Outputs:',
              '  ExistingOutput:',
              '    Value: existing',
            ].join('\n'),
          },
          describeStackEvents: {
            StackEvents: [
              {
                EventId: '1e2f3g4h',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                Timestamp: new Date(),
                ResourceStatus: 'UPDATE_COMPLETE',
              },
            ],
          },
          describeStackResource: describeStackResourceStub,
        },
      };

      const { serverless, awsSdkV3Stub } = await runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      });

      const templateBody = JSON.parse(createChangeSetStub.firstCall.args[0].TemplateBody);
      expect(templateBody.Resources.ExistingBucket).to.deep.equal({
        Type: 'AWS::S3::Bucket',
      });
      expect(templateBody.Outputs.ExistingOutput).to.deep.equal({
        Value: 'existing',
      });
      expect(templateBody.Resources).to.include.keys(
        Object.keys(serverless.service.provider.coreCloudFormationTemplate.Resources)
      );
      expect(templateBody.Outputs).to.include.keys(
        Object.keys(serverless.service.provider.coreCloudFormationTemplate.Outputs)
      );
      const getTemplateSend = getCloudFormationSends(awsSdkV3Stub, 'getTemplate')[0];
      const createChangeSetSend = getCloudFormationSends(awsSdkV3Stub, 'createChangeSet')[0];
      const executeChangeSetSend = getCloudFormationSends(awsSdkV3Stub, 'executeChangeSet')[0];
      expect(getTemplateSend.commandName).to.equal('GetTemplateCommand');
      expect(createChangeSetSend.commandName).to.equal('CreateChangeSetCommand');
      expect(executeChangeSetSend.commandName).to.equal('ExecuteChangeSetCommand');
      expect(createChangeSetSend.client).to.equal(getTemplateSend.client);
      expect(executeChangeSetSend.client).to.equal(getTemplateSend.client);
    });

    describe('custom deployment-related properties', () => {
      let createChangeSetStub;
      let executeChangeSetStub;
      let setStackPolicyStub;
      let awsSdkV3Stub;
      const deploymentRole = 'arn:xxx';
      const notificationArns = ['arn:xxx', 'arn:yyy'];
      const stackParameters = [
        {
          ParameterKey: 'key',
          ParameterValue: 'val',
        },
        {
          ParameterKey: 'key2',
          ParameterValue: 'val2',
        },
      ];

      const stackPolicy = [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['Update:*'],
          Resource: '*',
        },
      ];

      const rollbackConfiguration = {
        MonitoringTimeInMinutes: 20,
      };

      const disableRollback = true;
      const stackTags = {
        TAG: 'value',
        ANOTHERTAG: 'anotherval',
      };

      before(async () => {
        const describeStacksStub = sinon
          .stub()
          .onFirstCall()
          .throws(createCloudFormationValidationError('stack does not exist'))
          .onSecondCall()
          .resolves({ Stacks: [{}] });
        createChangeSetStub = sinon.stub().resolves({});
        executeChangeSetStub = sinon.stub().resolves({});
        setStackPolicyStub = sinon.stub().resolves({});
        const awsRequestStubMap = {
          ...baseAwsRequestStubMap,
          ECR: {
            describeRepositories: sinon.stub().throws({
              providerError: { code: 'RepositoryNotFoundException' },
            }),
          },
          S3: {
            deleteObjects: {},
            listObjectsV2: { Contents: [] },
            upload: {},
            headBucket: {},
          },
          CloudFormation: {
            describeStacks: describeStacksStub,
            createChangeSet: createChangeSetStub,
            executeChangeSet: executeChangeSetStub,
            deleteChangeSet: {},
            describeChangeSet: {
              ChangeSetName: 'new-service-dev-change-set',
              ChangeSetId: 'some-change-set-id',
              StackName: 'new-service-dev',
              Status: 'CREATE_COMPLETE',
            },
            setStackPolicy: setStackPolicyStub,
            describeStackEvents: {
              StackEvents: [
                {
                  EventId: '1e2f3g4h',
                  StackName: 'new-service-dev',
                  LogicalResourceId: 'new-service-dev',
                  ResourceType: 'AWS::CloudFormation::Stack',
                  Timestamp: new Date(),
                  ResourceStatus: 'CREATE_COMPLETE',
                },
              ],
            },
            describeStackResource: {
              StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
            },
            validateTemplate: {},
            listStackResources: {},
          },
        };

        ({ awsSdkV3Stub } = await runServerless({
          fixture: 'function',
          command: 'deploy',
          awsRequestStubMap,
          configExt: {
            provider: {
              notificationArns,
              rollbackConfiguration,
              stackParameters,
              stackPolicy,
              stackTags,
              disableRollback,
              iam: {
                deploymentRole,
              },
            },
          },
        }));
      });

      it('should support custom deployment role', () => {
        expect(createChangeSetStub.getCall(0).args[0].RoleARN).to.equal(deploymentRole);
        expect(createChangeSetStub.getCall(1).args[0].RoleARN).to.equal(deploymentRole);
      });

      it('should support `notificationsArns`', () => {
        expect(createChangeSetStub.getCall(0).args[0].NotificationARNs).to.deep.equal(
          notificationArns
        );
        expect(createChangeSetStub.getCall(1).args[0].NotificationARNs).to.deep.equal(
          notificationArns
        );
      });

      it('should support `stackParameters`', () => {
        expect(createChangeSetStub.getCall(1).args[0].Parameters).to.deep.equal(stackParameters);
      });

      it('should support `stackPolicy`', () => {
        expect(setStackPolicyStub.getCall(0).args[0].StackPolicyBody).to.equal(
          JSON.stringify({ Statement: stackPolicy })
        );
      });

      it('should only set `stackPolicy` after applying change set', () => {
        expect(setStackPolicyStub).to.not.be.calledBefore(executeChangeSetStub);
        const cfMethods = awsSdkV3Stub.sends
          .filter(({ service }) => service === 'CloudFormation')
          .map(({ method }) => method);
        expect(cfMethods.indexOf('executeChangeSet')).to.be.lessThan(
          cfMethods.indexOf('setStackPolicy')
        );
        expect(getCloudFormationSends(awsSdkV3Stub, 'setStackPolicy')[0].commandName).to.equal(
          'SetStackPolicyCommand'
        );
      });

      it('should support `rollbackConfiguration`', () => {
        expect(createChangeSetStub.getCall(1).args[0].RollbackConfiguration).to.deep.equal(
          rollbackConfiguration
        );
      });

      it('should support `disableRollback`', () => {
        expect(executeChangeSetStub.getCall(0).args[0].DisableRollback).to.be.true;
        expect(executeChangeSetStub.getCall(1).args[0].DisableRollback).to.be.true;
      });

      it('should support `stackTags`', () => {
        expect(createChangeSetStub.getCall(0).args[0].Tags).to.deep.equal([
          { Key: 'STAGE', Value: 'dev' },
          { Key: 'TAG', Value: 'value' },
          { Key: 'ANOTHERTAG', Value: 'anotherval' },
        ]);
        expect(createChangeSetStub.getCall(1).args[0].Tags).to.deep.equal([
          { Key: 'STAGE', Value: 'dev' },
          { Key: 'TAG', Value: 'value' },
          { Key: 'ANOTHERTAG', Value: 'anotherval' },
        ]);
      });
    });
  });

  it('with existing stack - should skip deploy if nothing changed', async () => {
    // Skipped because the Enterprise plugin messed it up
  });

  it('with existing stack - missing custom deployment bucket', async () => {
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      S3: {
        getBucketLocation: () => {
          throw new Error();
        },
        headBucket: () => {
          throw new Error();
        },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
      },
    };

    await expect(
      runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
        configExt: {
          provider: {
            deploymentBucket: 'bucket-name',
          },
        },
      })
    ).to.eventually.have.been.rejected.and.have.property('code', 'DEPLOYMENT_BUCKET_NOT_FOUND');
  });

  it('with existing stack - with custom deployment bucket and unknown region', async () => {
    const headBucketStub = sinon.stub().returns({});
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      Lambda: {
        getFunction: {
          Configuration: { LastModified: '2020-05-20T15:31:44.359Z' },
        },
      },
      S3: {
        headBucket: headBucketStub,
        listObjectsV2: { Contents: [] },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
      },
    };

    await runServerless({
      fixture: 'function',
      command: 'deploy',
      awsRequestStubMap,
      lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      configExt: {
        provider: {
          deploymentBucket: 'bucket-name',
        },
      },
    });

    expect(headBucketStub).to.be.calledOnce;
  });

  it('with existing stack - with custom deployment bucket in different region', async () => {
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      S3: {
        getBucketLocation: () => {
          return {
            LocationConstraint: 'us-west-1',
          };
        },
        headBucket: () => {
          return {
            BucketRegion: 'us-west-1',
          };
        },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
      },
    };

    await expect(
      runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
        configExt: {
          provider: {
            deploymentBucket: 'bucket-name',
          },
        },
      })
    ).to.eventually.have.been.rejected.and.have.property(
      'code',
      'DEPLOYMENT_BUCKET_INVALID_REGION'
    );
  });

  it('with existing stack - with custom deployment bucket region redirect error', async () => {
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      S3: {
        headBucket: () => {
          const err = new Error('Moved Permanently');
          err.name = 'PermanentRedirect';
          err.$metadata = { httpStatusCode: 301 };
          err.$response = { headers: { 'x-amz-bucket-region': 'us-west-1' } };
          throw err;
        },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
      },
    };

    await expect(
      runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
        configExt: {
          provider: {
            deploymentBucket: 'bucket-name',
          },
        },
      })
    ).to.eventually.have.been.rejected.and.have.property(
      'code',
      'DEPLOYMENT_BUCKET_INVALID_REGION'
    );
  });

  it('with existing stack - with deployment bucket from CloudFormation deleted manually', async () => {
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      S3: {
        headBucket: () => {
          const err = new Error();
          err.code = 'AWS_S3_HEAD_BUCKET_NOT_FOUND';
          throw err;
        },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
        describeStackResource: {
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        },
      },
    };

    await expect(
      runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      })
    ).to.eventually.have.been.rejected.and.have.property(
      'code',
      'DEPLOYMENT_BUCKET_REMOVED_MANUALLY'
    );
  });

  it('should throw when deployment bucket cannot be accessed', async () => {
    const awsRequestStubMap = {
      ...baseAwsRequestStubMap,
      ECR: {
        describeRepositories: sinon.stub().throws({
          providerError: { code: 'RepositoryNotFoundException' },
        }),
      },
      S3: {
        headBucket: () => {
          const err = new Error();
          err.code = 'AWS_S3_HEAD_BUCKET_FORBIDDEN';
          throw err;
        },
      },
      CloudFormation: {
        describeStacks: { Stacks: [{}] },
        validateTemplate: {},
        describeStackResource: {
          StackResourceDetail: { PhysicalResourceId: 's3-bucket-resource' },
        },
      },
    };

    await expect(
      runServerless({
        fixture: 'function',
        command: 'deploy',
        awsRequestStubMap,
        lastLifecycleHookName: 'aws:deploy:deploy:checkForChanges',
      })
    ).to.eventually.have.been.rejected.and.have.property('code', 'AWS_S3_HEAD_BUCKET_FORBIDDEN');
  });
});
