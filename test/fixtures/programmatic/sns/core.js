'use strict';

// NOTE: the `utils.js` file is bundled into the deployment package
const { log } = require('./utils');

function snsMinimal(event, context, callback) {
  const functionName = 'snsMinimal';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}

function snsMultipleFilteredLeft(event, context, callback) {
  const functionName = 'snsMultipleFilteredLeft';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}
function snsMultipleFilteredRight(event, context, callback) {
  const functionName = 'snsMultipleFilteredRight';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}

function snsExisting(event, context, callback) {
  const functionName = 'snsExisting';
  log(functionName, JSON.stringify(event));
  return callback(null, event);
}

module.exports = { snsMinimal, snsMultipleFilteredLeft, snsMultipleFilteredRight, snsExisting };
