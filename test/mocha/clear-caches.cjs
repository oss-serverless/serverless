'use strict';

const ensureArtifact = require('../../lib/utils/ensure-artifact');
const resolveInput = require('../../lib/cli/resolve-input');

module.exports = () => {
  if (typeof ensureArtifact.clear === 'function') ensureArtifact.clear();
  if (typeof resolveInput.clear === 'function') resolveInput.clear();
};
