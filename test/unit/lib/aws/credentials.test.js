'use strict';

const chai = require('chai');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { overrideEnv } = require('../../../utils/process');

const { expect } = chai;

describe('test/unit/lib/aws/credentials.test.js', () => {
  const homeDir = path.resolve('/home/test');
  const credentialsFilePath = path.join(homeDir, '.aws', 'credentials');
  const configFilePath = path.join(homeDir, '.aws', 'config');
  const envKeys = [
    'AWS_PROFILE',
    'AWS_DEFAULT_PROFILE',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AWS_DEV_PROFILE',
    'AWS_DEV_ACCESS_KEY_ID',
    'AWS_DEV_SECRET_ACCESS_KEY',
    'AWS_DEV_SESSION_TOKEN',
    'AWS_PROD_PROFILE',
    'AWS_PROD_ACCESS_KEY_ID',
    'AWS_PROD_SECRET_ACCESS_KEY',
    'AWS_PROD_SESSION_TOKEN',
    'AWS_SHARED_CREDENTIALS_FILE',
    'AWS_CONFIG_FILE',
  ];
  let originalEnv;

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
      if (Object.prototype.hasOwnProperty.call(files, filePath)) {
        const result = files[filePath];
        if (result instanceof Error) throw result;
        return result;
      }
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

  beforeEach(() => {
    originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    sinon.restore();
  });

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

  it('does not fallback when a malformed default profile is loaded from a tilde credentials path', async () => {
    await overrideEnv(async () => {
      process.env.AWS_SHARED_CREDENTIALS_FILE = '~/.aws/credentials';
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
      expect(fromIni.firstCall.args[0]).to.include({
        filepath: credentialsFilePath,
        configFilepath: configFilePath,
      });
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when a malformed default profile is loaded from a tilde config path', async () => {
    await overrideEnv(async () => {
      process.env.AWS_CONFIG_FILE = '~/.aws/config';
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
          [configFilePath]: ['[profile default]', 'custom_field = value'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromIni.firstCall.args[0]).to.include({
        filepath: credentialsFilePath,
        configFilepath: configFilePath,
      });
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
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

  it('does not fallback when AWS_DEFAULT_PROFILE is explicitly set but absent', async () => {
    await overrideEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'missing-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('missing-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getAwsSdkV3CredentialsProvider } = loadCredentials({
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

  it('detects implicit default profiles from credentials and config files', () => {
    const fromIni = sinon.stub();
    const fromNodeProviderChain = sinon.stub();
    for (const [description, files] of [
      [
        'credentials default',
        {
          [credentialsFilePath]: ['[default]', 'aws_access_key_id = accessKeyId'].join('\n'),
        },
      ],
      ['config default', { [configFilePath]: ['[default]', 'region = us-east-1'].join('\n') }],
      [
        'config profile default',
        { [configFilePath]: ['[profile default]', 'region = us-east-1'].join('\n') },
      ],
      [
        'config double-quoted profile default',
        { [configFilePath]: ['[profile "default"]', 'region = us-east-1'].join('\n') },
      ],
      [
        'config single-quoted profile default',
        { [configFilePath]: ["[profile 'default']", 'region = us-east-1'].join('\n') },
      ],
    ]) {
      const { doesImplicitDefaultProfileExist } = loadCredentials({
        files,
        fromIni,
        fromNodeProviderChain,
      });

      expect(doesImplicitDefaultProfileExist(), description).to.equal(true);
    }
  });

  it('does not detect non-default profiles as implicit default profiles', () => {
    const fromIni = sinon.stub();
    const fromNodeProviderChain = sinon.stub();
    const { doesImplicitDefaultProfileExist } = loadCredentials({
      files: {
        [credentialsFilePath]: ['[credentials-profile]', 'aws_access_key_id = accessKeyId'].join(
          '\n'
        ),
        [configFilePath]: [
          '[profile custom]',
          'region = us-east-1',
          '[profile "quoted"]',
          'region = us-east-1',
          '[raw-config]',
          'region = us-east-1',
        ].join('\n'),
      },
      fromIni,
      fromNodeProviderChain,
    });

    expect(doesImplicitDefaultProfileExist()).to.equal(false);
  });

  it('does not fallback when implicit default profile detection cannot read shared files', async () => {
    const readError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const fallbackProvider = sinon.stub().resolves({
      accessKeyId: 'fallbackAccessKeyId',
      secretAccessKey: 'fallbackSecretAccessKey',
    });
    const fromIni = sinon
      .stub()
      .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
    const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
    const { getAwsSdkV3CredentialsProvider } = loadCredentials({
      files: { [credentialsFilePath]: readError },
      fromIni,
      fromNodeProviderChain,
    });

    await expect(getAwsSdkV3CredentialsProvider()()).to.be.rejectedWith('permission denied');
    expect(fromNodeProviderChain).to.not.have.been.called;
    expect(fallbackProvider).to.not.have.been.called;
  });
});
