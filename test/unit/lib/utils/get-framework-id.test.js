'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const fse = require('fs-extra');
const { expect } = require('chai');
const requireUncached = require('ncjsm/require-uncached');
const sinon = require('sinon');
const overrideEnv = require('process-utils/override-env');
const overrideCwd = require('process-utils/override-cwd');

const withIsolatedHome = async (name, callback) => {
  const homeDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `${name}-home-`));

  return overrideEnv({ asCopy: true }, async () => {
    const homedirStub = sinon.stub(os, 'homedir').returns(homeDir);

    try {
      return await callback(homeDir);
    } finally {
      homedirStub.restore();
      await fse.remove(homeDir);
    }
  });
};

describe('lib/utils/get-framework-id', () => {
  it('returns a stable frameworkId from the vendored config helper', async () => {
    await withIsolatedHome('get-framework-id', async (homeDir) => {
      const serviceDir = path.join(homeDir, 'service');
      await fse.ensureDir(serviceDir);

      const { restoreCwd } = overrideCwd(serviceDir);

      try {
        const getFrameworkId = requireUncached(() =>
          require('../../../../lib/utils/get-framework-id')
        );

        const firstValue = getFrameworkId();
        const secondValue = getFrameworkId();

        expect(firstValue).to.be.a('string');
        expect(secondValue).to.equal(firstValue);
      } finally {
        restoreCwd();
      }
    });
  });
});
