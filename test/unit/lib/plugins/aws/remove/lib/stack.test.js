'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const AwsProvider = require('../../../../../../../lib/plugins/aws/provider');
const AwsRemove = require('../../../../../../../lib/plugins/aws/remove/index');
const Serverless = require('../../../../../../../lib/serverless');
const { CloudFormationClient, DeleteStackCommand } = require('@aws-sdk/client-cloudformation');

describe('removeStack', () => {
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  const serverless = new Serverless({ commands: [], options: {} });
  serverless.service.service = 'removeStack';
  serverless.setProvider('aws', new AwsProvider(serverless, options));

  let awsRemove;
  let removeStackStub;

  beforeEach(() => {
    awsRemove = new AwsRemove(serverless, options);
    awsRemove.serverless.cli = new serverless.classes.CLI();
    removeStackStub = sinon.stub(CloudFormationClient.prototype, 'send').resolves();
  });

  afterEach(() => {
    CloudFormationClient.prototype.send.restore();
  });

  describe('#remove()', () => {
    it('should remove a stack', async () =>
      awsRemove.remove().then((result) => {
        const stackName = `${serverless.service.service}-${awsRemove.provider.getStage()}`;

        expect(result).to.deep.equal({ StackId: stackName });
        expect(removeStackStub.calledOnce).to.be.equal(true);
        expect(removeStackStub.firstCall.args[0]).to.be.instanceOf(DeleteStackCommand);
        expect(removeStackStub.firstCall.args[0].input).to.deep.equal({ StackName: stackName });
      }));

    it('uses an existing CloudFormation client promise from the plugin context', async () => {
      const send = sinon.stub().resolves();
      sinon
        .stub(awsRemove.provider, 'getAwsSdkV3Config')
        .throws(new Error('Expected existing CloudFormation client to be reused'));
      awsRemove.cloudFormationClientPromise = Promise.resolve({ send });

      try {
        const result = await awsRemove.remove();
        const stackName = `${serverless.service.service}-${awsRemove.provider.getStage()}`;

        expect(result).to.deep.equal({ StackId: stackName });
        expect(awsRemove.provider.getAwsSdkV3Config).to.not.have.been.called;
        expect(send).to.have.been.calledOnce;
        expect(send.firstCall.args[0]).to.be.instanceOf(DeleteStackCommand);
        expect(send.firstCall.args[0].input).to.deep.equal({ StackName: stackName });
      } finally {
        awsRemove.provider.getAwsSdkV3Config.restore();
      }
    });

    it('should use CloudFormation service role if it is specified', async () => {
      awsRemove.serverless.service.provider.iam = {
        deploymentRole: 'arn:aws:iam::123456789012:role/myrole',
      };

      return awsRemove.remove().then(() => {
        expect(removeStackStub.firstCall.args[0]).to.be.instanceOf(DeleteStackCommand);
        expect(removeStackStub.firstCall.args[0].input.RoleARN).to.equal(
          'arn:aws:iam::123456789012:role/myrole'
        );
      });
    });
  });

  describe('#removeStack()', () => {
    it('should run promise chain in order', async () => {
      const removeStub = sinon.stub(awsRemove, 'remove').resolves();

      return awsRemove.removeStack().then(() => {
        expect(removeStub.calledOnce).to.be.equal(true);
        awsRemove.remove.restore();
      });
    });
  });
});
