'use strict';

const resolveEnv = require('./resolve-env');

module.exports = () => {
  const env = resolveEnv({
    whitelist: ['SERVERLESS_ACCESS_KEY', 'SLS_AWS_REQUEST_MAX_RETRIES'],
  });
  for (const envVarName of Object.keys(process.env)) {
    if (envVarName.startsWith('AWS_') || envVarName.startsWith('SERVERLESS_PLATFORM_')) {
      env[envVarName] = process.env[envVarName];
    }
  }
  return env;
};
