'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const yauzl = require('yauzl');

const zipSignatures = new Set([0x04034b50, 0x06054b50, 0x08074b50]);

const isZipBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 && zipSignatures.has(buffer.readUInt32LE(0));
};

const openZip = (input) => {
  return new Promise((resolve, reject) => {
    const callback = (error, zipfile) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(zipfile);
    };

    if (Buffer.isBuffer(input)) {
      yauzl.fromBuffer(input, { lazyEntries: true }, callback);
      return;
    }

    yauzl.open(input, { lazyEntries: true }, callback);
  });
};

const isSymlinkEntry = (entry) => {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & 0o170000) === 0o120000;
};

const normalizeEntryPath = (entryPath, strip = 0) => {
  const strippedPath = entryPath.split('/').slice(strip).join('/');

  if (!strippedPath || strippedPath.includes('\0')) return null;
  if (path.isAbsolute(strippedPath)) return null;
  if (/^[a-zA-Z]:[\\/]/.test(strippedPath)) return null;

  const normalizedPath = path.normalize(strippedPath);

  if (normalizedPath === '..' || normalizedPath.startsWith(`..${path.sep}`)) {
    return null;
  }

  return normalizedPath;
};

const readEntry = (zipfile, entry) => {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      const chunks = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
};

const extractZip = async (input, output, options = {}) => {
  const zipfile = await openZip(input);
  const extractedFiles = [];

  try {
    await new Promise((resolve, reject) => {
      const fail = (error) => {
        reject(error);
      };

      zipfile.on('error', fail);
      zipfile.on('end', resolve);

      zipfile.on('entry', async (entry) => {
        try {
          const normalizedPath = normalizeEntryPath(entry.fileName, options.strip || 0);

          if (!normalizedPath || isSymlinkEntry(entry)) {
            zipfile.readEntry();
            return;
          }

          const isDirectory = entry.fileName.endsWith('/');
          const file = {
            path: isDirectory ? `${normalizedPath}/` : normalizedPath,
            type: isDirectory ? 'directory' : 'file',
          };

          if (options.filter && !options.filter(file)) {
            zipfile.readEntry();
            return;
          }

          if (isDirectory) {
            if (output) {
              await fsp.mkdir(path.join(output, normalizedPath), { recursive: true });
            }
            zipfile.readEntry();
            return;
          }

          const data = await readEntry(zipfile, entry);

          if (output) {
            const targetPath = path.join(output, normalizedPath);
            await fsp.mkdir(path.dirname(targetPath), { recursive: true });
            await fsp.writeFile(targetPath, data);

            if (options.mode) {
              await fsp.chmod(targetPath, options.mode);
            }
          }

          extractedFiles.push({ ...file, data: output ? undefined : data });
          zipfile.readEntry();
        } catch (error) {
          reject(error);
        }
      });

      zipfile.readEntry();
    });
  } finally {
    zipfile.close();
  }

  return extractedFiles;
};

module.exports = {
  extractZip,
  isZipBuffer,
};
