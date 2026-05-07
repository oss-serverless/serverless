'use strict';

const {
  createRegistry,
  hasOwn,
  isReservedComponentId,
  safeShallowAssign,
} = require('../utils/safe-object');

const isObjectLike = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

const normalizeComponentRecord = (componentRecord) => {
  if (!isObjectLike(componentRecord)) return {};
  return safeShallowAssign({}, componentRecord);
};

module.exports = (state) => {
  if (!isObjectLike(state)) return {};

  const normalizedState = safeShallowAssign({}, state);
  const rawComponents =
    hasOwn(state, 'components') && isObjectLike(state.components) ? state.components : null;

  if (rawComponents) {
    const normalizedComponents = createRegistry();

    for (const [componentId, componentRecord] of Object.entries(rawComponents)) {
      if (isReservedComponentId(componentId)) continue;
      normalizedComponents[componentId] = normalizeComponentRecord(componentRecord);
    }

    normalizedState.components = normalizedComponents;
  } else if (hasOwn(state, 'components')) {
    normalizedState.components = createRegistry();
  }

  return normalizedState;
};
