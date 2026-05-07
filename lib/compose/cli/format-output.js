'use strict';

const colors = require('./colors');

const INDENTATION = '  ';
const MAX_DEPTH = 3;

const isSingleLineString = (value) => typeof value === 'string' && !value.includes('\n');

const isScalarLike = (value) =>
  value === null ||
  value === undefined ||
  typeof value === 'boolean' ||
  typeof value === 'number' ||
  isSingleLineString(value);

const renderScalar = (value) => {
  if (value === null) {
    return colors.gray('null');
  }
  if (value === undefined) {
    return colors.gray('undefined');
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return colors.white(String(value));
  }
  return String(value);
};

const renderMultilineString = (value, indentation) => {
  const nestedIndentation = `${indentation}${INDENTATION}`;
  const lines = value.split('\n').map((line) => `${nestedIndentation}${line}`);
  return `${indentation}"""\n${lines.join('\n')}\n${indentation}"""\n`;
};

function renderArray(value, depth, indentation, renderNestedValue) {
  if (value.length === 0) {
    return `${indentation}(empty array)\n`;
  }

  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const prefix = colors.gray(`${indentation}- `);

    if (Array.isArray(item)) {
      if (item.length === 0) {
        output += `${prefix}(empty array)\n`;
      } else if (depth + 1 > MAX_DEPTH) {
        output += `${prefix}(max depth reached)\n`;
      } else {
        output += `${prefix}\n${renderNestedValue(
          item,
          depth + 1,
          `${indentation}${INDENTATION}`
        )}`;
      }
      continue;
    }

    if (typeof item === 'string' && !isSingleLineString(item)) {
      if (depth + 1 > MAX_DEPTH) {
        output += `${prefix}(max depth reached)\n`;
      } else {
        output += `${prefix}\n${renderMultilineString(item, `${indentation}${INDENTATION}`)}`;
      }
      continue;
    }

    if (isScalarLike(item)) {
      output += `${prefix}${renderScalar(item)}\n`;
      continue;
    }

    if (depth + 1 > MAX_DEPTH) {
      output += `${prefix}(max depth reached)\n`;
      continue;
    }

    output += `${prefix}\n${renderNestedValue(item, depth + 1, `${indentation}${INDENTATION}`)}`;
  }

  return output;
}

function renderObject(value, depth, indentation, renderNestedValue) {
  let output = '';

  for (const key of Object.keys(value)) {
    const childValue = value[key];
    const prefix = colors.gray(`${indentation}${key}: `);

    if (Array.isArray(childValue)) {
      if (childValue.length === 0) {
        output += `${prefix}(empty array)\n`;
      } else if (depth + 1 > MAX_DEPTH) {
        output += `${prefix}(max depth reached)\n`;
      } else {
        output += `${prefix}\n${renderNestedValue(
          childValue,
          depth + 1,
          `${indentation}${INDENTATION}`
        )}`;
      }
      continue;
    }

    if (typeof childValue === 'string' && !isSingleLineString(childValue)) {
      if (depth + 1 > MAX_DEPTH) {
        output += `${prefix}(max depth reached)\n`;
      } else {
        output += `${prefix}\n${renderMultilineString(childValue, `${indentation}${INDENTATION}`)}`;
      }
      continue;
    }

    if (isScalarLike(childValue)) {
      output += `${prefix}${renderScalar(childValue)}\n`;
      continue;
    }

    if (depth + 1 > MAX_DEPTH) {
      output += `${prefix}(max depth reached)\n`;
      continue;
    }

    output += `${prefix}\n${renderNestedValue(
      childValue,
      depth + 1,
      `${indentation}${INDENTATION}`
    )}`;
  }

  return output;
}

function renderValue(value, depth = 0, indentation = '') {
  if (Array.isArray(value)) {
    return renderArray(value, depth, indentation, renderValue);
  }

  if (typeof value === 'string' && !isSingleLineString(value)) {
    return renderMultilineString(value, indentation);
  }

  if (isScalarLike(value)) {
    return `${indentation}${renderScalar(value)}\n`;
  }

  return renderObject(value, depth, indentation, renderValue);
}

module.exports = (value) => renderValue(value);
