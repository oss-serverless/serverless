'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const ensureDir = (dirPath) => fsp.mkdir(dirPath, { recursive: true });

const remove = (targetPath) => fsp.rm(targetPath, { recursive: true, force: true });

const removeSync = (targetPath) => fs.rmSync(targetPath, { recursive: true, force: true });

const outputFile = async (filePath, contents, options) => {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, contents, options);
};

const outputFileSync = (filePath, contents, options) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, options);
};

module.exports = { ensureDir, outputFile, outputFileSync, remove, removeSync };
