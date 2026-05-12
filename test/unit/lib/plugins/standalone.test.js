'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');

const { remove } = require('../../../../lib/utils/fs/remove');

const loadStandalone = ({ binaryPath, removeStub } = {}) =>
  proxyquire('../../../../lib/plugins/standalone', {
    '../utils/standalone': {
      path: binaryPath,
      resolveLatestTag: sinon.stub().throws(new Error('Unexpected latest tag lookup')),
      resolveUrl: sinon.stub().throws(new Error('Unexpected download URL lookup')),
    },
    '../utils/fs/remove': { remove: removeStub || remove },
  });

describe('test/unit/lib/plugins/standalone.test.js', () => {
  let tmpDir;
  let originalFetch;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'standalone-plugin-'));
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await remove(tmpDir);
  });

  it('rejects upgrade because the command is deprecated', async () => {
    const binaryPath = path.join(tmpDir, 'install', 'serverless');
    globalThis.fetch = sinon.stub().throws(new Error('Unexpected download'));
    const Standalone = loadStandalone({ binaryPath });
    const standalone = new Standalone(
      { pluginManager: { commandRunStartTime: Date.now() } },
      { major: true }
    );

    let error;
    try {
      await standalone.upgrade();
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).to.have.property('code', 'STANDALONE_UPGRADE_COMMAND_DEPRECATED');
    expect(error.message).to.include('npm install -g osls@latest');
    expect(globalThis.fetch).to.not.have.been.called;
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
