'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const expect = chai.expect;

describe('test/unit/src/utils/aws/get-credential-provider.test.js', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('forwards profile and stage to the aligned credential resolver', () => {
    const credentialProvider = sinon.stub().returns('provider');

    const getCredentialProvider = proxyquire
      .noCallThru()
      .load('../../../../../../lib/compose/utils/aws/get-credential-provider', {
        './credentials': { getCredentialProvider: credentialProvider },
      });

    expect(getCredentialProvider({ profile: 'custom-profile', stage: 'prod' })).to.equal(
      'provider'
    );
    expect(credentialProvider).to.have.been.calledOnceWithExactly({
      profile: 'custom-profile',
      stage: 'prod',
    });
  });
});
