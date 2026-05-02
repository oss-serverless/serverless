'use strict';

const chai = require('chai');
const resolveAjvValidate = require('../../../../../lib/classes/config-schema-handler/resolve-ajv-validate');
const objectHash = require('object-hash');
const deepSortObjectByKey = require('../../../../../lib/utils/deep-sort-object-by-key');
const path = require('path');
const os = require('os');
const fsp = require('fs').promises;

const expect = chai.expect;

const getExpectedCachePath = (schemaHash) => {
  return path.resolve(
    process.env.SLS_SCHEMA_CACHE_BASE_DIR || os.homedir(),
    `.serverless/artifacts/ajv-validate-ajv-${require('ajv/package').version}-ajv-formats-${
      require('ajv-formats/package').version
    }`,
    `${schemaHash}.js`
  );
};

describe('test/unit/lib/classes/ConfigSchemaHandler/resolveAjvValidate.test.js', () => {
  const schema = {
    $id: 'https://example.com/person.schema.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TestSchema',
    type: 'object',
    properties: {
      firstProp: {
        type: 'string',
      },
    },
  };

  it('generates schema validation file', async () => {
    await resolveAjvValidate(schema);
    const schemaHash = objectHash(deepSortObjectByKey(schema));

    const fileStat = await fsp.lstat(getExpectedCachePath(schemaHash));
    expect(fileStat.isFile()).to.be.true;
  });

  it('regenerates schema validation file if schema changes', async () => {
    await resolveAjvValidate(schema);
    const updatedSchema = {
      ...schema,
      title: 'ChangedTitle',
    };
    await resolveAjvValidate(updatedSchema);
    const schemaHash = objectHash(deepSortObjectByKey(updatedSchema));

    const fileStat = await fsp.lstat(getExpectedCachePath(schemaHash));
    expect(fileStat.isFile()).to.be.true;
  });

  it('validates date-time formats with ajv-formats v3 semantics', async () => {
    const validate = await resolveAjvValidate({
      $id: 'https://example.com/date-time.schema.json',
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'DateTimeSchema',
      type: 'object',
      properties: {
        timestamp: {
          type: 'string',
          format: 'date-time',
        },
      },
      required: ['timestamp'],
      additionalProperties: false,
    });

    expect(validate({ timestamp: '2026-05-02T00:00:00Z' })).to.equal(true);
    expect(validate.errors).to.equal(null);

    expect(validate({ timestamp: '2026-05-02T00:00:00' })).to.equal(false);
    expect(
      validate.errors.some(
        (error) =>
          error.instancePath === '/timestamp' &&
          error.keyword === 'format' &&
          error.params.format === 'date-time'
      )
    ).to.equal(true);
  });
});
