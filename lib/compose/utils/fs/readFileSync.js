'use strict';

const fs = require('node:fs');
const parseFile = require('./parseFile');

const readFileSync = (filePath, options = {}) => {
  const contents = fs.readFileSync(filePath, 'utf8');
  return parseFile(filePath, contents, options);
};

module.exports = readFileSync;
