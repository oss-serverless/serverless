'use strict';

const expect = require('chai').expect;
const resolveCfImportValue = require('../../../../../../lib/plugins/aws/utils/resolve-cf-import-value');
const { CloudFormationClient, ListExportsCommand } = require('@aws-sdk/client-cloudformation');
const sinon = require('sinon');

describe('#resolveCfImportValue', () => {
  let listExportsStub;
  let provider;

  beforeEach(() => {
    provider = {
      getAwsSdkV3Config: sinon
        .stub()
        .resolves({ region: 'us-east-1', credentials: async () => ({}) }),
    };
    listExportsStub = sinon.stub(CloudFormationClient.prototype, 'send');
  });

  afterEach(() => {
    CloudFormationClient.prototype.send.restore();
  });

  it('should return matching exported value if found', async () => {
    listExportsStub.resolves({
      Exports: [
        {
          Name: 'anotherName',
          Value: 'anotherValue',
        },
        {
          Name: 'exportName',
          Value: 'exportValue',
        },
      ],
    });

    const result = await resolveCfImportValue(provider, 'exportName');

    expect(listExportsStub).to.have.been.calledOnce;
    expect(listExportsStub.firstCall.args[0]).to.be.instanceOf(ListExportsCommand);
    expect(listExportsStub.firstCall.args[0].input).to.deep.equal({});
    expect(result).to.equal('exportValue');
  });

  it('should follow pagination tokens', async () => {
    const sdkParams = { SomeParam: 'kept' };
    listExportsStub
      .onFirstCall()
      .resolves({ Exports: [{ Name: 'first', Value: 'firstValue' }], NextToken: 'next' })
      .onSecondCall()
      .resolves({ Exports: [{ Name: 'exportName', Value: 'exportValue' }] });

    const result = await resolveCfImportValue(provider, 'exportName', sdkParams);

    expect(result).to.equal('exportValue');
    expect(sdkParams).to.deep.equal({ SomeParam: 'kept' });
    expect(listExportsStub).to.have.been.calledTwice;
    expect(provider.getAwsSdkV3Config).to.have.been.calledOnce;
    expect(listExportsStub.firstCall.args[0].input).to.deep.equal({ SomeParam: 'kept' });
    expect(listExportsStub.secondCall.args[0].input).to.deep.equal({
      SomeParam: 'kept',
      NextToken: 'next',
    });
  });

  it('should tolerate pages without Exports', async () => {
    listExportsStub
      .onFirstCall()
      .resolves({ NextToken: 'next' })
      .onSecondCall()
      .resolves({ Exports: [{ Name: 'exportName', Value: 'exportValue' }] });

    const result = await resolveCfImportValue(provider, 'exportName');

    expect(result).to.equal('exportValue');
    expect(listExportsStub).to.have.been.calledTwice;
  });

  it('reuses the CloudFormation client across repeated resolutions', async () => {
    listExportsStub
      .onFirstCall()
      .resolves({ Exports: [{ Name: 'first', Value: 'firstValue' }] })
      .onSecondCall()
      .resolves({ Exports: [{ Name: 'second', Value: 'secondValue' }] });

    await expect(resolveCfImportValue(provider, 'first')).to.eventually.equal('firstValue');
    await expect(resolveCfImportValue(provider, 'second')).to.eventually.equal('secondValue');

    expect(provider.getAwsSdkV3Config).to.have.been.calledOnce;
    expect(listExportsStub).to.have.been.calledTwice;
  });

  it('should reject if export cannot be found', async () => {
    listExportsStub.resolves({ Exports: [{ Name: 'first', Value: 'firstValue' }] });

    try {
      await resolveCfImportValue(provider, 'missing');
      throw new Error('Expected resolveCfImportValue to reject');
    } catch (error) {
      expect(error.code).to.equal('CF_IMPORT_RESOLUTION');
    }
  });
});
