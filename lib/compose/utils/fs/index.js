'use strict';

const isJsonPath = require('./isJsonPath');
const isYamlPath = require('./isYamlPath');
const fileExistsSync = require('./fileExistsSync');
const fileExists = require('./fileExists');
const parseFile = require('./parseFile');
const readFile = require('./readFile');
const readFileSync = require('./readFileSync');
const writeFile = require('./writeFile');

module.exports = {
  isJsonPath,
  isYamlPath,
  parseFile,
  fileExistsSync,
  fileExists,
  writeFile,
  readFile,
  readFileSync,
};
