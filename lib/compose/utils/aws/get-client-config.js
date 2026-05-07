'use strict';

const { buildClientConfig } = require('./config');
const getCredentialProvider = require('./get-credential-provider');

module.exports = ({ credentials, profile, region, stage, ...clientOptions } = {}) =>
  buildClientConfig({
    ...clientOptions,
    region,
    credentials: credentials || getCredentialProvider({ profile, stage }),
  });
