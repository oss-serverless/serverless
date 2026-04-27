'use strict';

const path = require('path');
const ServerlessError = require('../../lib/serverless-error');

const maxNpmPackageNameLength = 214;
const npmPackageNamePattern = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

const validatePluginName = (name) => {
  if (name.length > maxNpmPackageNameLength || !npmPackageNamePattern.test(name)) {
    throw new ServerlessError(
      `Invalid plugin name "${name}". Plugin names must be valid npm package names.`,
      'INVALID_PLUGIN_NAME'
    );
  }
};

module.exports = {
  validate({ serviceDir }) {
    if (!serviceDir) {
      throw new ServerlessError(
        'This command can only be run inside a service directory',
        'MISSING_SERVICE_DIRECTORY'
      );
    }
  },

  getServerlessFilePath({ serviceDir, configurationFilename }) {
    if (configurationFilename) {
      return path.resolve(serviceDir, configurationFilename);
    }
    throw new ServerlessError(
      'Could not find any serverless service definition file.',
      'MISSING_SERVICE_CONFIGURATION_FILE'
    );
  },

  getPluginInfo(name_) {
    if (typeof name_ !== 'string') {
      throw new ServerlessError(
        `Invalid plugin name "${name_}". Plugin names must be valid npm package names.`,
        'INVALID_PLUGIN_NAME'
      );
    }
    let name;
    let version;
    if (name_.startsWith('@')) {
      [, name, version] = name_.split('@', 3);
      name = `@${name}`;
    } else {
      [name, version] = name_.split('@', 2);
    }
    validatePluginName(name);
    return { name, version };
  },
};
