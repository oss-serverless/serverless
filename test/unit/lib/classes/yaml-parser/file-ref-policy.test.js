'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { expect } = require('chai');
const { getTmpDirPath } = require('../../../../utils/fs');
const skipOnDisabledSymlinksInWindows = require('../../../../lib/skip-on-disabled-symlinks-in-windows');
const {
  assertFileRefAllowed,
  normalizeFileRefOptions,
} = require('../../../../../lib/classes/yaml-parser/file-ref-policy');

describe('yaml-parser/file-ref-policy', () => {
  const expectAccessDenied = (promise) =>
    expect(promise).to.be.rejected.then((err) => {
      expect(err.code).to.equal('YAML_REF_ACCESS_DENIED');
    });
  const expectOptionsError = (promise) =>
    expect(promise).to.be.rejected.then((err) => {
      expect(err.code).to.equal('YAML_REF_OPTIONS_ERROR');
    });

  const writeFile = (filePath) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'foo: bar\n');
  };

  it('allows file refs by default for v3 compatibility', async () => {
    const tmpDirPath = getTmpDirPath();
    const options = await normalizeFileRefOptions(tmpDirPath);

    await expect(
      assertFileRefAllowed(pathToFileURL(path.join(tmpDirPath, 'outside.yml')).href, options)
    ).to.be.fulfilled;
  });

  it('allows file refs inside configured roots', async () => {
    const tmpDirPath = getTmpDirPath();
    const serviceDirPath = path.join(tmpDirPath, 'service');
    const sharedDirPath = path.join(tmpDirPath, 'shared');
    const serviceRefPath = path.join(serviceDirPath, 'ref.yml');
    const sharedRefPath = path.join(sharedDirPath, 'ref.yml');

    writeFile(serviceRefPath);
    writeFile(sharedRefPath);

    const options = await normalizeFileRefOptions(serviceDirPath, {
      allowedRoots: ['.', '../shared'],
    });

    await expect(assertFileRefAllowed(pathToFileURL(serviceRefPath).href, options)).to.be.fulfilled;
    await expect(assertFileRefAllowed(pathToFileURL(sharedRefPath).href, options)).to.be.fulfilled;
  });

  it('allows file refs inside file URL roots', async () => {
    const tmpDirPath = getTmpDirPath();
    const serviceDirPath = path.join(tmpDirPath, 'service');
    const sharedDirPath = path.join(tmpDirPath, 'shared');
    const sharedRefPath = path.join(sharedDirPath, 'ref.yml');

    writeFile(sharedRefPath);

    const options = await normalizeFileRefOptions(serviceDirPath, {
      allowedRoots: pathToFileURL(sharedDirPath).href,
    });

    await expect(assertFileRefAllowed(pathToFileURL(sharedRefPath).href, options)).to.be.fulfilled;
  });

  it('blocks explicit file URL refs outside configured roots', async () => {
    const tmpDirPath = getTmpDirPath();
    const serviceDirPath = path.join(tmpDirPath, 'service');
    const outsidePath = path.join(tmpDirPath, 'outside.yml');

    writeFile(path.join(serviceDirPath, 'serverless.yml'));
    writeFile(outsidePath);

    const options = await normalizeFileRefOptions(serviceDirPath, { allowedRoots: ['.'] });

    await expectAccessDenied(assertFileRefAllowed(pathToFileURL(outsidePath).href, options));
  });

  it('blocks non-file URLs when an allowed root policy is active', async () => {
    const options = await normalizeFileRefOptions(getTmpDirPath(), { allowedRoots: ['.'] });

    await expectAccessDenied(assertFileRefAllowed('https://example.com/ref.yml', options));
  });

  it('rejects invalid file root options', async () => {
    await expectOptionsError(normalizeFileRefOptions(getTmpDirPath(), []));
    await expectOptionsError(
      normalizeFileRefOptions(getTmpDirPath(), { allowedRoots: ['file://%'] })
    );
  });

  it('blocks symlink escapes outside configured roots', async function () {
    const tmpDirPath = getTmpDirPath();
    const serviceDirPath = path.join(tmpDirPath, 'service');
    const outsidePath = path.join(tmpDirPath, 'outside.yml');
    const linkPath = path.join(serviceDirPath, 'link.yml');

    writeFile(path.join(serviceDirPath, 'serverless.yml'));
    writeFile(outsidePath);

    try {
      fs.symlinkSync(outsidePath, linkPath, 'file');
    } catch (error) {
      skipOnDisabledSymlinksInWindows(error, this);
      throw error;
    }

    const options = await normalizeFileRefOptions(serviceDirPath, { allowedRoots: ['.'] });

    await expectAccessDenied(assertFileRefAllowed(pathToFileURL(linkPath).href, options));
  });
});
