'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const {
  LambdaClient,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
} = require('@aws-sdk/client-lambda');
const ServerlessError = require('../../../../../lib/serverless-error');
const Serverless = require('../../../../../lib/serverless');
const AwsProvider = require('../../../../../lib/plugins/aws/provider');
const CLI = require('../../../../../lib/classes/cli');
const AwsRollbackFunction = require('../../../../../lib/plugins/aws/rollback-function.js');
const configureAwsSdkV3Stub = require('../../../../lib/configure-aws-sdk-v3-stub');

describe('AwsRollbackFunction', () => {
  let serverless;
  let awsRollbackFunction;
  let fetchStub;
  let originalFetch;

  beforeEach(() => {
    fetchStub = sinon.stub().resolves({ arrayBuffer: async () => new ArrayBuffer(0) });
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchStub;
    serverless = new Serverless({ commands: [], options: {} });
    serverless.service.functions = {
      hello: {
        handler: true,
        name: 'service-dev-hello',
      },
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'hello',
    };
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    serverless.cli = new CLI(serverless);
    awsRollbackFunction = new AwsRollbackFunction(serverless, options);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('#constructor()', () => {
    let validateStub;
    let getFunctionToBeRestoredStub;
    let fetchFunctionCodeStub;
    let restoreFunctionStub;

    beforeEach(() => {
      const func = { Code: { Location: 'https://example.test/function.zip' } };
      const zipBuffer = Buffer.from('zip');
      const restoreResult = { restored: true };

      validateStub = sinon.stub(awsRollbackFunction, 'validate').resolves();
      getFunctionToBeRestoredStub = sinon
        .stub(awsRollbackFunction, 'getFunctionToBeRestored')
        .resolves(func);
      fetchFunctionCodeStub = sinon
        .stub(awsRollbackFunction, 'fetchFunctionCode')
        .withArgs(func)
        .resolves(zipBuffer);
      restoreFunctionStub = sinon
        .stub(awsRollbackFunction, 'restoreFunction')
        .withArgs(zipBuffer)
        .resolves(restoreResult);
    });

    afterEach(() => {
      awsRollbackFunction.validate.restore();
      awsRollbackFunction.getFunctionToBeRestored.restore();
      awsRollbackFunction.fetchFunctionCode.restore();
      awsRollbackFunction.restoreFunction.restore();
    });

    it('should have hooks', () => expect(awsRollbackFunction.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(awsRollbackFunction.provider).to.be.instanceof(AwsProvider));

    it('should set an empty options object if no options are given', () => {
      const awsRollbackFunctionWithEmptyOptions = new AwsRollbackFunction(serverless);
      expect(awsRollbackFunctionWithEmptyOptions.options).to.deep.equal({});
    });

    it('should run promise chain in order and pass resolved values forward', async () =>
      awsRollbackFunction.hooks['rollback:function:rollback']().then((result) => {
        expect(result).to.deep.equal({ restored: true });
        expect(validateStub.calledOnce).to.equal(true);
        expect(getFunctionToBeRestoredStub.calledAfter(validateStub)).to.equal(true);
        expect(fetchFunctionCodeStub.calledAfter(getFunctionToBeRestoredStub)).to.equal(true);
        expect(restoreFunctionStub.calledAfter(fetchFunctionCodeStub)).to.equal(true);
        expect(fetchFunctionCodeStub.calledOnce).to.equal(true);
        expect(restoreFunctionStub.calledOnce).to.equal(true);
      }));
  });

  describe('#getFunctionToBeRestored()', () => {
    describe('when function and version can be found', () => {
      let getFunctionStub;

      beforeEach(() => {
        getFunctionStub = sinon
          .stub(LambdaClient.prototype, 'send')
          .resolves({ function: 'hello' });
      });

      afterEach(() => {
        LambdaClient.prototype.send.restore();
      });

      it('should return the requested function', async () => {
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        return awsRollbackFunction.getFunctionToBeRestored().then((result) => {
          expect(getFunctionStub.calledOnce).to.equal(true);
          expect(getFunctionStub.firstCall.args[0]).to.be.instanceOf(GetFunctionCommand);
          expect(getFunctionStub.firstCall.args[0].input).to.deep.equal({
            FunctionName: 'service-dev-hello',
            Qualifier: '4711',
          });
          expect(result).to.deep.equal({ function: 'hello' });
        });
      });

      it('should pass credential provider unchanged to the SDK v3 Lambda client', async () => {
        const awsSdkV3Stub = configureAwsSdkV3Stub({
          Lambda: {
            getFunction: { function: 'hello' },
          },
        });
        const ProxyquiredAwsRollbackFunction = proxyquire(
          '../../../../../lib/plugins/aws/rollback-function.js',
          awsSdkV3Stub.modulesCacheStub
        );
        const rollbackFunction = new ProxyquiredAwsRollbackFunction(serverless, {
          'stage': 'dev',
          'region': 'us-east-1',
          'function': 'hello',
          'function-version': '4711',
        });

        await expect(rollbackFunction.getFunctionToBeRestored()).to.eventually.deep.equal({
          function: 'hello',
        });

        expect(awsSdkV3Stub.sends).to.have.length(1);
        expect(awsSdkV3Stub.sends[0].input).to.deep.equal({
          FunctionName: 'service-dev-hello',
          Qualifier: '4711',
        });
        expect(awsSdkV3Stub.sends[0].clientConfig.credentials).to.equal(
          rollbackFunction.provider.getAwsSdkV3CredentialsProvider()
        );
      });
    });

    describe('when function or version could not be found', () => {
      let getFunctionStub;

      beforeEach(() => {
        getFunctionStub = sinon.stub(LambdaClient.prototype, 'send').rejects(
          Object.assign(new Error('function hello not found'), {
            name: 'ResourceNotFoundException',
          })
        );
      });

      afterEach(() => {
        LambdaClient.prototype.send.restore();
      });

      it('should translate the error message to a custom error message', () => {
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        return awsRollbackFunction.getFunctionToBeRestored().catch((error) => {
          expect(error.message.match(/Function "hello" with version "4711" not found/));
          expect(error.code).to.equal('AWS_FUNCTION_NOT_FOUND');
          expect(getFunctionStub.calledOnce).to.equal(true);
          expect(getFunctionStub.firstCall.args[0]).to.be.instanceOf(GetFunctionCommand);
          expect(getFunctionStub.firstCall.args[0].input).to.deep.equal({
            FunctionName: 'service-dev-hello',
            Qualifier: '4711',
          });
        });
      });
    });

    describe('when other error occurred', () => {
      let getFunctionStub;

      beforeEach(() => {
        getFunctionStub = sinon
          .stub(LambdaClient.prototype, 'send')
          .rejects(new Error('something went wrong'));
      });

      afterEach(() => {
        LambdaClient.prototype.send.restore();
      });

      it('should re-throw the error without translating it to a custom error message', () => {
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        return awsRollbackFunction.getFunctionToBeRestored().catch((error) => {
          expect(error.message.match(/something went wrong/));
          expect(error.code).to.equal('AWS_FUNCTION_NOT_ACCESSIBLE');
          expect(getFunctionStub.calledOnce).to.equal(true);
          expect(getFunctionStub.firstCall.args[0]).to.be.instanceOf(GetFunctionCommand);
          expect(getFunctionStub.firstCall.args[0].input).to.deep.equal({
            FunctionName: 'service-dev-hello',
            Qualifier: '4711',
          });
        });
      });

      it('should not classify message-only not found errors as missing functions', async () => {
        getFunctionStub.rejects(new Error('function hello not found'));
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        await expect(
          awsRollbackFunction.getFunctionToBeRestored()
        ).to.eventually.be.rejected.and.have.property('code', 'AWS_FUNCTION_NOT_ACCESSIBLE');
      });

      it('should preserve credential provider errors', async () => {
        const credentialsError = new ServerlessError(
          'AWS provider credentials not found.',
          'AWS_CREDENTIALS_NOT_FOUND'
        );
        getFunctionStub.rejects(credentialsError);
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        try {
          await awsRollbackFunction.getFunctionToBeRestored();
        } catch (error) {
          expect(error).to.equal(credentialsError);
          return;
        }

        throw new Error('Expected getFunctionToBeRestored to reject');
      });

      it('should preserve specific SDK v3 credential provider errors', async () => {
        const credentialsError = Object.assign(new Error('The SSO session has expired'), {
          name: 'CredentialsProviderError',
        });
        getFunctionStub.rejects(credentialsError);
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        try {
          await awsRollbackFunction.getFunctionToBeRestored();
        } catch (error) {
          expect(error).to.equal(credentialsError);
          return;
        }

        throw new Error('Expected getFunctionToBeRestored to reject');
      });

      it('should not preserve inherited credential provider error fields', async () => {
        const inheritedCredentialsError = Object.create({
          code: 'AWS_CREDENTIALS_NOT_FOUND',
          name: 'CredentialsProviderError',
          message: 'fake credential provider error',
        });
        getFunctionStub.rejects(inheritedCredentialsError);
        awsRollbackFunction.options.function = 'hello';
        awsRollbackFunction.options['function-version'] = '4711';

        try {
          await awsRollbackFunction.getFunctionToBeRestored();
        } catch (error) {
          expect(error).to.not.equal(inheritedCredentialsError);
          expect(error).to.be.instanceOf(ServerlessError);
          expect(error.code).to.equal('AWS_FUNCTION_NOT_ACCESSIBLE');
          expect(error.message).to.not.include('fake credential provider error');
          return;
        }

        throw new Error('Expected getFunctionToBeRestored to reject');
      });
    });
  });

  describe('#fetchFunctionCode()', () => {
    it('should fetch the zip file content of the previously requested function', async () => {
      const body = Uint8Array.from([1, 2, 3]);
      fetchStub.resolves({ arrayBuffer: async () => body.buffer });
      const func = {
        Code: {
          Location: 'https://foo.com/bar',
        },
      };

      const result = await awsRollbackFunction.fetchFunctionCode(func);

      expect(fetchStub.calledOnceWithExactly('https://foo.com/bar')).to.equal(true);
      expect(Buffer.isBuffer(result)).to.equal(true);
      expect(result).to.deep.equal(Buffer.from([1, 2, 3]));
    });
  });

  describe('#restoreFunction()', () => {
    let updateFunctionCodeStub;

    beforeEach(() => {
      updateFunctionCodeStub = sinon.stub(LambdaClient.prototype, 'send').resolves();
    });

    afterEach(() => {
      LambdaClient.prototype.send.restore();
    });

    it('should restore the provided function', async () => {
      awsRollbackFunction.options.function = 'hello';
      const zipBuffer = Buffer.from('');

      return awsRollbackFunction.restoreFunction(zipBuffer).then(() => {
        expect(updateFunctionCodeStub.calledOnce).to.equal(true);
        expect(updateFunctionCodeStub.firstCall.args[0]).to.be.instanceOf(
          UpdateFunctionCodeCommand
        );
        expect(updateFunctionCodeStub.firstCall.args[0].input).to.deep.equal({
          FunctionName: 'service-dev-hello',
          ZipFile: zipBuffer,
        });
      });
    });

    it('should pass credential provider unchanged when restoring function code', async () => {
      const awsSdkV3Stub = configureAwsSdkV3Stub({
        Lambda: {
          updateFunctionCode: {},
        },
      });
      const ProxyquiredAwsRollbackFunction = proxyquire(
        '../../../../../lib/plugins/aws/rollback-function.js',
        awsSdkV3Stub.modulesCacheStub
      );
      const rollbackFunction = new ProxyquiredAwsRollbackFunction(serverless, {
        stage: 'dev',
        region: 'us-east-1',
        function: 'hello',
      });
      const zipBuffer = Buffer.from('zip');

      await rollbackFunction.restoreFunction(zipBuffer);

      expect(awsSdkV3Stub.sends).to.have.length(1);
      expect(awsSdkV3Stub.sends[0].input).to.deep.equal({
        FunctionName: 'service-dev-hello',
        ZipFile: zipBuffer,
      });
      expect(awsSdkV3Stub.sends[0].clientConfig.credentials).to.equal(
        rollbackFunction.provider.getAwsSdkV3CredentialsProvider()
      );
    });
  });

  describe('client reuse', () => {
    it('uses an existing Lambda client promise across function lookup and restore', async () => {
      awsRollbackFunction.options.function = 'hello';
      awsRollbackFunction.options['function-version'] = '4711';
      const zipBuffer = Buffer.from('zip');
      const send = sinon.stub().callsFake(async (command) => {
        if (command instanceof GetFunctionCommand) return { function: 'hello' };
        if (command instanceof UpdateFunctionCodeCommand) return {};
        throw new Error(`Unexpected Lambda command ${command.constructor.name}`);
      });
      const getAwsSdkV3ConfigStub = sinon
        .stub(awsRollbackFunction.provider, 'getAwsSdkV3Config')
        .throws(new Error('Expected existing Lambda client to be reused'));
      awsRollbackFunction.lambdaClientPromise = Promise.resolve({ send });

      try {
        await expect(awsRollbackFunction.getFunctionToBeRestored()).to.eventually.deep.equal({
          function: 'hello',
        });
        await awsRollbackFunction.restoreFunction(zipBuffer);

        expect(getAwsSdkV3ConfigStub).to.not.have.been.called;
        expect(send).to.have.been.calledTwice;
        expect(send.firstCall.args[0]).to.be.instanceOf(GetFunctionCommand);
        expect(send.firstCall.args[0].input).to.deep.equal({
          FunctionName: 'service-dev-hello',
          Qualifier: '4711',
        });
        expect(send.secondCall.args[0]).to.be.instanceOf(UpdateFunctionCodeCommand);
        expect(send.secondCall.args[0].input).to.deep.equal({
          FunctionName: 'service-dev-hello',
          ZipFile: zipBuffer,
        });
      } finally {
        getAwsSdkV3ConfigStub.restore();
      }
    });
  });
});
