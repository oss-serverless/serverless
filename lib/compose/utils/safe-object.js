'use strict';

const RESERVED_COMPONENT_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const hasOwnProperty = Object.prototype.hasOwnProperty;

const hasOwn = (object, key) => object != null && hasOwnProperty.call(object, key);

const dataDescriptor = (value) =>
  Object.assign(Object.create(null), {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });

const createRegistry = () => Object.create(null);

const isReservedComponentId = (componentId) => RESERVED_COMPONENT_IDS.has(String(componentId));

const safeSet = (target, key, value) => {
  if (isReservedComponentId(key)) {
    Object.defineProperty(target, key, dataDescriptor(value));
  } else {
    target[key] = value;
  }

  return target;
};

const safeShallowAssign = (target, ...sources) => {
  for (const source of sources) {
    if (source == null) continue;

    for (const [key, value] of Object.entries(source)) {
      safeSet(target, key, value);
    }
  }

  return target;
};

const getOwnByPath = (source, path) => {
  const segments = Array.isArray(path)
    ? path.map((segment) => String(segment))
    : String(path).split('.').filter(Boolean);

  let current = source;

  for (const segment of segments) {
    if (current == null || !hasOwn(current, segment)) return undefined;
    current = current[segment];
  }

  return current;
};

module.exports = {
  RESERVED_COMPONENT_IDS,
  createRegistry,
  getOwnByPath,
  hasOwn,
  isReservedComponentId,
  safeSet,
  safeShallowAssign,
};
