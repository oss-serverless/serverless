'use strict';

const { isUnsafePropertyKey } = require('./object-path');

const hasOwnProperty = Object.prototype.hasOwnProperty;

const hasOwn = (object, key) => object != null && hasOwnProperty.call(object, key);

const dataDescriptor = (value) =>
  Object.assign(Object.create(null), {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });

const safeSet = (target, key, value) => {
  if (isUnsafePropertyKey(key)) {
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

const createRegistry = () => Object.create(null);

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
  createRegistry,
  getOwnByPath,
  hasOwn,
  safeSet,
  safeShallowAssign,
};
