'use strict';

const fs = require('node:fs').promises;

const fileExists = async (filePath) => {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

module.exports = fileExists;
