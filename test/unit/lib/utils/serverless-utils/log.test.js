'use strict';

const { expect } = require('chai');
const requireUncached = require('../../../../utils/require-uncached');

describe('serverless-utils/log', () => {
  let logModule;

  beforeEach(() => {
    logModule = requireUncached(() => require('../../../../../lib/utils/serverless-utils/log'));
  });

  afterEach(() => {
    logModule.getPluginWriters.clear();
  });

  it('sanitizes plugin names for logger namespaces while preserving the original plugin name', () => {
    const rawPluginName = '@Scope/Plugin Name';

    expect(() => logModule.log.get('plugin').get(rawPluginName)).to.throw(TypeError);

    const writers = logModule.getPluginWriters(rawPluginName);

    expect(writers.log.namespace).to.equal('serverless:plugin:-scope-plugin-name');
    expect(writers.log.pluginName).to.equal(rawPluginName);
    expect(writers).to.equal(logModule.getPluginWriters(rawPluginName));
    expect(typeof writers.writeText).to.equal('function');
    expect(typeof writers.progress.get('upload').notice).to.equal('function');
  });
});
