'use strict';

const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { expect } = require('chai');

const resolveConfigurationPath = require('../../../../../lib/compose/configuration/resolve-path');
const { ensureDir, outputFile, remove } = require('../../../../lib/compose/fs');

describe('test/unit/src/configuration/resolve-path.test.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compose-resolve-path-'));
  });

  afterEach(async () => {
    await remove(tmpDir);
  });

  it('resolves the first existing compose config by supported extension order', async () => {
    const yamlPath = path.join(tmpDir, 'serverless-compose.yaml');
    const jsonPath = path.join(tmpDir, 'serverless-compose.json');
    const ymlPath = path.join(tmpDir, 'serverless-compose.yml');

    await outputFile(jsonPath, '{}');
    await outputFile(yamlPath, 'services: {}\n');

    expect(await resolveConfigurationPath(tmpDir)).to.equal(yamlPath);

    await outputFile(ymlPath, 'services: {}\n');

    expect(await resolveConfigurationPath(tmpDir)).to.equal(ymlPath);
  });

  it('ignores directories named like compose config files', async () => {
    await ensureDir(path.join(tmpDir, 'serverless-compose.yml'));

    await expect(resolveConfigurationPath(tmpDir)).to.eventually.be.rejected.and.have.property(
      'code',
      'CONFIGURATION_FILE_NOT_FOUND'
    );
  });

  it('rejects when no compose config file exists', async () => {
    await expect(resolveConfigurationPath(tmpDir)).to.eventually.be.rejected.and.have.property(
      'code',
      'CONFIGURATION_FILE_NOT_FOUND'
    );
  });
});
