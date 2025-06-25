'use strict';

const ensureString = require('type/string/ensure');
const isPlainObject = require('type/plain-object/is');
const path = require('path');
const fsp = require('fs').promises;
const yaml = require('js-yaml');
const cloudformationSchema = require('@serverless/utils/cloudformation-schema');
const ServerlessError = require('../serverless-error');

const readConfigurationFile = async (configurationPath) => {
  try {
    return await fsp.readFile(configurationPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ServerlessError(
        `Cannot parse "${path.basename(configurationPath)}": File not found`,
        'CONFIGURATION_NOT_FOUND'
      );
    }
    throw new ServerlessError(
      `Cannot parse "${path.basename(configurationPath)}": ${error.message}`,
      'CONFIGURATION_NOT_ACCESSIBLE'
    );
  }
};

const parseConfigurationFile = async (configurationPath) => {
  switch (path.extname(configurationPath)) {
    case '.yml':
    case '.yaml': {
      const content = await readConfigurationFile(configurationPath);
      try {
        return yaml.load(content, {
          filename: configurationPath,
          schema: cloudformationSchema,
        });
      } catch (error) {
        throw new ServerlessError(
          `Cannot parse "${path.basename(configurationPath)}": ${error.message}`,
          'CONFIGURATION_PARSE_ERROR'
        );
      }
    }
    case '.json': {
      const content = await readConfigurationFile(configurationPath);
      try {
        return JSON.parse(content);
      } catch (error) {
        throw new ServerlessError(
          `Cannot parse "${path.basename(configurationPath)}": JSON parse error: ${error.message}`,
          'CONFIGURATION_PARSE_ERROR'
        );
      }
    }
    case '.ts':
    case '.mts': {
      try {
        /**
         * Jiti does not support `tsconfig.paths`, so we need to use tsx to load the configuration file.
         * @see https://github.com/unjs/jiti/issues/373
         * @see https://tsx.is/dev-api/tsx-require
         */
        // eslint-disable-next-line import/no-unresolved
        const tsx = require('tsx/cjs/api');
        const content = tsx.require(configurationPath, __filename);

        return content.default || content;
      } catch (error) {
        throw new ServerlessError(
          `Cannot parse "${path.basename(configurationPath)}": Initialization error: ${
            error && error.stack ? error.stack : error
          }`,
          'CONFIGURATION_INITIALIZATION_ERROR'
        );
      }
    }
    // fallthrough
    case '.cjs':
    case '.js': {
      const configurationEventuallyDeferred = (() => {
        try {
          require.resolve(configurationPath);
        } catch {
          throw new ServerlessError(
            `Cannot load "${path.basename(configurationPath)}": File not found`,
            'CONFIGURATION_NOT_FOUND'
          );
        }
        try {
          return require(configurationPath);
        } catch (error) {
          throw new ServerlessError(
            `Cannot load "${path.basename(configurationPath)}": Initialization error: ${
              error && error.stack ? error.stack : error
            }`,
            'CONFIGURATION_INITIALIZATION_ERROR'
          );
        }
      })();
      try {
        return await configurationEventuallyDeferred;
      } catch (error) {
        throw new ServerlessError(
          `Cannot load "${path.basename(configurationPath)}": Initialization error: ${
            error && error.stack ? error.stack : error
          }`,
          'CONFIGURATION_INITIALIZATION_ERROR'
        );
      }
    }
    case '.mjs': {
      try {
        require.resolve(configurationPath);
      } catch {
        throw new ServerlessError(
          `Cannot load "${path.basename(configurationPath)}": File not found`,
          'CONFIGURATION_NOT_FOUND'
        );
      }
      try {
        // dynamic import might not be available depending on the node version of the user, but we assume it is, since
        // the user explicitly declared his use of es-module syntax by using the .mjs extension.
        return (await require('../utils/import-esm')(configurationPath)).default;
      } catch (error) {
        throw new ServerlessError(
          `Cannot load "${path.basename(configurationPath)}": Initialization error: ${
            error && error.stack ? error.stack : error
          }`,
          'CONFIGURATION_INITIALIZATION_ERROR'
        );
      }
    }
    default:
      throw new ServerlessError(
        `Cannot parse "${path.basename(configurationPath)}": Unsupported file extension`,
        'UNSUPPORTED_CONFIGURATION_TYPE'
      );
  }
};

module.exports = async (configurationPath) => {
  configurationPath = path.resolve(
    ensureString(configurationPath, {
      name: 'configurationPath',
    })
  );

  let configuration = await parseConfigurationFile(configurationPath);

  if (!isPlainObject(configuration)) {
    throw new ServerlessError(
      `Invalid configuration at "${path.basename(configurationPath)}": Plain object expected`,
      'INVALID_CONFIGURATION_EXPORT'
    );
  }

  // Ensure no internal complex objects and no circural references
  try {
    configuration = JSON.parse(JSON.stringify(configuration));
  } catch (error) {
    throw new ServerlessError(
      `Invalid configuration at "${path.basename(
        configurationPath
      )}": Plain JSON structure expected, when parsing observed error: ${error.message}`,
      'INVALID_CONFIGURATION_STRUCTURE'
    );
  }
  return configuration;
};
