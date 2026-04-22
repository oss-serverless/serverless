'use strict';

const { expect } = require('chai');
const overrideArgv = require('process-utils/override-argv');
const ServerlessError = require('../../../../lib/serverless-error');
const { triggeredDeprecations } = require('../../../../lib/utils/log-deprecation');
const ensureSupportedCommand = require('../../../../lib/cli/ensure-supported-command');

describe('test/unit/lib/cli/ensure-supported-command.test.js', () => {
  it('should do nothing on valid command', async () => {
    triggeredDeprecations.clear();
    overrideArgv(
      {
        args: ['serverless', 'help'],
      },
      () => ensureSupportedCommand()
    );
  });

  it('should do nothing on container command', async () => {
    triggeredDeprecations.clear();
    overrideArgv(
      {
        args: ['serverless', 'plugin'],
      },
      () => ensureSupportedCommand()
    );
  });

  it('should reject invalid command', async () => {
    triggeredDeprecations.clear();
    overrideArgv(
      {
        args: ['serverless', 'hablo'],
      },
      () =>
        expect(() => ensureSupportedCommand())
          .to.throw(ServerlessError)
          .with.property('code', 'UNRECOGNIZED_CLI_COMMAND')
    );
  });

  it('should report invalid options', async () => {
    triggeredDeprecations.clear();
    overrideArgv(
      {
        args: ['serverless', 'deploy', '--hadsfa'],
      },
      () =>
        expect(() => ensureSupportedCommand())
          .to.throw(ServerlessError)
          .with.property('code', 'UNSUPPORTED_CLI_OPTIONS')
    );
  });

  it('should reject missing options', async () => {
    triggeredDeprecations.clear();
    overrideArgv(
      {
        args: ['serverless', 'config', 'credentials'],
      },
      () =>
        expect(() => ensureSupportedCommand())
          .to.throw(ServerlessError)
          .with.property('code', 'MISSING_REQUIRED_CLI_OPTION')
    );
  });
});
