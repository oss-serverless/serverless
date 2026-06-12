'use strict';

const virtualProperties = { virtual: { nested: 'proxy-virtual' } };

module.exports = {
  proxy: new Proxy(
    { own: 'own-value' },
    {
      get(target, key) {
        if (key in virtualProperties) return virtualProperties[key];
        return target[key];
      },
    }
  ),
};
