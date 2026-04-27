'use strict';

const chai = require('chai');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const overrideEnv = require('process-utils/override-env');

const { expect } = chai;

describe('test/unit/lib/aws/credentials.test.js', () => {
  const homeDir = path.resolve('/home/test');
  const credentialsFilePath = path.join(homeDir, '.aws', 'credentials');
  const configFilePath = path.join(homeDir, '.aws', 'config');

  function createMissingFileError() {
    return Object.assign(new Error('missing'), { code: 'ENOENT' });
  }

  function createUnresolvedProfileError(profile) {
    return Object.assign(
      new Error(
        `Could not resolve credentials using profile: [${profile}] in configuration/credentials file(s).`
      ),
      { name: 'CredentialsProviderError' }
    );
  }

  function loadCredentials({ files = {}, fromIni, fromNodeProviderChain }) {
    const readFileSync = sinon.stub().callsFake((filePath) => {
      if (Object.prototype.hasOwnProperty.call(files, filePath)) return files[filePath];
      throw createMissingFileError();
    });

    return proxyquire('../../../../lib/aws/credentials', {
      '@aws-sdk/credential-providers': {
        fromIni,
        fromNodeProviderChain,
      },
      'fs': { readFileSync },
      'os': { homedir: () => homeDir },
    });
  }

  it('falls back from the default profile only when the profile is absent', async () => {
    const fallbackCredentials = {
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    };
    const fallbackProvider = sinon.stub().resolves(fallbackCredentials);
    const fromIni = sinon
      .stub()
      .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.eventually.deep.equal(fallbackCredentials);
    expect(fromNodeProviderChain).to.have.been.calledOnce;
    expect(fallbackProvider).to.have.been.calledOnce;
  });

  it('forwards SDK v3 provider invocation options when using default fallback', async () => {
    const providerOptions = { callerClientConfig: { region: 'eu-west-1' } };
    const fallbackCredentials = {
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    };
    const profileProvider = sinon.stub().rejects(createUnresolvedProfileError('default'));
    const fallbackProvider = sinon.stub().resolves(fallbackCredentials);
    const fromIni = sinon.stub().returns(profileProvider);
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()(providerOptions)).to.eventually.deep.equal(
      fallbackCredentials
    );
    expect(profileProvider).to.have.been.calledOnceWithExactly(providerOptions);
    expect(fallbackProvider).to.have.been.calledOnceWithExactly(providerOptions);
  });

  it('does not fallback when the default profile has incomplete static credentials', async () => {
    const fallbackProvider = sinon.stub().resolves({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const fromIni = sinon
      .stub()
      .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      files: {
        [credentialsFilePath]: ['[default]', 'aws_access_key_id = accessKeyId'].join('\n'),
      },
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
      'Could not resolve credentials using profile'
    );
    expect(fromNodeProviderChain).to.not.have.been.called;
    expect(fallbackProvider).to.not.have.been.called;
  });

  it('does not fallback when the default profile has unrecognized fields', async () => {
    const fallbackProvider = sinon.stub().resolves({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const fromIni = sinon
      .stub()
      .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      files: {
        [credentialsFilePath]: ['[default]', 'custom_field = value'].join('\n'),
      },
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
      'Could not resolve credentials using profile'
    );
    expect(fromNodeProviderChain).to.not.have.been.called;
    expect(fallbackProvider).to.not.have.been.called;
  });

  it('does not swallow non-missing default profile errors', async () => {
    const fallbackProvider = sinon.stub().resolves({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const originalError = Object.assign(new Error('SSO session has expired'), {
      name: 'CredentialsProviderError',
    });
    const fromIni = sinon.stub().returns(sinon.stub().rejects(originalError));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      files: {
        [configFilePath]: [
          '[default]',
          'sso_session = my-sso',
          'sso_account_id = 123456789012',
          'sso_role_name = Admin',
          'sso_region = us-east-1',
        ].join('\n'),
      },
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith('SSO session has expired');
    expect(fromNodeProviderChain).to.not.have.been.called;
    expect(fallbackProvider).to.not.have.been.called;
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists but is malformed', async () => {
    await overrideEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('custom-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getAwsSdkV3CredentialsProvider } = loadCredentials({
        files: {
          [credentialsFilePath]: ['[custom-default]', 'aws_access_key_id = accessKeyId'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists as a quoted config profile', async () => {
    await overrideEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('custom-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getAwsSdkV3CredentialsProvider } = loadCredentials({
        files: {
          [configFilePath]: ['[profile "custom-default"]', 'custom_field = value'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists as an SSO config profile', async () => {
    await overrideEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const originalError = Object.assign(new Error('SSO session has expired'), {
        name: 'CredentialsProviderError',
      });
      const fromIni = sinon.stub().returns(sinon.stub().rejects(originalError));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getAwsSdkV3CredentialsProvider } = loadCredentials({
        files: {
          [configFilePath]: [
            '[profile custom-default]',
            'sso_session = my-sso',
            'sso_account_id = 123456789012',
            'sso_role_name = Admin',
            '[sso-session my-sso]',
            'sso_region = us-east-1',
            'sso_start_url = https://example.awsapps.com/start',
            'sso_registration_scopes = sso:account:access',
          ].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
        'SSO session has expired'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('falls back when AWS_DEFAULT_PROFILE is absent', async () => {
    await overrideEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'missing-default';
      const fallbackCredentials = {
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      };
      const fallbackProvider = sinon.stub().resolves(fallbackCredentials);
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('missing-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getAwsSdkV3CredentialsProvider } = loadCredentials({
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getAwsSdkV3CredentialsProvider()()).to.eventually.deep.equal(
        fallbackCredentials
      );
      expect(fromNodeProviderChain).to.have.been.calledOnce;
      expect(fallbackProvider).to.have.been.calledOnce;
    });
  });

  it('does not fallback for explicit profiles', async () => {
    const fallbackProvider = sinon.stub().resolves({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const fromIni = sinon
      .stub()
      .returns(sinon.stub().rejects(createUnresolvedProfileError('custom')));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider({ profile: 'custom' })()).to.be.rejectedWith(
      'Could not resolve credentials using profile'
    );
    expect(fromNodeProviderChain).to.not.have.been.called;
    expect(fallbackProvider).to.not.have.been.called;
  });

  it('detects profiles from credentials and config files', () => {
    const fromIni = sinon.stub();
    const fromNodeProviderChain = sinon.stub();
    const { doesProfileExist } = loadCredentials({
      files: {
        [credentialsFilePath]: ['[credentials-profile]', 'aws_access_key_id = accessKeyId'].join(
          '\n'
        ),
        [configFilePath]: [
          '[default]',
          'region = us-east-1',
          '[profile custom]',
          'region = us-east-1',
          '[profile "quoted"]',
          'region = us-east-1',
          "[profile 'single-quoted']",
          'region = us-east-1',
          '[raw-config]',
          'region = us-east-1',
        ].join('\n'),
      },
      fromIni,
      fromNodeProviderChain,
    });

    expect(doesProfileExist('credentials-profile')).to.equal(true);
    expect(doesProfileExist('default')).to.equal(true);
    expect(doesProfileExist('custom')).to.equal(true);
    expect(doesProfileExist('quoted')).to.equal(true);
    expect(doesProfileExist('single-quoted')).to.equal(true);
    expect(doesProfileExist('raw-config')).to.equal(false);
    expect(doesProfileExist('missing')).to.equal(false);
  });
});
