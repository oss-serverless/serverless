'use strict';

const { getCredentialProvider } = require('./credentials');

module.exports = ({ profile, stage } = {}) => getCredentialProvider({ profile, stage });
