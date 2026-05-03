'use strict';

const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Serverless = require('../../../../../../lib/serverless');
const AwsProvider = require('../../../../../../lib/plugins/aws/provider');
const CLI = require('../../../../../../lib/classes/cli');
const monitorStack = require('../../../../../../lib/plugins/aws/lib/monitor-stack');
const {
  CloudFormationClient,
  DescribeStackEventsCommand,
} = require('@aws-sdk/client-cloudformation');

const { expect } = chai;

describe('monitorStack', () => {
  const serverless = new Serverless({ commands: [], options: {} });
  const awsPlugin = {};

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    awsPlugin.serverless = serverless;
    awsPlugin.provider = new AwsProvider(serverless, options);
    awsPlugin.serverless.cli = new CLI(serverless);
    awsPlugin.options = options;

    Object.assign(awsPlugin, monitorStack);
  });

  afterEach(() => {
    delete awsPlugin.cloudFormationClientPromise;
    if (CloudFormationClient.prototype.send.restore) {
      CloudFormationClient.prototype.send.restore();
    }
  });

  const stubDescribeStackEvents = () => {
    const describeStackEventsStub = sinon.stub();
    const sendStub = sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
      expect(command).to.be.instanceOf(DescribeStackEventsCommand);
      return describeStackEventsStub('CloudFormation', 'describeStackEvents', command.input);
    });
    describeStackEventsStub.sendStub = sendStub;
    return describeStackEventsStub;
  };

  describe('#monitorStack()', () => {
    it('passes credential provider unchanged to the CloudFormation client constructor', async () => {
      const credentials = async () => ({ accessKeyId: 'key', secretAccessKey: 'secret' });
      const clientConfigs = [];
      const commands = [];
      class StubCloudFormationClient {
        constructor(config) {
          clientConfigs.push(config);
        }

        async send(command) {
          commands.push(command);
          return {
            StackEvents: [
              {
                EventId: 'complete',
                StackName: 'stack-id',
                LogicalResourceId: 'stack-id',
                ResourceType: 'AWS::CloudFormation::Stack',
                ResourceStatus: 'CREATE_COMPLETE',
              },
              {
                EventId: 'start',
                StackName: 'stack-id',
                LogicalResourceId: 'stack-id',
                ResourceType: 'AWS::CloudFormation::Stack',
                ResourceStatus: 'CREATE_IN_PROGRESS',
              },
            ],
          };
        }
      }
      const monitorStackWithStub = proxyquire(
        '../../../../../../lib/plugins/aws/lib/monitor-stack',
        {
          '../../../utils/sleep': sinon.stub().resolves(),
          '@aws-sdk/client-cloudformation': {
            CloudFormationClient: StubCloudFormationClient,
            DescribeStackEventsCommand,
          },
        }
      );
      const plugin = {
        provider: {
          getAwsSdkV3Config: sinon.stub().resolves({ region: 'us-west-2', credentials }),
        },
        options: {},
        ...monitorStackWithStub,
      };

      const stackStatus = await plugin.checkStackProgress(
        'create',
        { StackId: 'stack-id' },
        'https://example.test/stack',
        { frequency: 0 },
        {}
      );

      expect(stackStatus).to.equal('CREATE_COMPLETE');
      expect(clientConfigs).to.have.length(1);
      expect(clientConfigs[0].region).to.equal('us-west-2');
      expect(clientConfigs[0].credentials).to.equal(credentials);
      expect(commands).to.have.length(1);
      expect(commands[0]).to.be.instanceOf(DescribeStackEventsCommand);
    });

    it('should skip monitoring if the stack was already created', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();

      return awsPlugin.monitorStack('update', 'alreadyCreated', { frequency: 10 }).then(() => {
        expect(describeStackEventsStub.callCount).to.be.equal(0);
      });
    });

    it('reuses one CloudFormation client across stack monitoring polls', async () => {
      const cloudFormationClients = [];
      let sendCount = 0;
      class FakeDescribeStackEventsCommand {
        constructor(input) {
          this.input = input;
        }
      }
      class FakeCloudFormationClient {
        constructor(config) {
          this.config = config;
          cloudFormationClients.push(this);
        }

        async send(command) {
          expect(command).to.be.instanceOf(FakeDescribeStackEventsCommand);
          expect(command.input).to.deep.equal({ StackName: 'new-service-dev' });
          sendCount += 1;
          if (sendCount === 1) {
            return {
              StackEvents: [
                {
                  EventId: 'start',
                  StackName: 'new-service-dev',
                  LogicalResourceId: 'new-service-dev',
                  ResourceType: 'AWS::CloudFormation::Stack',
                  ResourceStatus: 'CREATE_IN_PROGRESS',
                },
              ],
            };
          }
          return {
            StackEvents: [
              {
                EventId: 'done',
                StackName: 'new-service-dev',
                LogicalResourceId: 'new-service-dev',
                ResourceType: 'AWS::CloudFormation::Stack',
                ResourceStatus: 'CREATE_COMPLETE',
              },
            ],
          };
        }
      }
      const monitorStackWithClientStub = proxyquire(
        '../../../../../../lib/plugins/aws/lib/monitor-stack',
        {
          '../../../utils/sleep': sinon.stub().resolves(),
          '@aws-sdk/client-cloudformation': {
            CloudFormationClient: FakeCloudFormationClient,
            DescribeStackEventsCommand: FakeDescribeStackEventsCommand,
          },
        }
      );
      Object.assign(awsPlugin, monitorStackWithClientStub);

      const stackStatus = await awsPlugin.monitorStack(
        'create',
        { StackId: 'new-service-dev', Changes: [] },
        { frequency: 10 }
      );

      expect(stackStatus).to.equal('CREATE_COMPLETE');
      expect(sendCount).to.equal(2);
      expect(cloudFormationClients).to.have.length(1);
    });

    it('uses an existing CloudFormation client promise from the plugin context', async () => {
      const send = sinon.stub().resolves({
        StackEvents: [
          {
            EventId: 'done',
            StackName: 'stack-id',
            LogicalResourceId: 'stack-id',
            ResourceType: 'AWS::CloudFormation::Stack',
            ResourceStatus: 'CREATE_COMPLETE',
          },
        ],
      });
      const getAwsSdkV3ConfigStub = sinon
        .stub(awsPlugin.provider, 'getAwsSdkV3Config')
        .throws(new Error('Expected existing CloudFormation client to be reused'));
      awsPlugin.cloudFormationClientPromise = Promise.resolve({ send });

      try {
        const stackStatus = await awsPlugin.monitorStack(
          'create',
          { StackId: 'stack-id' },
          { frequency: 10 }
        );

        expect(stackStatus).to.equal('CREATE_COMPLETE');
        expect(getAwsSdkV3ConfigStub).to.not.have.been.called;
        expect(send).to.have.been.calledOnce;
        expect(send.firstCall.args[0]).to.be.instanceOf(DescribeStackEventsCommand);
        expect(send.firstCall.args[0].input).to.deep.equal({ StackName: 'stack-id' });
      } finally {
        getAwsSdkV3ConfigStub.restore();
      }
    });

    it('should keep monitoring until CREATE_COMPLETE stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('CREATE_COMPLETE');
      });
    });

    it('should keep monitoring until UPDATE_COMPLETE stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('UPDATE_COMPLETE');
      });
    });

    it('should keep monitoring until DELETE_COMPLETE stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('DELETE_COMPLETE');
      });
    });

    it('should not stop monitoring on CREATE_COMPLETE nested stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };
      const nestedStackEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4z',
            StackName: 'new-service-dev',
            LogicalResourceId: 'nested-stack-name',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_COMPLETE',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(nestedStackEvent);
      describeStackEventsStub.onCall(2).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('CREATE_COMPLETE');
      });
    });

    it('should not stop monitoring on UPDATE_COMPLETE nested stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const nestedStackEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4z',
            StackName: 'new-service-dev',
            LogicalResourceId: 'nested-stack-name',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_COMPLETE',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(nestedStackEvent);
      describeStackEventsStub.onCall(2).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('UPDATE_COMPLETE');
      });
    });

    it('should not stop monitoring on DELETE_COMPLETE nested stack status', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const nestedStackEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4z',
            StackName: 'new-service-dev',
            LogicalResourceId: 'nested-stack-name',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_COMPLETE',
          },
        ],
      };
      const updateFinishedEvent = {
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
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(nestedStackEvent);
      describeStackEventsStub.onCall(2).resolves(updateFinishedEvent);

      return awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('DELETE_COMPLETE');
      });
    });

    it('should keep monitoring until DELETE_COMPLETE or stack not found catch', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const stackNotFoundError = Object.assign(new Error('Stack new-service-dev does not exist'), {
        name: 'ValidationError',
      });

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).rejects(stackNotFoundError);

      return awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 }).then((stackStatus) => {
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
        expect(stackStatus).to.be.equal('DELETE_COMPLETE');
      });
    });

    it('should preserve first-page-only DescribeStackEvents behavior', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };

      describeStackEventsStub.resolves({
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
        NextToken: 'next-page',
      });

      const stackStatus = await awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 });

      expect(stackStatus).to.equal('CREATE_COMPLETE');
      expect(describeStackEventsStub.sendStub).to.have.been.calledOnce;
      expect(describeStackEventsStub.sendStub.firstCall.args[0].input).to.deep.equal({
        StackName: cfDataMock.StackId,
      });
      expect(describeStackEventsStub).to.have.been.calledOnceWithExactly(
        'CloudFormation',
        'describeStackEvents',
        { StackName: cfDataMock.StackId }
      );
    });

    it('should not treat message-only stack-not-found errors as delete complete', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const stackNotFoundError = new Error('Stack new-service-dev does not exist');

      describeStackEventsStub.rejects(stackNotFoundError);

      await expect(
        awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith('Stack new-service-dev does not exist');
      expect(describeStackEventsStub).to.have.been.calledOnce;
    });

    it('should output all stack events information with the --verbose option', () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const updateFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaS3',
            ResourceType: 'AWS::S3::Bucket',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Bucket already exists',
          },
        ],
      };
      const updateRollbackEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_IN_PROGRESS',
          },
        ],
      };
      const updateRollbackComplete = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'ROLLBACK_COMPLETE',
          },
        ],
      };
      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateFailedEvent);
      describeStackEventsStub.onCall(2).resolves(updateRollbackEvent);
      describeStackEventsStub.onCall(3).resolves(updateRollbackComplete);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).catch((e) => {
        let errorMessage = 'An error occurred: ';
        errorMessage += 'mochaS3 - Bucket already exists.';
        if (e.name !== 'ServerlessError') throw e;
        expect(e.name).to.be.equal('ServerlessError');
        expect(e.message).to.be.equal(errorMessage);
        expect(describeStackEventsStub.callCount).to.be.equal(4);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });

    it('should exit on failure with --verbose when stack status is CREATE_FAILED', async () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const createStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };
      const resourceFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaLambda',
            ResourceType: 'AWS::Lambda::Function',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Resource creation cancelled',
          },
        ],
      };
      const stackCreateFailedEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(createStartEvent);
      describeStackEventsStub.onCall(1).resolves(resourceFailedEvent);
      describeStackEventsStub.onCall(2).resolves(stackCreateFailedEvent);

      await expect(
        awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith(
        'An error occurred: mochaLambda - Resource creation cancelled.'
      );
      expect(describeStackEventsStub.callCount).to.be.equal(3);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it('should exit on failure with --verbose when stack status is UPDATE_FAILED', async () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const resourceFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaApiGw',
            ResourceType: 'AWS::ApiGateway::Deployment',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Invalid stage identifier specified',
          },
        ],
      };
      const stackUpdateFailedEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(resourceFailedEvent);
      describeStackEventsStub.onCall(2).resolves(stackUpdateFailedEvent);

      await expect(
        awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith(
        'An error occurred: mochaApiGw - Invalid stage identifier specified.'
      );
      expect(describeStackEventsStub.callCount).to.be.equal(3);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it('should exit on failure with --verbose when stack status is ROLLBACK_FAILED', async () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const createStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };
      const resourceFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaLambda',
            ResourceType: 'AWS::Lambda::Function',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Resource creation cancelled',
          },
        ],
      };
      const rollbackInProgressEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'ROLLBACK_IN_PROGRESS',
          },
        ],
      };
      const rollbackFailedEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'ROLLBACK_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(createStartEvent);
      describeStackEventsStub.onCall(1).resolves(resourceFailedEvent);
      describeStackEventsStub.onCall(2).resolves(rollbackInProgressEvent);
      describeStackEventsStub.onCall(3).resolves(rollbackFailedEvent);

      await expect(
        awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith(
        'An error occurred: mochaLambda - Resource creation cancelled.'
      );
      expect(describeStackEventsStub.callCount).to.be.equal(4);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it('should exit on failure with --verbose when stack status is UPDATE_ROLLBACK_FAILED', async () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const resourceFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaApiGw',
            ResourceType: 'AWS::ApiGateway::Deployment',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Invalid stage identifier specified',
          },
        ],
      };
      const updateRollbackInProgressEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_IN_PROGRESS',
          },
        ],
      };
      const updateRollbackFailedEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(resourceFailedEvent);
      describeStackEventsStub.onCall(2).resolves(updateRollbackInProgressEvent);
      describeStackEventsStub.onCall(3).resolves(updateRollbackFailedEvent);

      await expect(
        awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith(
        'An error occurred: mochaApiGw - Invalid stage identifier specified.'
      );
      expect(describeStackEventsStub.callCount).to.be.equal(4);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it('should keep monitoring when 1st ResourceType is not "AWS::CloudFormation::Stack"', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const firstNoStackResourceTypeEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'somebucket',
            ResourceType: 'AWS::S3::Bucket',
            Timestamp: new Date(),
          },
        ],
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const updateComplete = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_COMPLETE',
          },
        ],
      };
      describeStackEventsStub.onCall(0).resolves(firstNoStackResourceTypeEvent);
      describeStackEventsStub.onCall(1).resolves(updateStartEvent);
      describeStackEventsStub.onCall(2).resolves(updateComplete);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).then(() => {
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });

    it('should catch describeStackEvents error if stack was not in deleting state', () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const failedDescribeStackEvents = {
        message: 'Something went wrong.',
      };

      describeStackEventsStub.onCall(0).rejects(failedDescribeStackEvents);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).catch((e) => {
        expect(e.message).to.be.equal('Something went wrong.');
        expect(describeStackEventsStub.callCount).to.be.equal(1);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });

    it('should throw an error and exit immediately if stack status is *_FAILED', () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const updateFailedEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            LogicalResourceId: 'mochaS3',
            ResourceType: 'S3::Bucket',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Bucket already exists',
          },
        ],
      };
      const updateRollbackEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_IN_PROGRESS',
          },
        ],
      };
      const updateRollbackFailedEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateFailedEvent);
      describeStackEventsStub.onCall(2).resolves(updateRollbackEvent);
      describeStackEventsStub.onCall(3).resolves(updateRollbackFailedEvent);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).catch((e) => {
        let errorMessage = 'An error occurred: ';
        errorMessage += 'mochaS3 - Bucket already exists.';
        expect(e.name).to.be.equal('ServerlessError');
        expect(e.message).to.be.equal(errorMessage);
        // callCount is 2 because osls immediately exits and shows the error
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });

    it('should throw an error and exit immediately if stack status is DELETE_FAILED', () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const deleteStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const deleteItemEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaLambda',
            ResourceType: 'AWS::Lambda::Function',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const deleteItemFailedEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'mochaLambda',
            ResourceType: 'AWS::Lambda::Function',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_FAILED',
            ResourceStatusReason: 'You are not authorized to perform this operation',
          },
        ],
      };
      const deleteFailedEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_FAILED',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(deleteStartEvent);
      describeStackEventsStub.onCall(1).resolves(deleteItemEvent);
      describeStackEventsStub.onCall(2).resolves(deleteItemFailedEvent);
      describeStackEventsStub.onCall(3).resolves(deleteFailedEvent);

      return awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 }).catch((e) => {
        let errorMessage = 'An error occurred: ';
        errorMessage += 'mochaLambda - You are not authorized to perform this operation.';
        expect(e.name).to.be.equal('ServerlessError');
        expect(e.message).to.be.equal(errorMessage);
        // callCount is 2 because osls immediately exits and shows the error
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });

    it(
      'should throw an error if stack status is DELETE_FAILED and should output all ' +
        'stack events information with the --verbose option',
      () => {
        awsPlugin.options.verbose = true;
        const describeStackEventsStub = stubDescribeStackEvents();
        const cfDataMock = {
          StackId: 'new-service-dev',
        };
        const deleteStartEvent = {
          StackEvents: [
            {
              EventId: '1a2b3c4d',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_IN_PROGRESS',
            },
          ],
        };
        const deleteItemEvent = {
          StackEvents: [
            {
              EventId: '1e2f3g4h',
              StackName: 'new-service-dev',
              LogicalResourceId: 'mochaLambda',
              ResourceType: 'AWS::Lambda::Function',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_IN_PROGRESS',
            },
          ],
        };
        const deleteItemFailedEvent = {
          StackEvents: [
            {
              EventId: '1i2j3k4l',
              StackName: 'new-service-dev',
              LogicalResourceId: 'mochaLambda',
              ResourceType: 'AWS::Lambda::Function',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_FAILED',
              ResourceStatusReason: 'You are not authorized to perform this operation',
            },
          ],
        };
        const deleteFailedEvent = {
          StackEvents: [
            {
              EventId: '1m2n3o4p',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_FAILED',
            },
          ],
        };

        describeStackEventsStub.onCall(0).resolves(deleteStartEvent);
        describeStackEventsStub.onCall(1).resolves(deleteItemEvent);
        describeStackEventsStub.onCall(2).resolves(deleteItemFailedEvent);
        describeStackEventsStub.onCall(3).resolves(deleteFailedEvent);

        return awsPlugin.monitorStack('delete', cfDataMock, { frequency: 10 }).catch((e) => {
          let errorMessage = 'An error occurred: ';
          errorMessage += 'mochaLambda - You are not authorized to perform this operation.';
          expect(e.name).to.be.equal('ServerlessError');
          expect(e.message).to.be.equal(errorMessage);
          // callCount is 2 because osls immediately exits and shows the error
          expect(describeStackEventsStub.callCount).to.be.equal(4);
          expect(
            describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
              StackName: cfDataMock.StackId,
            })
          ).to.be.equal(true);
        });
      }
    );

    it(
      'should throw an error if stack status is DELETE_COMPLETE and should output all ' +
        'stack events information with the --verbose option',
      async () => {
        awsPlugin.options.verbose = true;
        const describeStackEventsStub = stubDescribeStackEvents();
        const cfDataMock = {
          StackId: 'new-service-dev',
        };
        const createStartEvent = {
          StackEvents: [
            {
              EventId: '1a2b3c4d',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'CREATE_IN_PROGRESS',
            },
          ],
        };
        const createItemFailedEvent = {
          StackEvents: [
            {
              EventId: '1m2n3o4p',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_COMPLETE',
            },
            {
              EventId: '1i2j3k4l',
              StackName: 'new-service-dev',
              LogicalResourceId: 'myBucket',
              ResourceType: 'AWS::S3::Bucket',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_IN_PROGRESS',
            },
            {
              EventId: '1a2b3c4e',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_IN_PROGRESS',
            },

            {
              EventId: '1e2f3g4h',
              StackName: 'new-service-dev',
              LogicalResourceId: 'myBucket',
              ResourceType: 'AWS::S3::Bucket',
              Timestamp: new Date(),
              ResourceStatus: 'CREATE_FAILED',
              ResourceStatusReason: 'Invalid Property for X',
            },
          ],
        };

        describeStackEventsStub.onCall(0).resolves(createStartEvent);
        describeStackEventsStub.onCall(1).resolves(createItemFailedEvent);

        await expect(
          awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
        ).to.eventually.be.rejectedWith('myBucket - Invalid Property for X.');
      }
    );

    it('should report root DELETE_IN_PROGRESS as a create failure', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const createStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };
      const deleteInProgressEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
            ResourceStatusReason: 'No export named missing-export found. Delete requested by user',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(createStartEvent);
      describeStackEventsStub.onCall(1).resolves(deleteInProgressEvent);

      await expect(
        awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith(
        'An error occurred: new-service-dev - No export named missing-export found. Delete requested by user.'
      );
      expect(describeStackEventsStub.callCount).to.be.equal(2);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it(
      'should report root DELETE_IN_PROGRESS as a create failure with the ' +
        '--verbose option after cleanup',
      async () => {
        awsPlugin.options.verbose = true;
        const describeStackEventsStub = stubDescribeStackEvents();
        const cfDataMock = {
          StackId: 'new-service-dev',
        };
        const createStartEvent = {
          StackEvents: [
            {
              EventId: '1a2b3c4d',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'CREATE_IN_PROGRESS',
            },
          ],
        };
        const deleteInProgressEvent = {
          StackEvents: [
            {
              EventId: '1e2f3g4h',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_IN_PROGRESS',
              ResourceStatusReason:
                'No export named missing-export found. Delete requested by user',
            },
          ],
        };
        const deleteCompleteEvent = {
          StackEvents: [
            {
              EventId: '1i2j3k4l',
              StackName: 'new-service-dev',
              LogicalResourceId: 'new-service-dev',
              ResourceType: 'AWS::CloudFormation::Stack',
              Timestamp: new Date(),
              ResourceStatus: 'DELETE_COMPLETE',
            },
          ],
        };

        describeStackEventsStub.onCall(0).resolves(createStartEvent);
        describeStackEventsStub.onCall(1).resolves(deleteInProgressEvent);
        describeStackEventsStub.onCall(2).resolves(deleteCompleteEvent);

        await expect(
          awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
        ).to.eventually.be.rejectedWith(
          'An error occurred: new-service-dev - No export named missing-export found. Delete requested by user.'
        );
        expect(describeStackEventsStub.callCount).to.be.equal(3);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      }
    );

    it('should not report nested stack DELETE_IN_PROGRESS during update as a root stack failure', async () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const nestedStackDeleteEvent = {
        StackEvents: [
          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'nested-stack-name',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
        ],
      };
      const updateCompleteEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_COMPLETE',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(nestedStackDeleteEvent);
      describeStackEventsStub.onCall(2).resolves(updateCompleteEvent);

      const stackStatus = await awsPlugin.monitorStack('update', cfDataMock, {
        frequency: 10,
      });
      expect(stackStatus).to.be.equal('UPDATE_COMPLETE');
      expect(describeStackEventsStub.callCount).to.be.equal(3);
      expect(
        describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
          StackName: cfDataMock.StackId,
        })
      ).to.be.equal(true);
    });

    it('should resolve properly first stack event (when CREATE fails and is followed with DELETE)', async () => {
      awsPlugin.options.verbose = true;
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const createStartEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_COMPLETE',
          },
          {
            EventId: '1i2j3k4l',
            StackName: 'new-service-dev',
            LogicalResourceId: 'myBucket',
            ResourceType: 'AWS::S3::Bucket',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },
          {
            EventId: '1a2b3c4e',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'DELETE_IN_PROGRESS',
          },

          {
            EventId: '1e2f3g4h',
            StackName: 'new-service-dev',
            LogicalResourceId: 'myBucket',
            ResourceType: 'AWS::S3::Bucket',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Invalid Property for X',
          },
          {
            EventId: '1a2b3c4d',
            StackName: 'new-service-dev',
            LogicalResourceId: 'new-service-dev',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'CREATE_IN_PROGRESS',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(createStartEvent);

      await expect(
        awsPlugin.monitorStack('create', cfDataMock, { frequency: 10 })
      ).to.eventually.be.rejectedWith('myBucket - Invalid Property for X.');
    });

    it('should record an error and fail if status is UPDATE_ROLLBACK_IN_PROGRESS', () => {
      const describeStackEventsStub = stubDescribeStackEvents();
      const cfDataMock = {
        StackId: 'new-service-dev',
      };
      const updateStartEvent = {
        StackEvents: [
          {
            EventId: '1a2b3c4d',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_IN_PROGRESS',
          },
        ],
      };
      const updateRollbackEvent = {
        StackEvents: [
          {
            EventId: '1i2j3k4l',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_IN_PROGRESS',
          },
        ],
      };
      const updateRollbackCompleteEvent = {
        StackEvents: [
          {
            EventId: '1m2n3o4p',
            LogicalResourceId: 'mocha',
            ResourceType: 'AWS::CloudFormation::Stack',
            Timestamp: new Date(),
            ResourceStatus: 'UPDATE_ROLLBACK_COMPLETE',
          },
        ],
      };

      describeStackEventsStub.onCall(0).resolves(updateStartEvent);
      describeStackEventsStub.onCall(1).resolves(updateRollbackEvent);
      describeStackEventsStub.onCall(2).resolves(updateRollbackCompleteEvent);

      return awsPlugin.monitorStack('update', cfDataMock, { frequency: 10 }).catch((e) => {
        let errorMessage = 'An error occurred: ';
        errorMessage += 'mocha - UPDATE_ROLLBACK_IN_PROGRESS.';
        expect(e.name).to.be.equal('ServerlessError');
        expect(e.message).to.be.equal(errorMessage);
        // callCount is 2 because osls immediately exits and shows the error
        expect(describeStackEventsStub.callCount).to.be.equal(2);
        expect(
          describeStackEventsStub.calledWithExactly('CloudFormation', 'describeStackEvents', {
            StackName: cfDataMock.StackId,
          })
        ).to.be.equal(true);
      });
    });
  });
});
