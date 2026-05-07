'use strict';

const chai = require('chai');

const expect = chai.expect;

const path = require('path');
const fsp = require('fs').promises;
const readConfiguration = require('../../../../../lib/compose/configuration/read');
const { ensureDir, remove } = require('../../../../lib/compose/fs');

describe('test/unit/src/configuration/read.test.js', () => {
  let configurationPath;

  afterEach(async () => {
    if (configurationPath) await fsp.unlink(configurationPath);
    configurationPath = null;
  });

  it('should read "serverless-compose.yml"', async () => {
    configurationPath = 'serverless-compose.yml';
    await fsp.writeFile(
      configurationPath,
      'name: test-yml\nservices:\n  resources: \n    path: resources\n'
    );
    expect(await readConfiguration(configurationPath)).to.deep.equal({
      name: 'test-yml',
      services: { resources: { path: 'resources' } },
    });
  });

  it('should read "serverless-compose.yaml"', async () => {
    configurationPath = 'serverless-compose.yaml';
    await fsp.writeFile(
      configurationPath,
      'name: test-yaml\nservices:\n  resources: \n    path: resources\n'
    );
    expect(await readConfiguration(configurationPath)).to.deep.equal({
      name: 'test-yaml',
      services: { resources: { path: 'resources' } },
    });
  });

  it('should read "serverless-compose.json"', async () => {
    configurationPath = 'serverless-compose.json';
    const configuration = {
      name: 'test-json',
      services: { resources: { path: 'resources' } },
    };
    await fsp.writeFile(configurationPath, JSON.stringify(configuration));
    expect(await readConfiguration(configurationPath)).to.deep.equal(configuration);
  });

  it('should read "serverless-compose.js"', async () => {
    configurationPath = 'serverless-compose.js';
    const configuration = {
      name: 'test-js',
      services: { resources: { path: 'resources' } },
    };
    await fsp.writeFile(configurationPath, `module.exports = ${JSON.stringify(configuration)}`);
    expect(await readConfiguration(path.resolve(configurationPath))).to.deep.equal(configuration);
  });

  it('should read "serverless-compose.ts"', async () => {
    await ensureDir('node_modules');
    try {
      await fsp.writeFile('node_modules/ts-node.js', 'module.exports.register = () => null;');
      configurationPath = 'serverless-compose.ts';
      const configuration = {
        name: 'test-ts',
        services: { resources: { path: 'resources' } },
      };
      await fsp.writeFile(configurationPath, `module.exports = ${JSON.stringify(configuration)}`);
      expect(await readConfiguration(path.resolve(configurationPath))).to.deep.equal(configuration);
    } finally {
      await remove('node_modules');
    }
  });

  it('should register ts-node only if it is not already registered', async () => {
    try {
      expect(process[Symbol.for('ts-node.register.instance')]).to.be.undefined;
      process[Symbol.for('ts-node.register.instance')] = 'foo';
      configurationPath = 'serverless-compose.ts';
      const configuration = {
        name: 'test-ts',
        services: { resources: { path: 'resources' } },
      };
      await fsp.writeFile(configurationPath, `module.exports = ${JSON.stringify(configuration)}`);
      expect(await readConfiguration(path.resolve(configurationPath))).to.deep.equal(configuration);
    } finally {
      delete process[Symbol.for('ts-node.register.instance')];
    }
  });

  it('should reject YAML syntax error', async () => {
    configurationPath = 'serverless-compose.yaml';
    await fsp.writeFile(configurationPath, 'service: test-yaml\np [\nr\novider:\n  name: aws\n');
    await expect(readConfiguration(configurationPath)).to.eventually.be.rejected.and.have.property(
      'code',
      'COMPOSE_CONFIGURATION_PARSE_ERROR'
    );
  });

  it('should reject JSON syntax error', async () => {
    configurationPath = 'serverless-compose.json';
    await fsp.writeFile(configurationPath, '{foom,sdfs}');
    await expect(readConfiguration(configurationPath)).to.eventually.be.rejected.and.have.property(
      'code',
      'CONFIGURATION_PARSE_ERROR'
    );
  });

  it('should reject non object configuration', async () => {
    configurationPath = 'serverless-compose.json';
    await fsp.writeFile(configurationPath, JSON.stringify([]));
    await expect(readConfiguration(configurationPath)).to.eventually.be.rejected.and.have.property(
      'code',
      'INVALID_COMPOSE_CONFIGURATION_FORMAT'
    );
  });

  it('should reject non JSON like structures', async () => {
    // Different file name to avoid caching
    configurationPath = 'serverless-compose-other.js';
    await fsp.writeFile(configurationPath, 'exports.foo = exports');
    await expect(
      readConfiguration(path.resolve(configurationPath))
    ).to.eventually.be.rejected.and.have.property(
      'code',
      'INVALID_COMPOSE_CONFIGURATION_STRUCTURE'
    );
  });

  it('preserves nested own unsafe keys as data when reading configuration', async () => {
    configurationPath = 'serverless-compose-unsafe.json';
    await fsp.writeFile(
      configurationPath,
      '{"services":{"resources":{"path":"resources","params":{"__proto__":{"value":"ok"}}}}}'
    );

    const configuration = await readConfiguration(configurationPath);

    expect(
      Object.getOwnPropertyDescriptor(configuration.services.resources.params, '__proto__').value
    ).to.deep.equal({ value: 'ok' });
  });
});
