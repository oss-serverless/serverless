'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const fse = require('fs-extra');
const { expect } = require('chai');
const requireUncached = require('ncjsm/require-uncached');
const overrideEnv = require('process-utils/override-env');
const overrideCwd = require('process-utils/override-cwd');

const loadConfigModule = () =>
  requireUncached(() => require('../../../../../lib/utils/serverless-utils/config'));

const cleanupConfigArtifacts = async (...configFileNames) => {
  const names = configFileNames.length
    ? configFileNames
    : ['.serverlessrc', '.serverlessstagingrc'];
  const paths = names.flatMap((configFileName) => [
    path.join(os.homedir(), configFileName),
    path.join(os.homedir(), `${configFileName}.bak`),
    path.join(os.homedir(), '.config', configFileName),
    path.join(os.homedir(), '.config', `${configFileName}.bak`),
  ]);

  await Promise.all(paths.map((filePath) => fse.remove(filePath)));
  await fse.remove(path.join(os.homedir(), '.config'));
};

const withLocalDir = async (name, callback) => {
  const localDir = path.join(os.homedir(), name);
  await fse.ensureDir(localDir);

  const { restoreCwd } = overrideCwd(localDir);

  try {
    return await callback(localDir);
  } finally {
    restoreCwd();
    await fse.remove(localDir);
  }
};

