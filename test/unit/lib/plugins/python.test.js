'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const runServerless = require('../../../utils/run-serverless');
const OslsPythonRequirements = require('../../../../lib/plugins/python').default;

describe('lib/plugins/python', () => {
  describe('#shouldLoad()', () => {
    const shouldLoad = (pythonRequirements) =>
      OslsPythonRequirements.shouldLoad({
        serverless: {
          service: {
            custom:
              pythonRequirements === undefined ? undefined : { pythonRequirements },
          },
        },
      });

    it('loads when custom.pythonRequirements is configured', () => {
      expect(shouldLoad({})).to.equal(true);
      expect(shouldLoad({ dockerizePip: true })).to.equal(true);
      expect(shouldLoad(true)).to.equal(true);
    });

    it('does not load when the integration is absent or disabled', () => {
      expect(shouldLoad(undefined)).to.equal(false);
      expect(shouldLoad(false)).to.equal(false);
      expect(shouldLoad({ enabled: false })).to.equal(false);
  });
});

describe('lib/plugins/python/lib/shared', () => {
  let getDefaultUserCachePath;
  let getUserCachePath;
  let sha256Path;

  before(async () => {
    ({ getDefaultUserCachePath, getUserCachePath, sha256Path } = await import(
      '../../../../lib/plugins/python/lib/shared.js'
    ));
  });

  it('preserves the established cross-platform cache locations', () => {
    expect(getDefaultUserCachePath('darwin', { HOME: '/Users/alice' })).to.equal(
      path.join('/Users/alice', 'Library', 'Caches', 'serverless-python-requirements')
    );
    expect(
      getDefaultUserCachePath('linux', {
        HOME: '/home/alice',
        XDG_CACHE_HOME: '/home/alice/.custom-cache',
      })
    ).to.equal(path.join('/home/alice/.custom-cache', 'serverless-python-requirements'));
    expect(
      getDefaultUserCachePath('win32', {
        LOCALAPPDATA: 'C:\\Users\\alice\\AppData\\Local',
      })
    ).to.equal(
      path.join(
        'C:\\Users\\alice\\AppData\\Local',
        'ServerlessFramework',
        'serverless-python-requirements',
        'Cache'
      )
    );
  });

  it('honors an explicit cache location', () => {
    expect(getUserCachePath({ cacheLocation: 'custom-cache' })).to.equal(
      path.resolve('custom-cache')
    );
  });

  it('computes the stable requirements cache digest', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osls-python-sha256-'));
    const fixturePath = path.join(tmpDir, 'fixture.txt');
    fs.writeFileSync(fixturePath, 'sha256-file replacement fixture\n');

    try {
      expect(sha256Path(fixturePath)).to.equal(
        'e33168e29578cea2f7531a749b45a86fd70e076718001333f0705712594b4700'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

  it('loads as a core plugin when custom.pythonRequirements is present', async () => {
    const { serverless } = await runServerless({
      fixture: 'aws',
      command: 'print',
      configExt: {
        custom: {
          pythonRequirements: {},
        },
      },
    });

    expect(
      serverless.pluginManager.plugins.some(
        (plugin) => plugin instanceof OslsPythonRequirements
      )
    ).to.equal(true);
  });

  it('does not load as a core plugin without custom.pythonRequirements', async () => {
    const { serverless } = await runServerless({
      fixture: 'aws',
      command: 'print',
    });

    expect(
      serverless.pluginManager.plugins.some(
        (plugin) => plugin instanceof OslsPythonRequirements
      )
    ).to.equal(false);
  });

});
