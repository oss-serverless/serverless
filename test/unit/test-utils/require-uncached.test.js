'use strict';

const { expect } = require('chai');
const requireUncached = require('../../utils/require-uncached');

describe('test/utils/require-uncached', () => {
  it('restores the require cache after generic thenables settle', async () => {
    const modulePath = '../../../package.json';
    const moduleId = require.resolve(modulePath);
    require(modulePath);
    const originalCacheEntry = require.cache[moduleId];
    let wasCacheCleared = false;

    const result = await requireUncached(() => ({
      then(resolve) {
        wasCacheCleared = !require.cache[moduleId];
        resolve('result');
      },
    }));

    expect(result).to.equal('result');
    expect(wasCacheCleared).to.equal(true);
    expect(require.cache[moduleId]).to.equal(originalCacheEntry);
  });
});
