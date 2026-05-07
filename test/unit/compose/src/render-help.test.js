'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');

const expect = chai.expect;

describe('test/unit/src/render-help.test.js', () => {
  it('shows nested service-specific command examples', async () => {
    const lines = [];

    class FakeOutput {
      writeText(message = '') {
        lines.push(message);
      }
    }

    const renderHelp = proxyquire('../../../../lib/compose/render-help', {
      './cli/Output': FakeOutput,
    });

    await renderHelp();

    expect(lines).to.include('serverless deploy function --service=service-a --function=handler');
    expect(lines).to.include('serverless service-a:invoke:local --function=handler');
  });
});
