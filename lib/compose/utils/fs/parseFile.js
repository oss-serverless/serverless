'use strict';

const YAML = require('js-yaml');
const { safeShallowAssign } = require('../safe-object');
const isJsonPath = require('./isJsonPath');
const isYamlPath = require('./isYamlPath');

const parseFile = (filePath, contents, options = {}) => {
  if (isJsonPath(filePath)) {
    return JSON.parse(contents);
  }

  if (isYamlPath(filePath)) {
    return YAML.load(contents.toString(), safeShallowAssign({}, options, { filename: filePath }));
  }

  if (filePath.endsWith('.slsignore')) {
    return contents.toString().split('\n');
  }

  return contents.toString().trim();
};

module.exports = parseFile;
