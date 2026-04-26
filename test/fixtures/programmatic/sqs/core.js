'use strict';

// NOTE: the `utils.js` file is bundled into the deployment package
const { log } = require('./utils');

function sqsBasic(event, context, callback) {
  const functionName = 'sqsBasic';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}

module.exports = { sqsBasic };
