'use strict';

const fs = require('node:fs').promises;
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const proxyquire = require('proxyquire');
const { expect } = require('chai');
const sinon = require('sinon');

const calculateCacheHash = require('../../../../../lib/compose/utils/cache-hash');
const { outputFile, remove } = require('../../../../lib/compose/fs');

const md5Hex = (input) => crypto.createHash('md5').update(input).digest('hex');

const expectedCacheHashForContents = (contents) =>
  md5Hex(
    contents
      .map((content) => md5Hex(Buffer.isBuffer(content) ? content : Buffer.from(content)))
      .sort()
      .join()
  );

describe('test/unit/src/utils/cache-hash.test.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compose-cache-hash-'));
  });

  afterEach(async () => {
    await remove(tmpDir);
  });

  it('calculates the md5 cache hash contract for a single file', async () => {
    const contents = 'module.exports = 1;\n';
    await outputFile(path.join(tmpDir, 'handler.js'), contents);

    expect(await calculateCacheHash(['handler.js'], tmpDir)).to.equal(
      md5Hex(md5Hex(Buffer.from(contents)))
    );
  });

  it('calculates cache hashes independently of cache pattern order', async () => {
    await Promise.all([
      outputFile(path.join(tmpDir, 'a.txt'), 'aaa\n'),
      outputFile(path.join(tmpDir, 'b.txt'), 'bbb\n'),
      outputFile(path.join(tmpDir, 'c.txt'), 'ccc\n'),
    ]);

    const expected = expectedCacheHashForContents(['aaa\n', 'bbb\n', 'ccc\n']);

    expect(await calculateCacheHash(['a.txt', 'b.txt', 'c.txt'], tmpDir)).to.equal(expected);
    expect(await calculateCacheHash(['c.txt', 'a.txt', 'b.txt'], tmpDir)).to.equal(expected);
  });

  it('sorts cache file hashes instead of file paths', async () => {
    const contentsByHash = ['first\n', 'second\n']
      .map((contents) => ({ contents, hash: md5Hex(Buffer.from(contents)) }))
      .sort((a, b) => a.hash.localeCompare(b.hash));
    const [lowerHashEntry, higherHashEntry] = contentsByHash;

    await Promise.all([
      outputFile(path.join(tmpDir, 'a.txt'), higherHashEntry.contents),
      outputFile(path.join(tmpDir, 'z.txt'), lowerHashEntry.contents),
    ]);

    const expected = md5Hex([lowerHashEntry.hash, higherHashEntry.hash].join());
    const pathOrderedHash = md5Hex([higherHashEntry.hash, lowerHashEntry.hash].join());

    expect(expected).to.not.equal(pathOrderedHash);
    expect(await calculateCacheHash(['*.txt'], tmpDir)).to.equal(expected);
  });

  it('counts duplicate file contents when calculating cache hashes', async () => {
    await Promise.all([
      outputFile(path.join(tmpDir, 'one.txt'), 'same\n'),
      outputFile(path.join(tmpDir, 'two.txt'), 'same\n'),
    ]);

    const fileHash = md5Hex(Buffer.from('same\n'));
    const expected = md5Hex([fileHash, fileHash].sort().join());
    const actual = await calculateCacheHash(['*.txt'], tmpDir);

    expect(actual).to.equal(expected);
    expect(actual).to.not.equal(md5Hex(fileHash));
  });

  it('does not include file paths in cache hashes', async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compose-cache-hash-other-'));

    try {
      await outputFile(path.join(tmpDir, 'one.txt'), 'content\n');
      await outputFile(path.join(otherDir, 'nested', 'different-name.js'), 'content\n');

      expect(await calculateCacheHash(['one.txt'], tmpDir)).to.equal(
        await calculateCacheHash(['nested/different-name.js'], otherDir)
      );
    } finally {
      await remove(otherDir);
    }
  });

  it('hashes binary cache pattern files as raw bytes', async () => {
    const contents = Buffer.from([0x00, 0xff, 0x80, 0x0a]);
    await outputFile(path.join(tmpDir, 'binary.bin'), contents);

    expect(await calculateCacheHash(['binary.bin'], tmpDir)).to.equal(
      expectedCacheHashForContents([contents])
    );
  });

  it('returns the md5 of an empty string when no cache pattern files match', async () => {
    expect(await calculateCacheHash(['does-not-exist/**/*'], tmpDir)).to.equal(
      'd41d8cd98f00b204e9800998ecf8427e'
    );
  });

  it('includes empty files in cache hashes', async () => {
    await outputFile(path.join(tmpDir, 'empty.txt'), '');

    const actual = await calculateCacheHash(['empty.txt'], tmpDir);

    expect(actual).to.equal(expectedCacheHashForContents([Buffer.alloc(0)]));
    expect(actual).to.not.equal('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('uses comma-separated file hashes for the aggregate cache hash', async () => {
    await Promise.all([
      outputFile(path.join(tmpDir, 'a.txt'), 'a'),
      outputFile(path.join(tmpDir, 'b.txt'), 'b'),
    ]);

    const hashes = [md5Hex(Buffer.from('a')), md5Hex(Buffer.from('b'))].sort();
    const actual = await calculateCacheHash(['*.txt'], tmpDir);

    expect(actual).to.equal(md5Hex(hashes.join()));
    expect(actual).to.not.equal(md5Hex(hashes.join('')));
  });

  it('rejects when a matched cache pattern file cannot be read', async () => {
    const calculateCacheHashWithMissingFile = proxyquire(
      '../../../../../lib/compose/utils/cache-hash',
      {
        './glob': sinon.stub().resolves(['missing.txt']),
      }
    );

    await expect(calculateCacheHashWithMissingFile(['**/*'], tmpDir)).to.be.rejected;
  });
});
