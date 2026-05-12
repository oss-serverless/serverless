'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire');
const { expect } = require('chai');

const { remove } = require('../../../../lib/utils/fs/remove');

const loadStandalone = ({ binaryPath, removeStub } = {}) =>
  proxyquire('../../../../lib/plugins/standalone', {
    '../utils/standalone': {
      path: binaryPath,
    },
    '../utils/fs/remove': { remove: removeStub || remove },
  });

describe('test/unit/lib/plugins/standalone.test.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'standalone-plugin-'));
  });

  afterEach(async () => {
    await remove(tmpDir);
  });

  it('recursively removes the standalone install directory on uninstall', async () => {
    const binaryPath = path.join(tmpDir, 'install', 'bin', 'serverless');
    await fsp.mkdir(path.dirname(binaryPath), { recursive: true });
    await fsp.writeFile(binaryPath, 'binary');
    await fsp.writeFile(path.join(tmpDir, 'install', 'config.json'), '{}');
    const Standalone = loadStandalone({ binaryPath });
    const standalone = new Standalone({ pluginManager: { commandRunStartTime: Date.now() } }, {});

    await standalone.uninstall();

    expect(fs.existsSync(path.dirname(binaryPath))).to.equal(false);
  });
});
