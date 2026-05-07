'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const expect = chai.expect;

describe('test/unit/src/utils/aws/get-client-config.test.js', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('builds client config with resolved credentials', () => {
    const getCredentialProvider = sinon.stub().returns('creds');
    const buildClientConfig = sinon.stub().returns('client-config');
    const getClientConfig = proxyquire
      .noCallThru()
      .load('../../../../../../lib/compose/utils/aws/get-client-config', {
        './get-credential-provider': getCredentialProvider,
        './config': { buildClientConfig },
      });

    expect(
      getClientConfig({
        profile: 'team',
        region: 'eu-central-1',
        stage: 'prod',
        endpoint: 'http://localhost:4566',
      })
    ).to.equal('client-config');
    expect(getCredentialProvider).to.have.been.calledOnceWithExactly({
      profile: 'team',
      stage: 'prod',
    });
    expect(buildClientConfig).to.have.been.calledOnceWithExactly({
      endpoint: 'http://localhost:4566',
      region: 'eu-central-1',
      credentials: 'creds',
    });
  });

  it('preserves explicit credentials without resolving a provider', () => {
    const getCredentialProvider = sinon.stub();
    const buildClientConfig = sinon.stub().returns('client-config');
    const getClientConfig = proxyquire
      .noCallThru()
      .load('../../../../../../lib/compose/utils/aws/get-client-config', {
        './get-credential-provider': getCredentialProvider,
        './config': { buildClientConfig },
      });

    expect(getClientConfig({ credentials: 'explicit-creds', region: 'us-east-1' })).to.equal(
      'client-config'
    );
    expect(getCredentialProvider).to.not.have.been.called;
    expect(buildClientConfig).to.have.been.calledOnceWithExactly({
      region: 'us-east-1',
      credentials: 'explicit-creds',
    });
  });
});
