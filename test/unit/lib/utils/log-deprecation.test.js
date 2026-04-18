'use strict';

const fsp = require('fs').promises;
const sandbox = require('sinon');
const expect = require('chai').expect;
const overrideEnv = require('process-utils/override-env');
const ServerlessError = require('../../../../lib/serverless-error');

describe('test/unit/lib/utils/logDeprecation.test.js', () => {
  let restoreEnv;

  beforeEach(() => {
    delete require.cache[require.resolve('../../../../lib/utils/log-deprecation')];
    delete require.cache[require.resolve('../../../../lib/utils/health-status-filename')];
    ({ restoreEnv } = overrideEnv({
      whitelist: ['APPDATA', 'HOME', 'PATH', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE'],
    }));
  });

  afterEach(async () => {
    sandbox.restore();
    const healthStatusFilename = require('../../../../lib/utils/health-status-filename');
    await fsp.unlink(healthStatusFilename).catch(() => null);
    restoreEnv();
  });

  it('should throw on deprecation if error notifications mode set in service config', () => {
    const logDeprecation = require('../../../../lib/utils/log-deprecation');
    let error;

    try {
      logDeprecation('CODE1', 'Start using deprecation log', {
        serviceConfig: { deprecationNotificationMode: 'error' },
      });
    } catch (thrownError) {
      error = thrownError;
    }

    expect(error).to.be.instanceOf(ServerlessError);
    expect(error).to.have.property('code', 'REJECTED_DEPRECATION_CODE1');
    expect(error.message).to.include('Start using deprecation log');
    expect(error.message).to.include(
      'More Info: https://github.com/oss-serverless/serverless/blob/main/docs/guides/deprecations.md#CODE1'
    );
  });

  it('should write deprecation docs URL to summary output', async () => {
    const logDeprecation = require('../../../../lib/utils/log-deprecation');
    const healthStatusFilename = require('../../../../lib/utils/health-status-filename');

    logDeprecation('CODE1', 'Start using deprecation log');
    await logDeprecation.printSummary();

    const summary = await fsp.readFile(healthStatusFilename, 'utf8');

    expect(summary).to.include('Start using deprecation log');
    expect(summary).to.include(
      'More info: https://github.com/oss-serverless/serverless/blob/main/docs/guides/deprecations.md#CODE1'
    );
  });
});
