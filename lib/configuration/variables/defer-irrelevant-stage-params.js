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
// Known limitation: when a whole section is configured with a single variable
// (e.g. `params: ${file(./params.yml)}` or `params.prod: ${file(./prod-params.yml)}`), the
// section variable itself is resolved eagerly: the configuration schema requires
// `params.<stage>` to be an object, and a raw variable string would fail validation.
// Values nested in the resolved object are however deferred as any other.

'use strict';

const isPlainObject = require('type/plain-object/is');
const { hasOwn } = require('../../utils/safe-object');

// `configuration` and `resolverConfiguration` are read live at each call (not snapshotted):
// plugins may extend the configuration with new stages, and the effective CLI options object
// is replaced between resolution passes
module.exports = (configuration, resolverConfiguration) => (propertyPath) => {
  if (!propertyPath.startsWith('params\0')) return false;
  if (!isPlainObject(configuration.params)) return false;

  const propertyPathKeys = propertyPath.split('\0');
  // Never defer the `params.<stage>` section itself: it has to resolve for the configuration
  // to validate (see "Known limitation" above)
  if (propertyPathKeys.length < 3) return false;

  const stageKey = propertyPathKeys[1];
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
  stage = String(stage);
  // The effective stage is not known yet (`provider.stage` is configured behind a variable which
  // did not resolve yet). Deferring against it would be resolved against a different stage in a
  // later pass, which would strand params of the effective stage as never scheduled for resolution
  if (stage.includes('${')) return false;

  return stageKey !== stage;
};
