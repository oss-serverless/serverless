'use strict';

const { expect } = require('chai');

const getProgressReporter = require('../../../../../../lib/compose/utils/serverless-utils/lib/log/get-progress-reporter');

describe('test/unit/src/utils/serverless-utils/get-progress-reporter.test.js', () => {
  afterEach(() => {
    getProgressReporter.emitter.removeAllListeners();
    getProgressReporter.clear();
  });

  it('emits progress update events through the shared Node EventEmitter', () => {
    const events = [];

    getProgressReporter.emitter.on('update', (event) => events.push(event));

    const progress = getProgressReporter('test').get('upload');
    progress.notice('deploying');

    expect(events).to.have.length(1);
    expect(events[0]).to.include({
      namespace: 'test',
      name: 'upload',
      level: 'notice',
    });
  });
});
