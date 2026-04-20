'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const requireUncached = require('ncjsm/require-uncached');

const configureInquirerStub = require('../../../../lib/configure-inquirer-stub');

describe('serverless-utils/inquirer', () => {
  let originalIsTTY;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
  });

  afterEach(() => {
    if (originalIsTTY === undefined) {
      delete process.stdin.isTTY;
    } else {
      process.stdin.isTTY = originalIsTTY;
    }
    sinon.restore();
  });

  it('wraps inquirer without breaking prompt behavior', async () => {
    const inquirer = requireUncached(() =>
      require('../../../../../lib/utils/serverless-utils/inquirer')
    );

    configureInquirerStub(inquirer, {
      confirm: {
        shouldConfirm: true,
      },
    });

    const result = await inquirer.prompt({
      message: 'Should?',
      type: 'confirm',
      name: 'shouldConfirm',
    });

    expect(result.shouldConfirm).to.equal(true);
  });
});
