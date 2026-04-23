'use strict';

const isPlainObject = require('type/plain-object/is');
const { isUnsafePropertyKey } = require('./object-path');

const cloneMergeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(cloneMergeValue);
  }

  if (isPlainObject(value)) {
    const clone = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isUnsafePropertyKey(key)) continue;
      clone[key] = cloneMergeValue(nestedValue);
    }

    return clone;
  }

  return value;
};

const mergeArrayValues = (targetValues, sourceValues) => {
  const nextValues = targetValues.map(cloneMergeValue);

  sourceValues.forEach((sourceValue, index) => {
    if (sourceValue === undefined) return;

    const targetValue = nextValues[index];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      mergePlainObjects(targetValue, sourceValue);
      return;
    }

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      nextValues[index] = mergeArrayValues(targetValue, sourceValue);
      return;
    }

    nextValues[index] = cloneMergeValue(sourceValue);
  });

  return nextValues;
};

const mergePlainObjects = (target, ...sources) => {
  for (const source of sources) {
    if (!isPlainObject(source)) continue;

    for (const [key, sourceValue] of Object.entries(source)) {
      if (isUnsafePropertyKey(key)) continue;
      if (sourceValue === undefined) continue;

      const targetValue = target[key];

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        mergePlainObjects(targetValue, sourceValue);
        continue;
      }

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = mergeArrayValues(targetValue, sourceValue);
        continue;
      }

      target[key] = cloneMergeValue(sourceValue);
    }
  }

  return target;
};

module.exports = mergePlainObjects;
