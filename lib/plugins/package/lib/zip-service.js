'use strict';

const yazl = require('yazl');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const childProcess = require('child_process');
const glob = require('../../../utils/glob');
const memoizee = require('memoizee');
const ServerlessError = require('../../../serverless-error');
const { log } = require('../../../utils/serverless-utils/log');

const execCommand = (command, options) =>
  new Promise((resolve, reject) => {
    childProcess.exec(command, options, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
const readFile = (...args) => fsp.readFile(...args);

const excludeNodeDevDependenciesMemoized = memoizee(excludeNodeDevDependencies, {
  promise: true,
  primitive: true,
});

const getArchiveEntryName = (filePath, prefix) => {
  const archivePath = path.normalize(prefix ? path.relative(prefix, filePath) : filePath);
  const segments = archivePath.split(path.sep).filter(Boolean);

  while (segments[0] === '.' || segments[0] === '..') {
    segments.shift();
  }

  return segments.join('/');
};

module.exports = {
  async zipService(exclude, include, zipFileName) {
    const params = await this.excludeDevDependencies({
      exclude,
      include,
      zipFileName,
    });
    return this.zip(params);
  },

  async excludeDevDependencies(params) {
    const serviceDir = this.serverless.serviceDir;

    let excludeDevDependencies = this.serverless.service.package.excludeDevDependencies;
    if (excludeDevDependencies === undefined || excludeDevDependencies === null) {
      excludeDevDependencies = true;
    }

    if (excludeDevDependencies) {
      if (params.contextName) {
        log.info(`Excluding development dependencies for ${params.contextName}`);
      } else {
        log.info('Excluding development dependencies');
      }

      const exAndInNode = await excludeNodeDevDependenciesMemoized(serviceDir);
      params.exclude = Array.from(new Set([...(params.exclude || []), ...exAndInNode.exclude]));
      params.include = Array.from(new Set([...(params.include || []), ...exAndInNode.include]));
      params.devDependencyExcludeSet = new Set(exAndInNode.exclude);
      return params;
    }

    return params;
  },

  async zip(params) {
    return this.resolveFilePathsFromPatterns(params).then((filePaths) =>
      this.zipFiles(filePaths, params.zipFileName)
    );
  },

  /**
   * Create a zip file on disk from an array of filenames of files on disk
   * @param files - an Array of filenames
   * @param zipFiles - the filename to save the zip at
   * @param prefix - a prefix to strip from the file names. use for layers support
   */
  async zipFiles(files, zipFileName, prefix) {
    if (files.length === 0) {
      const error = new ServerlessError('No files to package', 'NO_FILES_TO_PACKAGE');
      throw error;
    }

    // Create artifact in temp path and move it to the package path (if any) later
    const artifactFilePath = path.join(this.serverless.serviceDir, '.serverless', zipFileName);
    this.serverless.utils.writeFileDir(artifactFilePath);

    const zipfile = new yazl.ZipFile();
    const output = fs.createWriteStream(artifactFilePath);

    return new Promise((resolve, reject) => {
      const onError = (error) => reject(error);

      output.on('close', () => resolve(artifactFilePath));
      output.on('error', onError);
      zipfile.on('error', onError);

      output.on('open', async () => {
        try {
          zipfile.outputStream.pipe(output);

          // normalize both maps to avoid problems with e.g. Path Separators in different shells
          const normalizedFiles = Array.from(new Set(files.map((file) => path.normalize(file))));

          const contents = await Promise.all(
            normalizedFiles.map((filePath) => this.getFileContentAndStat(filePath))
          );
          contents
            .sort((content1, content2) => content1.filePath.localeCompare(content2.filePath))
            .forEach((file) => {
              const name = getArchiveEntryName(file.filePath, prefix);
              // Ensure file is executable if it is locally executable or
              // we force it to be executable if platform is windows
              const mode =
                file.stat.mode & 0o100 || process.platform === 'win32' ? 0o100755 : 0o100644;
              zipfile.addBuffer(file.data, name, {
                mode,
                mtime: new Date(0), // necessary to get the same hash when zipping the same content
              });
            });

          zipfile.end();
        } catch (error) {
          onError(error);
        }
      });
    });
  },

  async getFileContentAndStat(filePath) {
    const fullPath = path.resolve(this.serverless.serviceDir, filePath);

    return Promise.all([
      // Get file contents and stat in parallel
      this.getFileContent(fullPath),
      fsp.stat(fullPath),
    ]).then(
      (result) => ({
        data: result[0],
        stat: result[1],
        filePath,
      }),
      (error) => {
        throw new ServerlessError(
          `Cannot read file ${filePath} due to: ${error.message}`,
          'CANNOT_READ_FILE'
        );
      }
    );
  },

  // Useful point of entry for e.g. transpilation plugins
  getFileContent(fullPath) {
    return fsp.readFile(fullPath);
  },
};

async function excludeNodeDevDependencies(serviceDir) {
  const exAndIn = {
    include: [],
    exclude: [],
  };

  // the files where we'll write the dependencies into
  const tmpDir = os.tmpdir();
  const randHash = crypto.randomBytes(8).toString('hex');
  const nodeDevDepFile = path.join(tmpDir, `node-dependencies-${randHash}-dev`);
  const nodeProdDepFile = path.join(tmpDir, `node-dependencies-${randHash}-prod`);

  try {
    const packageJsonFilePaths = glob.sync(
      [
        '**/package.json',
        // TODO add glob for node_modules filtering
      ],
      {
        cwd: serviceDir,
        dot: true,
        silent: true,
        follow: true,
        nosort: true,
      }
    );

    // filter out non node_modules file paths
    const packageJsonPaths = packageJsonFilePaths.filter((filePath) => {
      const isNodeModulesDir = !!filePath.match(/node_modules/);
      return !isNodeModulesDir;
    });

    if (!packageJsonPaths.length) return exAndIn;

    // Run each package directory sequentially to preserve the previous race-avoidance behavior.
    for (const packageJsonPath of packageJsonPaths) {
      const fullPath = path.join(serviceDir, packageJsonPath);
      const dirWithPackageJson = fullPath.replace(path.join(path.sep, 'package.json'), '');

      await Promise.all(
        ['dev', 'prod'].map(async (env) => {
          const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
          try {
            await execCommand(
              `npm ls --${env}=true --parseable=true --long=false --silent --all >> ${depFile}`,
              {
                cwd: dirWithPackageJson,
                // We are overriding `NODE_ENV` because when it is set to "production"
                // it causes invalid output of `npm ls` with `--dev=true`
                env: {
                  ...process.env,
                  NODE_ENV: null,
                },
              }
            );
          } catch {
            // Invalid package.json or npm ls failures should not crash packaging.
          }
        })
      );
    }

    const devAndProDependencies = [];
    for (const env of ['dev', 'prod']) {
      const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
      try {
        const fileContent = await readFile(depFile);
        devAndProDependencies.push(
          Array.from(new Set(fileContent.toString('utf8').split(/[\r\n]+/))).filter(Boolean)
        );
      } catch {
        devAndProDependencies.push([]);
      }
    }

    const devDependencies = devAndProDependencies[0];
    const prodDependencies = devAndProDependencies[1];

    const prodDependencySet = new Set(prodDependencies);
    const dependencies = devDependencies.filter((item) => !prodDependencySet.has(item));
    const nodeModulesRegex = new RegExp(`${path.join('node_modules', path.sep)}.*`, 'g');

    if (dependencies.length) {
      const globs = [];
      for (const dependency of dependencies) {
        const item = dependency.replace(path.join(serviceDir, path.sep), '');
        if (item.length <= 0 || !item.match(nodeModulesRegex)) continue;

        const packagePath = path.join(serviceDir, item, 'package.json');
        try {
          const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
          const lastIndex = item.lastIndexOf(path.sep) + 1;
          const moduleName = item.substr(lastIndex);
          const modulePath = item.substr(0, lastIndex);
          const bin = packageJson.bin;
          const baseGlobs = [path.join(item, '**')];

          if (typeof bin === 'object') {
            Object.keys(bin).forEach((executable) => {
              baseGlobs.push(path.join(modulePath, '.bin', executable));
            });
          } else if (typeof bin === 'string') {
            baseGlobs.push(path.join(modulePath, '.bin', moduleName));
          }

          globs.push(...baseGlobs);
        } catch {
          // Ignore unreadable package metadata, preserving previous best-effort behavior.
        }
      }

      exAndIn.exclude = exAndIn.exclude.concat(globs);
    }

    await Promise.all([
      fsp.unlink(nodeDevDepFile).catch(() => {}),
      fsp.unlink(nodeProdDepFile).catch(() => {}),
    ]);
    return exAndIn;
  } catch (e) {
    // fail silently
    return exAndIn;
  }
}
