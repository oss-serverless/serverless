'use strict';

const { expect } = require('chai');
const overrideArgv = require('process-utils/override-argv');
const resolveInput = require('../../../../../lib/cli/resolve-input');
const renderHelp = require('../../../../../lib/cli/render-help');
const observeOutput = require('../../../../lib/observe-output');

describe('test/unit/lib/cli/render-help/index.test.js', () => {
  it('should show general help on main command', async () => {
    resolveInput.clear();
    const output = await overrideArgv(
      {
        args: ['serverless', '--help'],
      },
      () => observeOutput(() => renderHelp(new Set()))
    );
    expect(output).to.have.string('Usage');
    expect(output).to.have.string('deploy function');
  });

  it('should show general help on help command', async () => {
    resolveInput.clear();
    const output = await overrideArgv(
      {
        args: ['serverless', 'help'],
      },
      () => observeOutput(() => renderHelp(new Set()))
    );
    expect(output).to.have.string('Usage');
    expect(output).to.have.string('deploy function');
  });

  it('should show specific command help with specific command', async () => {
    resolveInput.clear();
    const output = await overrideArgv(
      {
        args: ['serverless', 'deploy', '--help'],
      },
      () => {
        const { commandsSchema } = resolveInput();
        return {
          commandsSchema,
          observedOutput: observeOutput(() => renderHelp(new Set())),
        };
      }
    );
    expect(output.observedOutput).to.have.string('deploy');
    expect(output.observedOutput).to.have.string('deploy function');
    expect(output.observedOutput).to.have.string('--help');
    expect(output.observedOutput).to.have.string(output.commandsSchema.get('deploy').usage);
    expect(output.observedOutput).to.have.string(
      output.commandsSchema.get('deploy function').usage
    );
  });
});
