'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const fsp = require('fs').promises;
const AdmZip = require('adm-zip');
const fse = require('fs-extra');
const { expect } = require('chai');

const download = require('../../../../../lib/utils/serverless-utils/download');

describe('serverless-utils/download', () => {
  let server;
  let baseUrl;
  let zipBuffer;
  let tmpDir;

  before(async () => {
    const zip = new AdmZip();
    zip.addFile('file.txt', Buffer.from('fixture'));
    zipBuffer = zip.toBuffer();

    server = http.createServer((req, res) => {
      if (req.url === '/layer-download?Signature=opaque') {
        res.statusCode = 200;
        res.end(zipBuffer);
        return;
      }

      if (req.url === '/content-disposition?Signature=opaque') {
        res.statusCode = 200;
        res.setHeader('Content-Disposition', 'attachment; filename="from-header.zip"');
        res.end(zipBuffer);
        return;
      }

      if (req.url === '/mime-fallback') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv');
        res.end(Buffer.from('a,b\n1,2\n'));
        return;
      }

      if (req.url === '/unknown-payload') {
        res.statusCode = 200;
        res.end(Buffer.from('plain text payload'));
        return;
      }

      res.statusCode = 404;
      res.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'serverless-download-'));
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  it('infers a filename from the downloaded file type when the URL has no extension', async () => {
    await download(`${baseUrl}/layer-download?Signature=opaque`, tmpDir);

    const stats = await fsp.lstat(path.join(tmpDir, 'layer-download.zip'));

    expect(stats.isFile()).to.equal(true);
  });

  it('prefers content-disposition over URL and content sniffing for saved filenames', async () => {
    await download(`${baseUrl}/content-disposition?Signature=opaque`, tmpDir);

    const stats = await fsp.lstat(path.join(tmpDir, 'from-header.zip'));

    expect(stats.isFile()).to.equal(true);
    expect(await fse.pathExists(path.join(tmpDir, 'content-disposition.zip'))).to.equal(false);
  });

  it('falls back to content-type when file-type cannot infer an extension', async () => {
    await download(`${baseUrl}/mime-fallback`, tmpDir);

    const filePath = path.join(tmpDir, 'mime-fallback.csv');

    expect(await fsp.readFile(filePath, 'utf8')).to.equal('a,b\n1,2\n');
  });

  it('preserves the bare basename when no extension can be inferred', async () => {
    await download(`${baseUrl}/unknown-payload`, tmpDir);

    const filePath = path.join(tmpDir, 'unknown-payload');

    expect(await fsp.readFile(filePath, 'utf8')).to.equal('plain text payload');
    expect(await fse.pathExists(path.join(tmpDir, 'unknown-payload.txt'))).to.equal(false);
  });

  it('extracts an opaque archive URL when extract is enabled', async () => {
    await download(`${baseUrl}/layer-download?Signature=opaque`, tmpDir, { extract: true });

    expect(await fsp.readFile(path.join(tmpDir, 'file.txt'), 'utf8')).to.equal('fixture');
  });
});
