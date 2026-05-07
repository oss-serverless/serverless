'use strict';

const expect = require('chai').expect;

const normalizeState = require('../../../../../lib/compose/state/normalize-state');

describe('test/unit/src/state/normalize-state.test.js', () => {
  it('normalizes non-object state to an empty object', () => {
    expect(normalizeState(null)).to.deep.equal({});
    expect(normalizeState(42)).to.deep.equal({});
  });

  it('drops reserved top-level component ids while preserving nested unsafe payload keys', () => {
    const normalized = normalizeState({
      components: JSON.parse(
        '{"__proto__":{"outputs":{"hidden":true}},"constructor":{"state":{"hidden":true}},"prototype":{"outputs":{"hidden":true}},"service":{"outputs":{"__proto__":{"value":"ok"}}}}'
      ),
    });

    expect(Object.getPrototypeOf(normalized.components)).to.equal(null);
    expect(Object.keys(normalized.components)).to.deep.equal(['service']);
    expect(
      Object.getOwnPropertyDescriptor(normalized.components.service.outputs, '__proto__').value
    ).to.deep.equal({ value: 'ok' });
  });

  it('normalizes non-object component records to empty objects', () => {
    const normalized = normalizeState({
      components: {
        service: 'invalid',
      },
    });

    expect(normalized.components.service).to.deep.equal({});
  });
});
