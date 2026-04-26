'use strict';

// NOTE: the `utils.js` file is bundled into the deployment package
const { log } = require('./utils');

function iotBasic(event, context, callback) {
  const functionName = 'iotBasic';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}

module.exports = { iotBasic };
