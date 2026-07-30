// Builds an `isPropertyDeferred` predicate for the variables resolver, which prevents eager
// resolution of `params.<stage>` sections that do not concern the effective stage.
// Such sections are never read by the "param" variable source (which only consults
// `params.<currentStage>` and `params.default`), so resolving them upfront at best wastes
// remote calls (e.g. SSM) and at worst fails the command on errors that concern other stages.
//
// Deferred properties stay in `variablesMeta`: an explicit reference (e.g.
// `${self:params.prod.x}`) still resolves them on demand, exactly as before. Entries that are
// still deferred after the final resolution pass are dropped from `variablesMeta` by the caller
// (see `scripts/serverless.js`), leaving their raw (unresolved) values in the configuration.
//
// Known limitation: when the whole `params` section resolves from a single variable
// (e.g. `params: ${file(./params.yml)}`), its content is only discovered mid-pass and is
// resolved eagerly as before.

'use strict';

const isPlainObject = require('type/plain-object/is');
const { hasOwn } = require('../../utils/safe-object');

// `configuration` and `resolverConfiguration` are read live at each call (not snapshotted):
// plugins may extend the configuration with new stages, and the effective CLI options object
// is replaced between resolution passes
module.exports = (configuration, resolverConfiguration) => (propertyPath) => {
  if (!propertyPath.startsWith('params\0')) return false;
  if (!isPlainObject(configuration.params)) return false;

  const stageKey = propertyPath.split('\0')[1];
  if (stageKey === 'default') return false;

  // Mirrors effective stage resolution of the "param" source
  // (lib/configuration/variables/sources/instance-dependent/param.js)
  const options = resolverConfiguration.options || {};
  let stage = hasOwn(options, 'stage') && options.stage != null ? options.stage : null;
  if (stage == null && isPlainObject(configuration.provider)) {
    const configuredStage = configuration.provider.stage;
    if (typeof configuredStage === 'string' || typeof configuredStage === 'number') {
      stage = configuredStage;
    }
  }
  if (stage == null) stage = 'dev';

  return stageKey !== String(stage);
};
