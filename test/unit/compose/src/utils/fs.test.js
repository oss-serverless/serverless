'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');

const utilsFs = require('../../../../../lib/compose/utils/fs');
const { ensureDir, outputFile, outputFileSync, remove, removeSync } = require('../../../../lib/compose/fs');
const skipOnDisabledSymlinksInWindows = require('../../../../lib/compose/skip-on-disabled-symlinks-in-windows');

describe('test/unit/src/utils/fs.test.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'compose-fs-'));
  });

  afterEach(async () => {
    await remove(tmpDir);
  });

  it('detects JSON paths by exact lowercase suffix', () => {
    expect(utilsFs.isJsonPath('serverless-compose.json')).to.equal(true);
    expect(utilsFs.isJsonPath(path.join(tmpDir, 'nested', 'file.json'))).to.equal(true);
    expect(utilsFs.isJsonPath('serverless-compose.JSON')).to.equal(false);
    expect(utilsFs.isJsonPath('serverless-compose.json.bak')).to.equal(false);
    expect(utilsFs.isJsonPath('json')).to.equal(false);
  });

  it('detects YAML paths by exact lowercase suffix', () => {
    expect(utilsFs.isYamlPath('serverless-compose.yml')).to.equal(true);
    expect(utilsFs.isYamlPath('serverless-compose.yaml')).to.equal(true);
    expect(utilsFs.isYamlPath('serverless-compose.json')).to.equal(false);
    expect(utilsFs.isYamlPath('serverless-compose.yml.bak')).to.equal(false);
    expect(utilsFs.isYamlPath('serverless-compose.YAML')).to.equal(false);
  });

  it('checks existence only for regular files', async () => {
    const filePath = path.join(tmpDir, 'file.txt');
    const dirPath = path.join(tmpDir, 'directory');
    const missingPath = path.join(tmpDir, 'missing.txt');

    await outputFile(filePath, 'content');
    await ensureDir(dirPath);

    expect(await utilsFs.fileExists(filePath)).to.equal(true);
    expect(await utilsFs.fileExists(dirPath)).to.equal(false);
    expect(await utilsFs.fileExists(missingPath)).to.equal(false);
  });

  it('checks sync existence only for regular files', () => {
    const filePath = path.join(tmpDir, 'file.txt');
    const dirPath = path.join(tmpDir, 'directory');
    const missingPath = path.join(tmpDir, 'missing.txt');

    outputFileSync(filePath, 'content');
    fs.mkdirSync(dirPath);

    expect(utilsFs.fileExistsSync(filePath)).to.equal(true);
    expect(utilsFs.fileExistsSync(dirPath)).to.equal(false);
    expect(utilsFs.fileExistsSync(missingPath)).to.equal(false);
  });

  it('does not treat symlinks to files as files', async function () {
    const filePath = path.join(tmpDir, 'file.txt');
    const linkPath = path.join(tmpDir, 'link.txt');

    await outputFile(filePath, 'content');
    try {
      await fsp.symlink(filePath, linkPath);
    } catch (error) {
      skipOnDisabledSymlinksInWindows(error, this, () => removeSync(tmpDir));
      throw error;
    }

    expect(await utilsFs.fileExists(linkPath)).to.equal(false);
    expect(utilsFs.fileExistsSync(linkPath)).to.equal(false);
  });

  it('parses JSON, YAML, slsignore, and plain text contents', () => {
    expect(utilsFs.parseFile('config.json', '{"a":1}')).to.deep.equal({ a: 1 });
    expect(utilsFs.parseFile('config.yml', 'a: 1\n')).to.deep.equal({ a: 1 });
    expect(utilsFs.parseFile('.slsignore', 'node_modules\n.serverless\n')).to.deep.equal([
      'node_modules',
      '.serverless',
      '',
    ]);
    expect(utilsFs.parseFile('notes.txt', '  hello\n')).to.equal('hello');
  });

  it('parses unsafe object keys as own data without polluting prototypes', () => {
    const jsonContents = `{
      "__proto__": { "polluted": "json" },
      "constructor": "json-ctor",
      "prototype": "json-proto"
    }`;
    const yamlContents = [
      '__proto__:',
      '  polluted: yaml',
      'constructor: yaml-ctor',
      'prototype: yaml-proto',
      '',
    ].join('\n');

    const jsonResult = utilsFs.parseFile('config.json', jsonContents);
    const yamlResult = utilsFs.parseFile('config.yml', yamlContents);

    expect(Object.getPrototypeOf(jsonResult)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(jsonResult, '__proto__').value).to.deep.equal({
      polluted: 'json',
    });
    expect(jsonResult.constructor).to.equal('json-ctor');
    expect(jsonResult.prototype).to.equal('json-proto');
    expect(jsonResult.polluted).to.equal(undefined);

    expect(Object.getPrototypeOf(yamlResult)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(yamlResult, '__proto__').value).to.deep.equal({
      polluted: 'yaml',
    });
    expect(yamlResult.constructor).to.equal('yaml-ctor');
    expect(yamlResult.prototype).to.equal('yaml-proto');
    expect(yamlResult.polluted).to.equal(undefined);

    expect({}.polluted).to.equal(undefined);
  });

  it('passes YAML options without letting caller filename override the parsed file path', () => {
    const load = sinon.stub().returns({ parsed: true });
    const parseFile = proxyquire('../../../../../lib/compose/utils/fs/parseFile', {
      'js-yaml': { load },
    });
    const filePath = path.join(tmpDir, 'actual.yml');
    const options = JSON.parse(`{
      "filename": "caller.yml",
      "schema": "custom-schema",
      "__proto__": { "polluted": "yes" },
      "constructor": "ctor",
      "prototype": "proto"
    }`);

    const result = parseFile(filePath, Buffer.from('name: test'), options);

    expect(result).to.deep.equal({ parsed: true });
    expect(load).to.have.been.calledOnce;
    const [contents, yamlOptions] = load.firstCall.args;
    expect(contents).to.equal('name: test');
    expect(yamlOptions.filename).to.equal(filePath);
    expect(yamlOptions.schema).to.equal('custom-schema');
    expect(yamlOptions.constructor).to.equal('ctor');
    expect(yamlOptions.prototype).to.equal('proto');
    expect(Object.getPrototypeOf(yamlOptions)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(yamlOptions, '__proto__').value).to.deep.equal({
      polluted: 'yes',
    });
    expect(yamlOptions.polluted).to.equal(undefined);
    expect({}.polluted).to.equal(undefined);
    expect(options.filename).to.equal('caller.yml');
    expect(options.schema).to.equal('custom-schema');
    expect(options.constructor).to.equal('ctor');
    expect(options.prototype).to.equal('proto');
    expect(Object.getOwnPropertyDescriptor(options, '__proto__').value).to.deep.equal({
      polluted: 'yes',
    });
  });

  it('readFile forwards optional parse options', async () => {
    const parseFile = sinon.stub().returns({ parsed: true });
    const readFile = proxyquire('../../../../../lib/compose/utils/fs/readFile', {
      './parseFile': parseFile,
    });
    const filePath = path.join(tmpDir, 'config.yml');
    const options = { custom: true };

    await outputFile(filePath, 'name: test\n');

    expect(await readFile(filePath, options)).to.deep.equal({ parsed: true });
    expect(parseFile).to.have.been.calledOnce;
    expect(parseFile.firstCall.args).to.deep.equal([filePath, 'name: test\n', options]);
  });

  it('readFileSync forwards optional parse options', () => {
    const parseFile = sinon.stub().returns({ parsed: true });
    const readFileSync = proxyquire('../../../../../lib/compose/utils/fs/readFileSync', {
      './parseFile': parseFile,
    });
    const filePath = path.join(tmpDir, 'config.yml');
    const options = { custom: true };

    outputFileSync(filePath, 'name: test\n');

    expect(readFileSync(filePath, options)).to.deep.equal({ parsed: true });
    expect(parseFile).to.have.been.calledOnce;
    expect(parseFile.firstCall.args).to.deep.equal([filePath, 'name: test\n', options]);
  });

  it('writeFile formats structured content based on file extension', async () => {
    const jsonPath = path.join(tmpDir, 'state.json');
    const yamlPath = path.join(tmpDir, 'state.yml');
    const textPath = path.join(tmpDir, 'notes.txt');

    await utilsFs.writeFile(jsonPath, { a: 1 });
    await utilsFs.writeFile(yamlPath, { a: 1 });
    await utilsFs.writeFile(textPath, 'raw text');

    expect(await fsp.readFile(jsonPath, 'utf8')).to.equal(JSON.stringify({ a: 1 }, null, 2));
    expect(await fsp.readFile(yamlPath, 'utf8')).to.equal('a: 1\n');
    expect(await fsp.readFile(textPath, 'utf8')).to.equal('raw text');
  });

  it('writes files in nested directories', async () => {
    const filePath = path.join(tmpDir, 'nested', 'state.json');

    await utilsFs.writeFile(filePath, { a: 1 });

    expect(await fsp.readFile(filePath, 'utf8')).to.equal(JSON.stringify({ a: 1 }, null, 2));
  });
});