describe('serverless-utils/config', () => {
  afterEach(async () => {
    await cleanupConfigArtifacts();
  });

  it('should have CONFIG_FILE_NAME', () => {
    const config = loadConfigModule();

    expect(config.CONFIG_FILE_NAME).to.exist;
  });

  it('prefers the default global config when both global locations exist', async () => {
    const config = loadConfigModule();
    const homeConfigDir = path.join(os.homedir(), '.config');
    const homeConfigPath = path.join(homeConfigDir, config.CONFIG_FILE_NAME);
    const defaultGlobalPath = path.join(os.homedir(), config.CONFIG_FILE_NAME);

    await withLocalDir('config-both-globals', async () => {
      await fse.ensureDir(homeConfigDir);
      await Promise.all([
        fs.promises.writeFile(homeConfigPath, JSON.stringify({ trackingDisabled: true }, null, 2)),
        fs.promises.writeFile(
          defaultGlobalPath,
          JSON.stringify({ trackingDisabled: false, enterpriseDisabled: true }, null, 2)
        ),
      ]);

      expect(config.getConfig()).to.deep.equal({
        trackingDisabled: false,
        enterpriseDisabled: true,
      });
    });
  });

  it('merges local and global config and updates only the local config on set/delete', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-local-and-global', async (localDir) => {
      const localConfigPath = path.join(localDir, config.CONFIG_FILE_NAME);
      const globalConfigPath = path.join(os.homedir(), config.CONFIG_FILE_NAME);

      await Promise.all([
        fs.promises.writeFile(localConfigPath, JSON.stringify({ trackingDisabled: true }, null, 2)),
        fs.promises.writeFile(
          globalConfigPath,
          JSON.stringify({ trackingDisabled: false, enterpriseDisabled: true }, null, 2)
        ),
      ]);

      expect(config.getConfig()).to.deep.equal({
        trackingDisabled: true,
        enterpriseDisabled: true,
      });

      config.set('newKey', 'somevalue');
      expect(JSON.parse(await fs.promises.readFile(localConfigPath, 'utf8')).newKey).to.equal(
        'somevalue'
      );
      expect(JSON.parse(await fs.promises.readFile(globalConfigPath, 'utf8'))).to.not.have.property(
        'newKey'
      );

      config.delete('trackingDisabled');
      expect(JSON.parse(await fs.promises.readFile(localConfigPath, 'utf8'))).to.not.have.property(
        'trackingDisabled'
      );
      expect(JSON.parse(await fs.promises.readFile(globalConfigPath, 'utf8'))).to.have.property(
        'trackingDisabled'
      );
    });
  });

  it('creates a default global config when no config files exist', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-create-default', async () => {
      const globalConfigPath = path.join(os.homedir(), config.CONFIG_FILE_NAME);

      config.get('notImportant');

      expect((await fs.promises.stat(globalConfigPath)).isFile()).to.equal(true);

      const result = config.getConfig();
      expect(result.frameworkId).to.be.a('string');
      expect(result.meta.created_at).to.not.equal(null);
      expect(result.meta.updated_at).to.not.equal(null);

      delete result.frameworkId;
      delete result.meta;
      expect(result).to.deep.equal({
        trackingDisabled: false,
        enterpriseDisabled: false,
        userId: null,
      });
    });
  });

  it('uses the ~/.config global config when it exists alone', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-home-config-only', async () => {
      const homeConfigDir = path.join(os.homedir(), '.config');
      const homeConfigPath = path.join(homeConfigDir, config.CONFIG_FILE_NAME);
      const defaultGlobalPath = path.join(os.homedir(), config.CONFIG_FILE_NAME);

      await fse.ensureDir(homeConfigDir);
      await fs.promises.writeFile(
        homeConfigPath,
        JSON.stringify({ trackingDisabled: true, enterpriseDisabled: true }, null, 2)
      );

      expect(config.getConfig()).to.deep.equal({
        trackingDisabled: true,
        enterpriseDisabled: true,
      });
      expect(await fse.pathExists(defaultGlobalPath)).to.equal(false);
    });
  });

  it('backs up malformed local config files and treats them as empty', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-malformed-local', async (localDir) => {
      const localConfigPath = path.join(localDir, config.CONFIG_FILE_NAME);

      await fs.promises.writeFile(localConfigPath, '{"broken"');

      const result = config.getConfig();

      expect(result).to.be.an('object');
      expect(await fse.pathExists(`${localConfigPath}.bak`)).to.equal(true);
    });
  });

  it('backs up malformed ~/.config global files and recreates the default global config', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-malformed-global', async () => {
      const homeConfigDir = path.join(os.homedir(), '.config');
      const homeConfigPath = path.join(homeConfigDir, config.CONFIG_FILE_NAME);
      const defaultGlobalPath = path.join(os.homedir(), config.CONFIG_FILE_NAME);

      await fse.ensureDir(homeConfigDir);
      await fs.promises.writeFile(homeConfigPath, '{"broken"');

      const result = config.getConfig();

      expect(result.frameworkId).to.be.a('string');
      expect(await fse.pathExists(`${homeConfigPath}.bak`)).to.equal(true);
      expect(await fse.pathExists(defaultGlobalPath)).to.equal(true);
    });
  });

  it('returns null from getLoggedInUser when no dashboard user is present', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-get-logged-in-user-null', async (localDir) => {
      await fs.promises.writeFile(
        path.join(localDir, config.CONFIG_FILE_NAME),
        JSON.stringify({ userId: 'user-1', users: {} }, null, 2)
      );

      expect(config.getLoggedInUser()).to.equal(null);
    });
  });

  it('returns the logged in dashboard user when configured', async () => {
    const config = loadConfigModule();

    await withLocalDir('config-get-logged-in-user', async (localDir) => {
      await fs.promises.writeFile(
        path.join(localDir, config.CONFIG_FILE_NAME),
        JSON.stringify(
          {
            userId: 'user-1',
            users: {
              'user-1': {
                dashboard: {
                  username: 'jdoe',
                  accessKeys: ['key-1'],
                  idToken: 'id-token',
                  refreshToken: 'refresh-token',
                },
              },
            },
          },
          null,
          2
        )
      );

      expect(config.getLoggedInUser()).to.deep.equal({
        userId: 'user-1',
        username: 'jdoe',
        accessKeys: ['key-1'],
        idToken: 'id-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  it('uses a stage-specific config filename for non-prod platform stages', async () => {
    await overrideEnv({ asCopy: true }, async () => {
      process.env.SERVERLESS_PLATFORM_STAGE = 'staging';

      const config = loadConfigModule();

      expect(config.CONFIG_FILE_NAME).to.equal('.serverlessstagingrc');
    });
  });

  it('uses the default config filename for the prod platform stage', async () => {
    await overrideEnv({ asCopy: true }, async () => {
      process.env.SERVERLESS_PLATFORM_STAGE = 'prod';

      const config = loadConfigModule();

      expect(config.CONFIG_FILE_NAME).to.equal('.serverlessrc');
    });
  });
});
