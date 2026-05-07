'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const glob = require('./glob');

const CACHE_HASH_ALGORITHM = 'md5';
const CACHE_HASH_ENCODING = 'hex';

const createCacheHash = () => crypto.createHash(CACHE_HASH_ALGORITHM);

const calculateCacheDigest = (input) => createCacheHash().update(input).digest(CACHE_HASH_ENCODING);

const calculateFileCacheDigest = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createCacheHash();
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest(CACHE_HASH_ENCODING)));
  });

const calculateCacheHash = async (patterns, cwd) => {
  const allFilePaths = await glob(patterns, { cwd });
  const hashes = await Promise.all(
    allFilePaths.map((filePath) => calculateFileCacheDigest(path.join(cwd, filePath)))
  );

  hashes.sort();

  return calculateCacheDigest(hashes.join());
};

module.exports = calculateCacheHash;
