'use strict';

const path = require('path');
const ensureString = require('type/string/ensure');
const ensurePlainObject = require('type/plain-object/ensure');
const ensurePlainFunction = require('type/plain-function/ensure');
const wait = require('timers-ext/promise/sleep');
const spawn = require('child-process-ext/spawn');
const fse = require('fs-extra');
const memoizee = require('memoizee');
const _ = require('lodash');
const log = require('log').get('serverless:test');
const { load: loadYaml, dump: saveYaml } = require('js-yaml');
const cloudformationSchema = require('@serverless/utils/cloudformation-schema');
const provisionTmpDir = require('./provision-tmp-dir');

const isFixtureConfigured = memoizee((fixturePath) => {
  let stats;
  try {
    stats = fse.statSync(fixturePath);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return Boolean(stats.isDirectory());
});

const isFile = (filename) =>
  fse.lstat(filename).then(
    (stats) => {
      if (!stats.isFile()) return false;
      return true;
    },
    (error) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  );

const npmInstall = async (cwd, attempt = 0) => {
  if (attempt) {
    try {
      await fse.remove(path.resolve(cwd, 'node_modules'));
    } catch {
      // ignore
    }
  }

  try {
    await spawn('npm', ['install'], { cwd });
  } catch (error) {
    if (attempt < 3) {
      const { code, stdoutBuffer } = error;
      if (code === 1) {
        if (String(stdoutBuffer).includes('cb() never called!')) {
          await wait(2000);
          await npmInstall(cwd, ++attempt);
          return;
        }
      }
    }
    throw error;
  }
};

const setupFixture = memoizee(
  async (fixturePath) => {
    const [hasSetupScript, hasNpmDependencies] = await Promise.all([
      isFile(path.resolve(fixturePath, '_setup.js')),
      isFile(path.resolve(fixturePath, 'package.json')),
    ]);
    if (!hasSetupScript && !hasNpmDependencies) return fixturePath;
    const setupFixturePath = await provisionTmpDir();
    await fse.copy(fixturePath, setupFixturePath);
    if (hasNpmDependencies) {
      log.notice(
        'install dependencies for %s (at %s)',
        path.basename(fixturePath),
        setupFixturePath
      );
      await npmInstall(setupFixturePath);
    }
    if (!hasSetupScript) return setupFixturePath;
    log.notice('run setup for %s (at %s)', path.basename(fixturePath), setupFixturePath);
    const setupScriptPath = path.resolve(setupFixturePath, '_setup.js');
    await ensurePlainFunction(require(setupScriptPath))(fixturePath);
    await fse.unlink(setupScriptPath);
    return setupFixturePath;
  },
  { promise: true }
);

const nameTimeBase = new Date(2020, 8, 7).getTime();

module.exports = memoizee((fixturesPath) => {
  return {
    setup: async (fixtureName, options = {}) => {
      const baseFixturePath = path.join(fixturesPath, ensureString(fixtureName));
      if (!isFixtureConfigured(baseFixturePath)) {
        throw new Error(`No fixture configured at ${fixtureName}`);
      }
      if (!options) options = {};

      const [fixturePath, setupFixturePath] = await Promise.all([
        provisionTmpDir(),
        setupFixture(baseFixturePath),
      ]);
      let configObject;
      const [configContent] = await Promise.all([
        fse.readFile(path.join(setupFixturePath, 'serverless.yml')).catch((error) => {
          if (error.code === 'ENOENT') return null;
          throw error;
        }),
        fse.copy(setupFixturePath, fixturePath),
      ]);
      configObject =
        configContent &&
        (() => {
          try {
            return loadYaml(configContent, { schema: cloudformationSchema });
          } catch (error) {
            return null;
          }
        })();
      let isConfigUpdated = false;
      if (_.get(configObject, 'service')) {
        configObject.service = `test-${fixtureName}-${(Date.now() - nameTimeBase).toString(32)}`;
        isConfigUpdated = true;
      }
      if (options.configExt) {
        configObject = _.merge(configObject || {}, options.configExt);
        isConfigUpdated = true;
      }
      if (isConfigUpdated) {
        await fse.writeFile(path.join(fixturePath, 'serverless.yml'), saveYaml(configObject));
      }
      log.info('setup %s fixture at %s', fixtureName, fixturePath);
      return {
        servicePath: fixturePath,
        serviceConfig: configObject,
        updateConfig: (configExt) => {
          ensurePlainObject(configExt);
          _.merge(configObject, configExt);
          return fse.writeFile(path.join(fixturePath, 'serverless.yml'), saveYaml(configObject));
        },
      };
    },
  };
});
