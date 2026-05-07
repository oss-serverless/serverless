'use strict';

const path = require('path');
const fileExists = require('../utils/fs/fileExists');
const ServerlessError = require('../serverless-error');

const supportedExtensions = new Set(['yml', 'yaml', 'json', 'js', 'ts']);

module.exports = async (cwd = process.cwd()) => {
  for (const extension of supportedExtensions) {
    const eventualServiceConfigPath = path.resolve(cwd, `serverless-compose.${extension}`);
    if (await fileExists(eventualServiceConfigPath)) return eventualServiceConfigPath;
  }
  // As the default will be `serverless-compose.yml`, let's provide users with a more actionable error message,
  // Even if we support more configuration formats
  throw new ServerlessError('No serverless-compose.yml file found', 'CONFIGURATION_FILE_NOT_FOUND');
};
