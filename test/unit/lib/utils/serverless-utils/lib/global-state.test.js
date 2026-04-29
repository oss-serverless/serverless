'use strict';

const { expect } = require('chai');

const requireUncached = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

describe('serverless-utils/global-state', () => {
  it('shares state across uncached module loads', () => {
    const modulePath = '../../../../../../lib/utils/serverless-utils/lib/global-state';
    const first = requireUncached(modulePath);
    const marker = {};

    first.testMarker = marker;

    const second = requireUncached(modulePath);

    expect(second.testMarker).to.equal(marker);

    delete first.testMarker;
  });
});
