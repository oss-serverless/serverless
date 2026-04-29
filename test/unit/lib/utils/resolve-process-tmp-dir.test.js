'use strict';

const fsp = require('fs').promises;
const path = require('path');
const requireUncached = require('../../../utils/require-uncached');

const { expect } = require('chai');

describe('test/unit/lib/utils/resolve-process-tmp-dir.test.js', () => {
  it('creates and reuses a process temp directory', async () => {
    const resolveProcessTmpDir = requireUncached(() =>
      require('../../../../lib/utils/resolve-process-tmp-dir')
    );

    const firstTmpDir = await resolveProcessTmpDir();
    const secondTmpDir = await resolveProcessTmpDir();

    expect(secondTmpDir).to.equal(firstTmpDir);
    expect(path.basename(firstTmpDir)).to.match(/^node-process-[0-9a-f]{4}-/);
    expect((await fsp.stat(firstTmpDir)).isDirectory()).to.equal(true);

    await fsp.rm(firstTmpDir, { recursive: true, force: true });
  });
});
