'use strict';

const semver = require('semver');

const supportedRange = '^20.19.0 || >=22.12.0';

const isSupportedNodeVersion = (version) => {
  const normalizedVersion = semver.coerce(version);

  return Boolean(normalizedVersion && semver.satisfies(normalizedVersion.version, supportedRange));
};

module.exports = isSupportedNodeVersion;
module.exports.supportedRange = supportedRange;
