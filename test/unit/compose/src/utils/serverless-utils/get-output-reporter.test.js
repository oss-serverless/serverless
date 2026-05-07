'use strict';

const { expect } = require('chai');

const getOutputReporter = require('../../../../../../lib/compose/utils/serverless-utils/lib/log/get-output-reporter');

describe('test/unit/src/utils/serverless-utils/get-output-reporter.test.js', () => {
  afterEach(() => {
    getOutputReporter.emitter.removeAllListeners();
    getOutputReporter.clear();
  });

  it('emits write events through the shared Node EventEmitter', () => {
    const events = [];

    getOutputReporter.emitter.on('write', (event) => events.push(event));

    getOutputReporter('test').get('text')('hello', 'world');

    expect(events).to.deep.equal([
      {
        namespace: 'test',
        mode: 'text',
        textTokens: ['hello', 'world'],
      },
    ]);
  });
});
