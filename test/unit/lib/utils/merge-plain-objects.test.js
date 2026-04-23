'use strict';

const { expect } = require('chai');

const mergePlainObjects = require('../../../../lib/utils/merge-plain-objects');

describe('mergePlainObjects', () => {
  afterEach(() => {
    delete Object.prototype.polluted;
  });

  it('should deeply merge nested plain objects', () => {
    const target = {
      provider: {
        name: 'aws',
        tags: {
          foo: 'bar',
        },
      },
    };

    const result = mergePlainObjects(target, {
      provider: {
        tags: {
          baz: 'qux',
        },
      },
    });

    expect(result).to.equal(target);
    expect(result).to.deep.equal({
      provider: {
        name: 'aws',
        tags: {
          foo: 'bar',
          baz: 'qux',
        },
      },
    });
  });

  it('should merge arrays by index', () => {
    const target = {
      rules: [
        {
          status: 'enabled',
        },
        {
          retries: 2,
        },
      ],
    };

    mergePlainObjects(target, {
      rules: [
        {
          event: 'create',
        },
      ],
    });

    expect(target).to.deep.equal({
      rules: [
        {
          status: 'enabled',
          event: 'create',
        },
        {
          retries: 2,
        },
      ],
    });
  });

  it('should clone source branches when assigning new nested values', () => {
    const source = {
      custom: {
        nested: {
          value: 'original',
        },
      },
    };

    const result = mergePlainObjects({}, source);
    result.custom.nested.value = 'changed';

    expect(source.custom.nested.value).to.equal('original');
  });

  it('should preserve existing values when source branches are undefined', () => {
    const target = {
      provider: {
        stage: 'dev',
      },
      items: [1, 2],
    };

    const result = mergePlainObjects(target, {
      provider: {
        stage: undefined,
      },
      items: [undefined, 3],
    });

    expect(result).to.deep.equal({
      provider: {
        stage: 'dev',
      },
      items: [1, 3],
    });
  });

  it('should ignore non-plain root sources', () => {
    expect(mergePlainObjects({ kept: true }, ['value'])).to.deep.equal({ kept: true });
  });

  it('should ignore __proto__ keys from parsed input objects', () => {
    const target = {};
    const source = JSON.parse('{"__proto__":{"polluted":"yes"},"custom":{"ok":true}}');

    mergePlainObjects(target, source);

    expect(target).to.deep.equal({
      custom: { ok: true },
    });
    expect({}.polluted).to.equal(undefined);
    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
  });

  it('should ignore constructor and prototype keys from parsed input objects', () => {
    const target = {};
    const source = JSON.parse('{"constructor":{"prototype":{"polluted":"yes"}}}');

    mergePlainObjects(target, source);

    expect(target).to.deep.equal({});
    expect({}.polluted).to.equal(undefined);
  });
});
