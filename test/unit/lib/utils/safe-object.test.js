'use strict';

const { expect } = require('chai');

const {
  createRegistry,
  getOwnByPath,
  hasOwn,
  safeSet,
  safeShallowAssign,
} = require('../../../../lib/utils/safe-object');

describe('safe-object', () => {
  afterEach(() => {
    delete Object.prototype.polluted;
  });

  it('distinguishes own and inherited properties with hasOwn', () => {
    expect(hasOwn(null, 'value')).to.equal(false);
    expect(hasOwn(undefined, 'value')).to.equal(false);
    expect(hasOwn({}, 'toString')).to.equal(false);
    expect(hasOwn({ toString: 'own' }, 'toString')).to.equal(true);
    expect(hasOwn([1, 2], 'length')).to.equal(true);
    expect(hasOwn('ab', 'length')).to.equal(true);
  });

  it('preserves unsafe keys as own data properties when setting values', () => {
    const target = {};

    safeSet(target, '__proto__', { polluted: 'no' });
    safeSet(target, 'constructor', 'ctor');
    safeSet(target, 'prototype', 'proto');

    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(target, '__proto__').value).to.deep.equal({
      polluted: 'no',
    });
    expect(Object.getOwnPropertyDescriptor(target, 'constructor').value).to.equal('ctor');
    expect(Object.getOwnPropertyDescriptor(target, 'prototype').value).to.equal('proto');
    expect({}.polluted).to.equal(undefined);
  });

  it('preserves overwrite order in safeShallowAssign', () => {
    const target = safeShallowAssign({}, { value: 'first' }, { value: 'second' });

    expect(target.value).to.equal('second');
  });

  it('preserves unsafe keys as own data when shallow assigning', () => {
    const source = JSON.parse('{"__proto__":{"value":"ok"}}');
    const target = safeShallowAssign({}, source);

    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(target, '__proto__').value).to.deep.equal({
      value: 'ok',
    });
  });

  it('ignores nullish sources when shallow assigning', () => {
    const target = safeShallowAssign({}, null, { value: 'first' }, undefined, { value: 'second' });

    expect(target).to.deep.equal({ value: 'second' });
  });

  it('creates null-prototype registries', () => {
    const registry = createRegistry();

    expect(Object.getPrototypeOf(registry)).to.equal(null);
  });

  it('reads only own properties when traversing string and array paths', () => {
    const source = {
      list: ['a', 'b'],
      nested: {},
      text: 'ab',
    };
    Object.defineProperty(source.nested, '__proto__', {
      value: { value: 'own' },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    expect(getOwnByPath(source, 'list.length')).to.equal(2);
    expect(getOwnByPath(source, ['list', '1'])).to.equal('b');
    expect(getOwnByPath(source, ['nested', '__proto__', 'value'])).to.equal('own');
    expect(getOwnByPath(source, ['text', 'length'])).to.equal(2);
    expect(getOwnByPath({ nested: {} }, ['nested', 'constructor', 'name'])).to.equal(undefined);
    expect(getOwnByPath({ nested: null }, 'nested.value')).to.equal(undefined);
    expect(getOwnByPath({ nested: 5 }, 'nested.value')).to.equal(undefined);
  });
});
