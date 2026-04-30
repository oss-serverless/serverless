'use strict';

const path = require('path');
const fsp = require('fs').promises;
const spawn = require('../../lib/utils/spawn');
const { ensureDir, getTmpDirPath } = require('../utils/fs');
const { expect } = require('chai');

const serverlessExec = require('../serverless-binary');

const fixturesPath = path.resolve(__dirname, '../fixtures/programmatic');

describe('test/integration/create.test.js', function () {
  this.timeout(1000 * 60 * 2);

  it('should generate scaffolding from local template in provided path and rename service', async () => {
    const tmpDir = getTmpDirPath();
    await spawn(serverlessExec, [
      'create',
      '--template-path',
      path.join(fixturesPath, 'aws'),
      '--path',
      tmpDir,
      '--name',
      'new-service-name',
    ]);
    const dirContent = await fsp.readdir(tmpDir);
    expect(dirContent).to.include('serverless.yml');

    const serverlessYmlfileContent = (
      await fsp.readFile(path.join(tmpDir, 'serverless.yml'))
    ).toString();
    expect(serverlessYmlfileContent).to.include('service: new-service-name');
  });

  it('should default the local service name to the target directory basename when only --path is provided', async () => {
    const tmpDir = path.join(getTmpDirPath(), 'nested', 'custom-target-directory');
    await spawn(serverlessExec, [
      'create',
      '--template-path',
      path.join(fixturesPath, 'aws'),
      '--path',
      tmpDir,
    ]);

    const serverlessYmlfileContent = (
      await fsp.readFile(path.join(tmpDir, 'serverless.yml'))
    ).toString();
    expect(serverlessYmlfileContent).to.include('service: custom-target-directory');
  });

  it('should error out when trying to create project in already existing directory', async () => {
    const tmpDir = getTmpDirPath();
    await ensureDir(tmpDir);
    let err;
    try {
      await spawn(serverlessExec, [
        'create',
        '--template-path',
        path.join(fixturesPath, 'aws'),
        '--path',
        tmpDir,
      ]);
    } catch (e) {
      err = e;
    }
    expect(
      `${err.stdoutBuffer ? err.stdoutBuffer.toString() : ''}${
        err.stderrBuffer ? err.stderrBuffer.toString() : ''
      }`
    ).to.contain('already exists');
  });
});
