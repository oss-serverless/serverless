'use strict';

// This module should be dependencies free (as it's used at local fallback triage)
// and kept async (as telemetry payload generation depends on it)

const path = require('path');
const { createRequire } = require('module');

module.exports = ({ cwd = process.cwd() } = {}) => {
  try {
    return path.resolve(
      path.dirname(createRequire(path.resolve(cwd, 'require-resolver')).resolve('serverless')),
      '..'
    );
  } catch {
    return null;
  }
};
