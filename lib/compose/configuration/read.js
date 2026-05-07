'use strict';

const isPlainObject = require('type/plain-object/is');
const { createRequire } = require('module');
const path = require('path');
const fsp = require('fs').promises;
const yaml = require('js-yaml');
const spawn = require('../utils/spawn');
const ServerlessError = require('../serverless-error');

// Logic for TS resolution is kept as similar as possible to the Serverless Framework codebase
const resolveTsNode = async (serviceDir) => {
  // 1. If installed aside of a Framework, use it
  try {
    return createRequire(path.resolve(__dirname, 'require-resolver')).resolve('ts-node');
  } catch (slsDepError) {
    if (slsDepError.code !== 'MODULE_NOT_FOUND') {
      throw new ServerlessError(
        `Cannot resolve "ts-node" due to: ${slsDepError.message}`,
        'TS_NODE_RESOLUTION_ERROR'
      );
    }

    // 2. If installed in a service, use it
    try {
      return createRequire(path.resolve(serviceDir, 'require-resolver')).resolve('ts-node');
    } catch (serviceDepError) {
      if (serviceDepError.code !== 'MODULE_NOT_FOUND') {
        throw new ServerlessError(
          `Cannot resolve "ts-node" due to: ${serviceDepError.message}`,
          'TS_NODE_IN_SERVICE_RESOLUTION_ERROR'
        );
      }

      // 3. If installed globally, use it
      const { stdoutBuffer } = await (async () => {
        try {
          return await spawn('npm', ['root', '-g']);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw new ServerlessError(
              `Cannot resolve "ts-node" due to unexpected "npm" error: ${error.message}`,
              'TS_NODE_NPM_RESOLUTION_ERROR'
            );
          }
          throw new ServerlessError('"ts-node" not found', 'TS_NODE_NOT_FOUND');
        }
      })();
      try {
        return require.resolve(`${String(stdoutBuffer).trim()}/ts-node`);
      } catch (globalDepError) {
        if (globalDepError.code !== 'MODULE_NOT_FOUND') {
          throw new ServerlessError(
            `Cannot resolve "ts-node" due to: ${globalDepError.message}`,
            'TS_NODE_NPM_GLOBAL_RESOLUTION_ERROR'
          );
        }
        throw new ServerlessError('"ts-node" not found', 'TS_NODE_NOT_FOUND');
      }
    }
  }
};

const readConfigurationFile = async (configurationPath) => {
  try {
    return await fsp.readFile(configurationPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ServerlessError(
        `Cannot parse "${path.basename(configurationPath)}": File not found`,
        'CONFIGURATION_FILE_NOT_FOUND'
      );
    }
    throw new ServerlessError(
      `Cannot parse "${path.basename(configurationPath)}": ${error.message}`,
      'CONFIGURATION_FILE_NOT_ACCESSIBLE'
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
        });
      } catch (error) {
        throw new ServerlessError(
          `Cannot parse "${path.basename(configurationPath)}": ${error.message}`,
          'COMPOSE_CONFIGURATION_PARSE_ERROR'
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
    case '.ts': {
      if (!process[Symbol.for('ts-node.register.instance')]) {
        const tsNodePath = await (async () => {
          try {
            return await resolveTsNode(path.dirname(configurationPath));
          } catch (error) {
            throw new ServerlessError(
              `Cannot parse "${path.basename(
                configurationPath
              )}": Resolution of "ts-node" failed with: ${error.message}`,
              'CONFIGURATION_RESOLUTION_ERROR'
            );
          }
        })();
        try {
          require(tsNodePath).register();
        } catch (error) {
          throw new ServerlessError(
            `Cannot parse "${path.basename(
              configurationPath
            )}": Register of "ts-node" failed with: ${error.message}`,
            'CONFIGURATION_RESOLUTION_ERROR'
          );
        }
      }
    }
    // fallthrough
    case '.js': {
      const configurationEventuallyDeferred = await (async () => {
        try {
          require.resolve(configurationPath);
        } catch {
          throw new ServerlessError(
            `Cannot load "${path.basename(configurationPath)}": File not found`,
            'CONFIGURATION_FILE_NOT_FOUND'
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
    default:
      // Should never happen, but it's better to throw an explicit error than fail implicitly if something weird like this happens
      throw new ServerlessError(
        `Cannot parse "${path.basename(configurationPath)}": Unsupported file extension`,
        'UNSUPPORTED_CONFIGURATION_TYPE'
      );
  }
};

module.exports = async (configurationPath) => {
  let configuration = await parseConfigurationFile(configurationPath);

  if (!isPlainObject(configuration)) {
    throw new ServerlessError(
      `Invalid configuration at "${path.basename(configurationPath)}": Plain object expected`,
      'INVALID_COMPOSE_CONFIGURATION_FORMAT'
    );
  }

  // Ensure no internal complex objects and no circular references
  try {
    configuration = JSON.parse(JSON.stringify(configuration));
  } catch (error) {
    throw new ServerlessError(
      `Invalid configuration at "${path.basename(
        configurationPath
      )}": Plain JSON structure expected, when parsing observed error: ${error.message}`,
      'INVALID_COMPOSE_CONFIGURATION_STRUCTURE'
    );
  }
  return configuration;
};
