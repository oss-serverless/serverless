'use strict';

const { getCredentialProvider } = require('../../../aws/credentials');

module.exports = ({ profile, stage } = {}) => getCredentialProvider({ profile, stage });
