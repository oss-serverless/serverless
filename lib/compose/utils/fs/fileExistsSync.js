'use strict';

const fs = require('node:fs');

const fileExistsSync = (filePath) => {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

module.exports = fileExistsSync;
