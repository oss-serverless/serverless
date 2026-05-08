'use strict';

const expect = require('chai').expect;
const { stripVTControlCharacters: stripAnsi } = require('node:util');

const Context = require('../../../../lib/compose/Context');
const { createRegistry } = require('../../../../lib/utils/safe-object');
const readStream = require('../read-stream');

describe('test/unit/src/Context.test.js', () => {
  const createContext = () =>
    new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });

  it('does not render empty or invalid outputs', async () => {
    const context = createContext();

    context.renderOutputs(null);
    context.renderOutputs({});

    expect(await readStream(context.output.stdout)).to.equal('');
  });

  it('renders outputs through the configured output writer', async () => {
    const context = createContext();

    context.renderOutputs({ value: 1 });

    expect(stripAnsi(await readStream(context.output.stdout))).to.equal('value: 1\n');
  });

  it('renders null-prototype output maps', async () => {
    const context = createContext();
    const outputs = createRegistry();
    outputs.value = 1;

    context.renderOutputs(outputs);

    expect(stripAnsi(await readStream(context.output.stdout))).to.equal('value: 1\n');
  });
});
