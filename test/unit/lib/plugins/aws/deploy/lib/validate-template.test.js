'use strict';

const sinon = require('sinon');
const AwsProvider = require('../../../../../../../lib/plugins/aws/provider');
const AwsDeploy = require('../../../../../../../lib/plugins/aws/deploy/index');
const Serverless = require('../../../../../../../lib/serverless');
const { CloudFormationClient, ValidateTemplateCommand } = require('@aws-sdk/client-cloudformation');

// Configure chai
const expect = require('chai').expect;

describe('validateTemplate', () => {
  let awsDeploy;
  let serverless;
  let validateTemplateStub;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless({ commands: [], options: {} });
    serverless.serviceDir = 'foo';
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    awsDeploy = new AwsDeploy(serverless, options);
    awsDeploy.bucketName = 'deployment-bucket';
    awsDeploy.serverless.service.package.artifactDirectoryName = 'somedir';
    awsDeploy.serverless.service.functions = {
      first: {
        handler: 'foo',
      },
    };
    validateTemplateStub = sinon.stub(CloudFormationClient.prototype, 'send');
  });

  afterEach(() => {
    CloudFormationClient.prototype.send.restore();
  });

  describe('#validateTemplate()', () => {
    it('should resolve if the CloudFormation template is valid', async () => {
      validateTemplateStub.resolves();

      await awsDeploy.validateTemplate();
      expect(validateTemplateStub).to.have.been.calledOnce;
      expect(validateTemplateStub.firstCall.args[0]).to.be.instanceOf(ValidateTemplateCommand);
      expect(validateTemplateStub.firstCall.args[0].input).to.deep.equal({
        TemplateURL:
          'https://s3.amazonaws.com/deployment-bucket/somedir/compiled-cloudformation-template.json',
      });
    });

    it('uses an existing CloudFormation client promise from the plugin context', async () => {
      const send = sinon.stub().resolves();
      sinon
        .stub(awsDeploy.provider, 'getAwsSdkV3Config')
        .throws(new Error('Expected existing CloudFormation client to be reused'));
      awsDeploy.cloudFormationClientPromise = Promise.resolve({ send });

      try {
        await awsDeploy.validateTemplate();

        expect(awsDeploy.provider.getAwsSdkV3Config).to.not.have.been.called;
        expect(send).to.have.been.calledOnce;
        expect(send.firstCall.args[0]).to.be.instanceOf(ValidateTemplateCommand);
        expect(send.firstCall.args[0].input).to.deep.equal({
          TemplateURL:
            'https://s3.amazonaws.com/deployment-bucket/somedir/compiled-cloudformation-template.json',
        });
      } finally {
        awsDeploy.provider.getAwsSdkV3Config.restore();
      }
    });

    it('should throw an error if the CloudFormation template is invalid', async () => {
      validateTemplateStub.rejects({ message: 'Some error while validating' });

      return expect(awsDeploy.validateTemplate()).to.be.rejected.then((error) => {
        expect(validateTemplateStub).to.have.been.calledOnce;
        expect(validateTemplateStub.firstCall.args[0]).to.be.instanceOf(ValidateTemplateCommand);
        expect(validateTemplateStub.firstCall.args[0].input).to.deep.equal({
          TemplateURL:
            'https://s3.amazonaws.com/deployment-bucket/somedir/compiled-cloudformation-template.json',
        });
        expect(error.message).to.match(/is invalid: Some error while validating/);
      });
    });
  });
});
