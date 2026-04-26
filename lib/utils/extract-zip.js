'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const yauzl = require('yauzl');

const pathPosix = path.posix;

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
      yauzl.fromBuffer(input, { lazyEntries: true, strictFileNames: true }, callback);
      return;
    }

    yauzl.open(input, { lazyEntries: true, strictFileNames: true }, callback);
  });
};

const createUnsafeEntryError = (entryPath) =>
  new Error(`Unsafe ZIP entry path rejected: ${entryPath}`);

const assertSafeZipEntryPath = (entryPath) => {
  if (!entryPath || entryPath.includes('\0') || entryPath.includes('\\')) {
    throw createUnsafeEntryError(entryPath);
  }

  if (entryPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(entryPath)) {
    throw createUnsafeEntryError(entryPath);
  }

  const normalizedPath = pathPosix.normalize(entryPath);
  const normalizedWithoutTrailingSlash = normalizedPath.replace(/\/+$/, '');

  if (normalizedPath === '..' || normalizedPath.startsWith('../')) {
    throw createUnsafeEntryError(entryPath);
  }

  if (normalizedWithoutTrailingSlash === '.' || normalizedWithoutTrailingSlash === '') return '';

  return normalizedPath;
};

const getEntryUnixMode = (entry) => {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return unixMode || null;
};

const getEntryType = (entry) => {
  const mode = getEntryUnixMode(entry);
  const fileType = mode && mode & 0o170000;

  if (fileType === 0o120000) return 'symlink';
  if (fileType === 0o040000 || entry.fileName.endsWith('/')) return 'directory';
  return 'file';
};

const getEntryPermissions = (entry) => {
  const mode = getEntryUnixMode(entry);
  return mode ? mode & 0o7777 : undefined;
};

const getEntryMtime = (entry) => {
  const mtime = entry.getLastModDate && entry.getLastModDate();
  return mtime instanceof Date && !Number.isNaN(mtime.getTime()) ? mtime : undefined;
};

const normalizeEntryPath = (entryPath, strip = 0) => {
  const safePath = assertSafeZipEntryPath(entryPath);
  const strippedPath = safePath.split('/').slice(strip).join('/');

  if (!strippedPath) return null;
  return assertSafeZipEntryPath(strippedPath);
};

const assertInside = (rootPath, targetPath) => {
  const relativePath = path.relative(rootPath, targetPath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`ZIP entry resolved outside extraction target: ${targetPath}`);
  }
};

const assertNoSymlinkInPath = async (rootPath, targetPath) => {
  assertInside(rootPath, targetPath);

  const relativeParts = path.relative(rootPath, targetPath).split(path.sep).filter(Boolean);
  let currentPath = rootPath;

  for (const part of relativeParts) {
    currentPath = path.join(currentPath, part);

    try {
      const stats = await fsp.lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Refusing to extract through symlink: ${currentPath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
};

const writeFileSafely = async (targetPath, data, mode) => {
  const flags =
    fs.constants.O_WRONLY |
    fs.constants.O_CREAT |
    fs.constants.O_TRUNC |
    (fs.constants.O_NOFOLLOW || 0);
  const handle = await fsp.open(targetPath, flags, mode);

  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
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
  const directories = [];
  const outputRoot = output ? path.resolve(output) : null;

  if (outputRoot) {
    await fsp.mkdir(outputRoot, { recursive: true });
    if ((await fsp.lstat(outputRoot)).isSymbolicLink()) {
      throw new Error(`Refusing to extract into symlink: ${outputRoot}`);
    }
  }

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

          if (!normalizedPath) {
            zipfile.readEntry();
            return;
          }

          const entryType = getEntryType(entry);
          if (entryType === 'symlink') {
            throw new Error(`Refusing to extract ZIP symlink entry: ${entry.fileName}`);
          }

          const permissions = getEntryPermissions(entry);
          const mtime = getEntryMtime(entry);
          const isDirectory = entryType === 'directory';
          const file = {
            path:
              isDirectory && !normalizedPath.endsWith('/') ? `${normalizedPath}/` : normalizedPath,
            type: isDirectory ? 'directory' : 'file',
            mode: permissions,
            mtime,
          };

          if (options.filter && !options.filter(file)) {
            zipfile.readEntry();
            return;
          }

          if (isDirectory) {
            if (output) {
              const targetPath = path.join(outputRoot, normalizedPath);
              await assertNoSymlinkInPath(outputRoot, targetPath);
              await fsp.mkdir(targetPath, { recursive: true });
              directories.push({ path: targetPath, mode: permissions, mtime });
            }
            extractedFiles.push(file);
            zipfile.readEntry();
            return;
          }

          const data = await readEntry(zipfile, entry);

          if (output) {
            const targetPath = path.join(outputRoot, normalizedPath);
            await assertNoSymlinkInPath(outputRoot, targetPath);
            await fsp.mkdir(path.dirname(targetPath), { recursive: true });
            await writeFileSafely(targetPath, data, permissions);

            if (permissions != null) await fsp.chmod(targetPath, permissions);
            if (mtime) await fsp.utimes(targetPath, mtime, mtime);
          }

          extractedFiles.push({ ...file, data: output ? undefined : data });
          zipfile.readEntry();
        } catch (error) {
          reject(error);
        }
      });

      zipfile.readEntry();
    });

    if (output) {
      await Promise.all(
        directories
          .sort((left, right) => right.path.length - left.path.length)
          .map(async (directory) => {
            if (directory.mode != null) await fsp.chmod(directory.path, directory.mode);
            if (directory.mtime) await fsp.utimes(directory.path, directory.mtime, directory.mtime);
          })
      );
    }
  } finally {
    zipfile.close();
  }

  return extractedFiles;
};

module.exports = {
  extractZip,
  isZipBuffer,
};
