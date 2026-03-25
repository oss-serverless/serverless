'use strict';

const createEnv = require('process-utils/create-env');

module.exports = (options = {}) => {
  if (!options) options = {};
  return createEnv({
    whitelist: [
      'APPDATA',
      'HOME',
      'LOCAL_SERVERLESS_LINK_PATH',
      'LOG_LEVEL',
      'PATH',
      'SERVERLESS_BINARY_PATH',
      'SLS_SCHEMA_CACHE_BASE_DIR',
      'TEMP',
      'TMP',
      'TMPDIR',
      'USERPROFILE',
    ].concat(options.whitelist || []),
    variables: Object.assign(
      { SLS_TRACKING_DISABLED: '1', SLS_DEPRECATION_NOTIFICATION_MODE: 'error' },
      options.variables || {}
    ),
  });
};
