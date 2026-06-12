'use strict';

module.exports = {
  proxy: new Proxy(
    {},
    {
      get(target, key) {
        if (key === 'boom') throw new Error('Proxy get trap crashed');
        return target[key];
      },
    }
  ),
  getter: Object.defineProperty({}, 'boom', {
    enumerable: true,
    get() {
      throw new Error('Getter crashed');
    },
  }),
};
