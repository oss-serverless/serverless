'use strict';

const path = require('path');
const crypto = require('crypto');
const { mkdir } = require('fs-extra');
const processTmpDir = require('./process-tmp-dir');

module.exports = () =>
  new Promise((resolve) => {
    const tmpDirName = path.join(processTmpDir, crypto.randomBytes(3).toString('hex'));
    resolve(
      mkdir(tmpDirName).then(
        () => tmpDirName,
        (error) => {
          if (error.code !== 'EEXIST') throw error;
          return module.exports(); // Name taken (rare edge case), retry
        }
      )
    );
  });
