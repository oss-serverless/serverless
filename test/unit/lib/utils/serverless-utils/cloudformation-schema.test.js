'use strict';

const expect = require('chai').expect;
const yaml = require('js-yaml');
const cloudformationSchema = require('../../../../../lib/utils/serverless-utils/cloudformation-schema');

const load = (input) => yaml.load(input, { schema: cloudformationSchema });

describe('serverless-utils/cloudformation-schema', () => {
  it('should keep date-shaped plain scalars and mapping keys as strings', () => {
    expect(load('date: 2012-10-17').date).to.equal('2012-10-17');
    expect(load('dateTime: 2020-12-12T00:00:00Z').dateTime).to.equal('2020-12-12T00:00:00Z');
    expect(load('spaced: 2020-12-12 00:00:00').spaced).to.equal('2020-12-12 00:00:00');
    expect(load('map:\n  2012-10-17: value').map).to.deep.equal({ '2012-10-17': 'value' });
  });

  it('should construct a Date for an explicit timestamp tag', () => {
    expect(load('date: !!timestamp 2020-12-12').date).to.be.instanceOf(Date);
  });
});
