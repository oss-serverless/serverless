'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { ECRClient, DescribeRepositoriesCommand } = require('@aws-sdk/client-ecr');

describe('test/unit/lib/plugins/aws/lib/check-if-ecr-repository-exists.test.js', () => {
  let context;
  let describeRepositoriesStub;
  let warningStub;

  beforeEach(() => {
    warningStub = sinon.stub();
    const checkIfEcrRepositoryExists = proxyquire
      .noCallThru()
      .load('../../../../../../lib/plugins/aws/lib/check-if-ecr-repository-exists', {
        '../../../utils/serverless-utils/log': { log: { warning: warningStub } },
      });
    context = {
      provider: {
        getAccountId: sinon.stub().resolves('123456789012'),
        getAwsSdkV3Config: sinon
          .stub()
          .resolves({ region: 'us-east-1', credentials: sinon.stub() }),
        naming: {
          getEcrRepositoryName: sinon.stub().returns('repository'),
        },
      },
      serverless: {
        service: {
          provider: {},
        },
      },
      ...checkIfEcrRepositoryExists,
    };
    describeRepositoriesStub = sinon.stub(ECRClient.prototype, 'send');
  });

  afterEach(() => {
    ECRClient.prototype.send.restore();
  });

  it('returns true when repository exists', async () => {
    describeRepositoriesStub.resolves({ repositories: [{ repositoryName: 'repository' }] });

    await expect(context.checkIfEcrRepositoryExists()).to.eventually.equal(true);

    expect(context.provider.getAccountId).to.have.been.calledOnce;
    expect(describeRepositoriesStub.firstCall.args[0]).to.be.instanceOf(
      DescribeRepositoriesCommand
    );
    expect(describeRepositoriesStub.firstCall.args[0].input).to.deep.equal({
      repositoryNames: ['repository'],
      registryId: '123456789012',
    });
  });

  for (const error of [
    { providerError: { code: 'RepositoryNotFoundException' } },
    { name: 'RepositoryNotFoundException' },
  ]) {
    it(`returns false for missing repository shape ${JSON.stringify(error)}`, async () => {
      describeRepositoriesStub.rejects(error);

      await expect(context.checkIfEcrRepositoryExists()).to.eventually.equal(false);
    });
  }

  for (const error of [
    { providerError: { code: 'AccessDeniedException' } },
    { name: 'AccessDeniedException' },
  ]) {
    it(`returns false for access denied shape ${JSON.stringify(error)}`, async () => {
      describeRepositoriesStub.rejects(error);

      await expect(context.checkIfEcrRepositoryExists()).to.eventually.equal(false);
      expect(warningStub).to.not.have.been.called;
    });
  }

  for (const error of [
    { name: 'InvalidSignatureException', $metadata: { httpStatusCode: 403 } },
    { name: 'UnrecognizedClientException', $metadata: { httpStatusCode: 403 } },
    { $metadata: { httpStatusCode: 403 } },
  ]) {
    it(`rethrows non-access-denied 403 ECR error ${JSON.stringify(error)}`, async () => {
      describeRepositoriesStub.rejects(error);

      try {
        await context.checkIfEcrRepositoryExists();
        throw new Error('Expected checkIfEcrRepositoryExists to reject');
      } catch (caughtError) {
        expect(caughtError).to.equal(error);
      }
      expect(warningStub).to.not.have.been.called;
    });
  }

  it('warns on access denied when provider ECR images are configured', async () => {
    context.serverless.service.provider.ecr = { images: { image: { path: './' } } };
    describeRepositoriesStub.rejects({ name: 'AccessDeniedException' });

    await expect(context.checkIfEcrRepositoryExists()).to.eventually.equal(false);

    expect(warningStub).to.have.been.calledOnce;
  });

  it('rethrows unexpected errors', async () => {
    describeRepositoriesStub.rejects(new Error('boom'));

    await expect(context.checkIfEcrRepositoryExists()).to.be.rejectedWith('boom');
  });

  it('uses an existing ECR client promise from the plugin context', async () => {
    const send = sinon.stub().resolves({ repositories: [{ repositoryName: 'repository' }] });
    context.ecrClientPromise = Promise.resolve({ send });
    context.provider.getAwsSdkV3Config.throws(
      new Error('Expected existing ECR client to be reused')
    );

    await expect(context.checkIfEcrRepositoryExists()).to.eventually.equal(true);

    expect(context.provider.getAwsSdkV3Config).to.not.have.been.called;
    expect(send).to.have.been.calledOnce;
    expect(send.firstCall.args[0]).to.be.instanceOf(DescribeRepositoriesCommand);
    expect(send.firstCall.args[0].input).to.deep.equal({
      repositoryNames: ['repository'],
      registryId: '123456789012',
    });
  });
});
