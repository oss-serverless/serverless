'use strict';

const fs = require('node:fs').promises;
const parseFile = require('./parseFile');

const readFile = async (filePath, options = {}) => {
  const contents = await fs.readFile(filePath, 'utf8');
  return parseFile(filePath, contents, options);
};

module.exports = readFile;
