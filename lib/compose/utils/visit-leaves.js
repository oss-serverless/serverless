'use strict';

// Walk a JSON-like value visiting every leaf (non-object, non-array).
// If `visitor` returns a value other than `undefined`, the leaf is replaced.
// The original `node` is mutated in place and returned.
const visitLeaves = (node, visitor) => {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const child = node[i];
      if (child !== null && typeof child === 'object') {
        visitLeaves(child, visitor);
      } else {
        const replaced = visitor(child);
        if (replaced !== undefined) node[i] = replaced;
      }
    }
  } else if (node !== null && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child !== null && typeof child === 'object') {
        visitLeaves(child, visitor);
      } else {
        const replaced = visitor(child);
        if (replaced !== undefined) node[key] = replaced;
      }
    }
  }
  return node;
};

module.exports = visitLeaves;
