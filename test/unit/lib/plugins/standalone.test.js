'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');

const { remove } = require('../../../../lib/utils/fs/remove');

const binaryTmpPath = path.resolve(os.tmpdir(), 'serverless-binary-tmp');

const createFetchResponse = (contents) => ({
  ok: true,
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(contents));
      controller.close();
    },
  }),
});

const loadStandalone = ({ binaryPath, removeStub, safeMoveFile } = {}) =>
  proxyquire('../../../../lib/plugins/standalone', {
    '../utils/standalone': {
      path: binaryPath,
      resolveLatestTag: sinon.stub().resolves('v999.0.0'),
      resolveUrl: sinon.stub().returns('https://example.com/serverless'),
    },
    '../utils/fs/remove': { remove: removeStub || remove },
    '../utils/fs/safe-move-file':
      safeMoveFile || require('../../../../lib/utils/fs/safe-move-file'),
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
    await remove(binaryTmpPath);
  });

  it('removes a stale temporary binary before upgrade download', async () => {
    const binaryPath = path.join(tmpDir, 'install', 'serverless');
    const removedPaths = [];
    const removeStub = async (targetPath) => {
      removedPaths.push(targetPath);
      await remove(targetPath);
    };
    await fsp.writeFile(binaryTmpPath, 'stale');
    await fsp.mkdir(path.dirname(binaryPath), { recursive: true });
    globalThis.fetch = sinon.stub().resolves(createFetchResponse('new binary'));
    const Standalone = loadStandalone({ binaryPath, removeStub });
    const standalone = new Standalone(
      { pluginManager: { commandRunStartTime: Date.now() } },
      { major: true }
    );

    await standalone.upgrade();

    expect(removedPaths).to.include(binaryTmpPath);
    expect(await fsp.readFile(binaryPath, 'utf8')).to.equal('new binary');
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
