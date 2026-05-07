'use strict';

const chai = require('chai');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const { expect } = chai;

describe('test/unit/src/utils/aws/credentials.test.js', () => {
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
    'AWS_SHARED_CREDENTIALS_FILE',
    'AWS_CONFIG_FILE',
  ];

  async function withEnv(callback) {
    const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

    for (const key of envKeys) delete process.env[key];

    try {
      return await callback();
    } finally {
      for (const key of envKeys) {
        const value = originalEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

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

  function loadCredentials({ files = {}, fromIni, fromNodeProviderChain } = {}) {
    const readFileSync = sinon.stub().callsFake((filePath) => {
      if (Object.prototype.hasOwnProperty.call(files, filePath)) {
        const result = files[filePath];
        if (result instanceof Error) throw result;
        return result;
      }
      throw createMissingFileError();
    });

    return proxyquire('../../../../../../lib/compose/utils/aws/credentials', {
      '@aws-sdk/credential-providers': {
        fromIni,
        fromNodeProviderChain,
      },
      'fs': { readFileSync },
      'os': { homedir: () => homeDir },
    });
  }

  afterEach(() => {
    sinon.restore();
  });

  it('does not mutate AWS_PROFILE when AWS_DEFAULT_PROFILE is set', async () => {
    await withEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const profileProvider = sinon.stub().resolves({
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
      });
      const fromIni = sinon.stub().returns(profileProvider);
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      getCredentialProvider();

      expect(process.env.AWS_PROFILE).to.equal(undefined);
      expect(fromIni.firstCall.args[0]).to.include({ profile: 'custom-default' });
      expect(fromNodeProviderChain).to.not.have.been.called;
    });
  });

  it('uses explicit state profile before stage profile', async () => {
    await withEnv(async () => {
      process.env.AWS_DEV_PROFILE = 'stage-profile';
      const fromIni = sinon.stub().callsFake(({ profile }) => `${profile}-provider`);
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      expect(getCredentialProvider({ profile: 'state-profile', stage: 'dev' })).to.equal(
        'state-profile-provider'
      );
      expect(fromIni.firstCall.args[0]).to.include({
        profile: 'state-profile',
        filepath: credentialsFilePath,
        configFilepath: configFilePath,
      });
      expect(fromIni.firstCall.args[0].mfaCodeProvider).to.be.a('function');
    });
  });

  it('uses stage profile before stage environment credentials', async () => {
    await withEnv(async () => {
      process.env.AWS_DEV_PROFILE = 'stage-profile';
      process.env.AWS_DEV_ACCESS_KEY_ID = 'stageAccessKeyId';
      process.env.AWS_DEV_SECRET_ACCESS_KEY = 'stageSecretAccessKey';
      const fromIni = sinon.stub().callsFake(({ profile }) => `${profile}-provider`);
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      expect(getCredentialProvider({ stage: 'dev' })).to.equal('stage-profile-provider');
    });
  });

  it('uses stage environment credentials before AWS_PROFILE', async () => {
    await withEnv(async () => {
      process.env.AWS_DEV_ACCESS_KEY_ID = 'stageAccessKeyId';
      process.env.AWS_DEV_SECRET_ACCESS_KEY = 'stageSecretAccessKey';
      process.env.AWS_DEV_SESSION_TOKEN = 'stageSessionToken';
      process.env.AWS_PROFILE = 'aws-profile';
      const fromIni = sinon.stub();
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider({ stage: 'dev' })()).to.eventually.deep.equal({
        accessKeyId: 'stageAccessKeyId',
        secretAccessKey: 'stageSecretAccessKey',
        sessionToken: 'stageSessionToken',
      });
      expect(fromIni).to.not.have.been.called;
    });
  });

  it('uses AWS_PROFILE before standard environment credentials', async () => {
    await withEnv(async () => {
      process.env.AWS_PROFILE = 'aws-profile';
      process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
      process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
      const fromIni = sinon.stub().callsFake(({ profile }) => `${profile}-provider`);
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      expect(getCredentialProvider()).to.equal('aws-profile-provider');
    });
  });

  it('uses standard environment credentials before AWS_DEFAULT_PROFILE', async () => {
    await withEnv(async () => {
      process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
      process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fromIni = sinon.stub();
      const fromNodeProviderChain = sinon.stub();
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider()()).to.eventually.deep.equal({
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: undefined,
      });
      expect(fromIni).to.not.have.been.called;
    });
  });

  it('falls back from the implicit default profile only when the profile is absent', async () => {
    await withEnv(async () => {
      const fallbackCredentials = {
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      };
      const fallbackProvider = sinon.stub().resolves(fallbackCredentials);
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider()()).to.eventually.deep.equal(fallbackCredentials);
      expect(fromNodeProviderChain).to.have.been.calledOnce;
      expect(fallbackProvider).to.have.been.calledOnce;
    });
  });

  it('forwards provider invocation options when using default fallback', async () => {
    await withEnv(async () => {
      const providerOptions = { callerClientConfig: { region: 'eu-west-1' } };
      const fallbackCredentials = {
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      };
      const profileProvider = sinon.stub().rejects(createUnresolvedProfileError('default'));
      const fallbackProvider = sinon.stub().resolves(fallbackCredentials);
      const fromIni = sinon.stub().returns(profileProvider);
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider()(providerOptions)).to.eventually.deep.equal(
        fallbackCredentials
      );
      expect(profileProvider).to.have.been.calledOnceWithExactly(providerOptions);
      expect(fallbackProvider).to.have.been.calledOnceWithExactly(providerOptions);
    });
  });

  it('does not fallback when the implicit default profile exists but is malformed', async () => {
    await withEnv(async () => {
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: {
          [credentialsFilePath]: ['[default]', 'aws_access_key_id = accessKeyId'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when a malformed default profile is loaded from a tilde credentials path', async () => {
    await withEnv(async () => {
      process.env.AWS_SHARED_CREDENTIALS_FILE = '~/.aws/credentials';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: {
          [credentialsFilePath]: ['[default]', 'aws_access_key_id = accessKeyId'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
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
    await withEnv(async () => {
      process.env.AWS_CONFIG_FILE = '~/.aws/config';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: {
          [configFilePath]: ['[profile default]', 'custom_field = value'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
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

  it('does not fallback when AWS_DEFAULT_PROFILE is explicitly set but absent', async () => {
    await withEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'missing-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('missing-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists but is malformed', async () => {
    await withEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('custom-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: {
          [credentialsFilePath]: ['[custom-default]', 'aws_access_key_id = accessKeyId'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromIni.firstCall.args[0]).to.include({ profile: 'custom-default' });
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists as a quoted config profile', async () => {
    await withEnv(async () => {
      process.env.AWS_DEFAULT_PROFILE = 'custom-default';
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('custom-default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: {
          [configFilePath]: ['[profile "custom-default"]', 'custom_field = value'].join('\n'),
        },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromIni.firstCall.args[0]).to.include({ profile: 'custom-default' });
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback when AWS_DEFAULT_PROFILE exists as an SSO config profile', async () => {
    await withEnv(async () => {
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
      const { getCredentialProvider } = loadCredentials({
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

      await expect(getCredentialProvider()()).to.be.rejectedWith('SSO session has expired');
      expect(fromIni.firstCall.args[0]).to.include({ profile: 'custom-default' });
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('does not fallback for explicit state profiles', async () => {
    await withEnv(async () => {
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('custom')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({ fromIni, fromNodeProviderChain });

      await expect(getCredentialProvider({ profile: 'custom' })()).to.be.rejectedWith(
        'Could not resolve credentials using profile'
      );
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });

  it('detects implicit default profiles from credentials and config files', async () => {
    await withEnv(async () => {
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
  });

  it('does not detect non-default profiles as implicit default profiles', async () => {
    await withEnv(async () => {
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
  });

  it('does not fallback when implicit default profile detection cannot read shared files', async () => {
    await withEnv(async () => {
      const readError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
      const fallbackProvider = sinon.stub().resolves({
        accessKeyId: 'fallbackAccessKeyId',
        secretAccessKey: 'fallbackSecretAccessKey',
      });
      const fromIni = sinon
        .stub()
        .returns(sinon.stub().rejects(createUnresolvedProfileError('default')));
      const fromNodeProviderChain = sinon.stub().returns(fallbackProvider);
      const { getCredentialProvider } = loadCredentials({
        files: { [credentialsFilePath]: readError },
        fromIni,
        fromNodeProviderChain,
      });

      await expect(getCredentialProvider()()).to.be.rejectedWith('permission denied');
      expect(fromNodeProviderChain).to.not.have.been.called;
      expect(fallbackProvider).to.not.have.been.called;
    });
  });
});
