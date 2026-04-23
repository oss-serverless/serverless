'use strict';

const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const fse = require('fs-extra');
const { expect } = require('chai');

const glob = require('../../../../lib/utils/glob');

describe('test/unit/lib/utils/glob.test.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'serverless-glob-'));
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  it('matches globby order-sensitive leading negation behavior for async and sync calls', async () => {
    await Promise.all([
      fse.outputFile(path.join(tmpDir, 'keep.js'), 'keep\n'),
      fse.outputFile(path.join(tmpDir, 'keep.ts'), 'keep\n'),
      fse.outputFile(path.join(tmpDir, 'ignored', 'drop.js'), 'drop\n'),
      fse.outputFile(path.join(tmpDir, 'ignored', 'drop.ts'), 'drop\n'),
    ]);

    expect(
      (await glob(['!ignored/**/*', '**/*.js', '**/*.ts'], { cwd: tmpDir })).sort()
    ).to.deep.equal(['ignored/drop.js', 'ignored/drop.ts', 'keep.js', 'keep.ts']);
    expect(
      glob.sync(['!ignored/**/*', '**/*.js', '**/*.ts'], { cwd: tmpDir }).sort()
    ).to.deep.equal(['ignored/drop.js', 'ignored/drop.ts', 'keep.js', 'keep.ts']);
  });

  it('applies later negations to earlier positives and still supports re-inclusion', async () => {
    await Promise.all([
      fse.outputFile(path.join(tmpDir, 'keep.js'), 'keep\n'),
      fse.outputFile(path.join(tmpDir, 'ignored', 'drop.js'), 'drop\n'),
      fse.outputFile(path.join(tmpDir, 'ignored', 'reinclude.js'), 'reinclude\n'),
    ]);

    expect(
      (await glob(['**/*.js', '!ignored/**/*', 'ignored/reinclude.js'], { cwd: tmpDir })).sort()
    ).to.deep.equal(['ignored/reinclude.js', 'keep.js']);
    expect(
      glob.sync(['**/*.js', '!ignored/**/*', 'ignored/reinclude.js'], { cwd: tmpDir }).sort()
    ).to.deep.equal(['ignored/reinclude.js', 'keep.js']);
  });
});
