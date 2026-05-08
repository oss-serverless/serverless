'use strict';

const { buildClientConfig } = require('../../../aws/config');
const { getCredentialProvider } = require('../../../aws/credentials');

module.exports = ({ credentials, profile, region, stage, ...clientOptions } = {}) =>
  buildClientConfig({
    ...clientOptions,
    region,
    credentials: credentials || getCredentialProvider({ profile, stage }),
  });
