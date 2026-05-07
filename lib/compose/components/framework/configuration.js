'use strict';

const configSchema = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    region: { type: 'string' },
    config: { type: 'string' },
    params: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['path'],
  additionalProperties: false,
};

module.exports = { configSchema };
