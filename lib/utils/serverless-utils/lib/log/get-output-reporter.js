'use strict';

const uniGlobal = require('uni-global')('serverless/serverless/202110');
const memoizee = require('memoizee');

const outputEmitter = (() => {
  if (!uniGlobal.outputEmitter) uniGlobal.outputEmitter = require('event-emitter')();
  return uniGlobal.outputEmitter;
})();

module.exports = memoizee(
  (namespace) => {
    return {
      get: memoizee(
        (mode) =>
          (text, ...textTokens) => {
            outputEmitter.emit('write', {
              namespace,
              mode,
              textTokens: [text, ...textTokens],
            });
          },
        { primitive: true }
      ),
    };
  },
  { primitive: true }
);

module.exports.emitter = outputEmitter;
