'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');

const { expect } = chai;

describe('test/unit/lib/aws/credentials.test.js', () => {
  function loadCredentials({ fromIni, fromNodeProviderChain }) {
    return proxyquire('../../../../lib/aws/credentials', {
      '@aws-sdk/credential-providers': {
        fromIni,
        fromNodeProviderChain,
      },
    });
  }

  it('falls back from the default profile only when the profile is missing', async () => {
    const fallbackCredentials = {
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    };
    const fromIni = () => async () => {
      throw Object.assign(
        new Error('Could not resolve credentials using profile: [default] in configuration'),
        { name: 'CredentialsProviderError' }
      );
    };
    const fromNodeProviderChain = () => async () => fallbackCredentials;
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.eventually.deep.equal(
      fallbackCredentials
    );
  });

  it('does not swallow non-missing default profile errors', async () => {
    const originalError = Object.assign(new Error('SSO session has expired'), {
      name: 'CredentialsProviderError',
    });
    const fromIni = () => async () => {
      throw originalError;
    };
    const fromNodeProviderChain = () => async () => ({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
      'SSO session has expired'
    );
  });

  it('does not fallback for explicit profiles', async () => {
    const fromIni = () => async () => {
      throw Object.assign(
        new Error('Could not resolve credentials using profile: [custom] in configuration'),
        { name: 'CredentialsProviderError' }
      );
    };
    const fromNodeProviderChain = () => async () => ({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider({ profile: 'custom' })()).to.be.rejectedWith(
      'Could not resolve credentials using profile'
    );
  });
});
