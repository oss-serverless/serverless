// Warning: Needs to be required before any serverless modules are required!

'use strict';

const path = require('path');

module.exports = (serverlessPath) => {
  const modulePath = path.join(serverlessPath, 'lib/utils/telemetry/are-disabled');
  // Ensure no tracking during tests run
  require.cache[require.resolve(modulePath)] = { exports: true };
};
