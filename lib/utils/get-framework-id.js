'use strict';

const configUtils = require('./serverless-utils/config');

function getFrameworkId() {
  const config = configUtils.getConfig();
  return config.frameworkId;
}

module.exports = getFrameworkId;
