'use strict';

const fse = require('fs-extra');

function fileExistsSync(filePath) {
  try {
    const stats = fse.statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

module.exports = fileExistsSync;
