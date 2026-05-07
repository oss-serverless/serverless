'use strict';

const expect = require('chai').expect;

const BaseStateStorage = require('../../../../../lib/compose/state/BaseStateStorage');

class InMemoryStateStorage extends BaseStateStorage {
  constructor(state = {}) {
    super();
    this.state = state;
  }

  async readState() {
    return this.state;
  }

  async writeState() {
    return undefined;
  }
}

describe('test/unit/src/state/BaseStateStorage.test.js', () => {
  it('writes component state and outputs into a null-prototype components registry', async () => {
    const storage = new InMemoryStateStorage();

    await storage.writeComponentState('service', { deployed: true });
    await storage.writeComponentOutputs('service', { endpoint: 'https://example.com' });

    expect(Object.getPrototypeOf(storage.state.components)).to.equal(null);
    expect(await storage.readComponentState('service')).to.deep.equal({ deployed: true });
    expect(await storage.readComponentOutputs('service')).to.deep.equal({
      endpoint: 'https://example.com',
    });
  });

  it('does not resolve inherited component ids on reads', async () => {
    const storage = new InMemoryStateStorage({ components: Object.create(null) });

    expect(await storage.readComponentState('constructor')).to.deep.equal({});
    expect(await storage.readComponentOutputs('constructor')).to.deep.equal({});
  });

  it('rejects reserved component ids on writes', async () => {
    const storage = new InMemoryStateStorage();

    await expect(
      storage.writeComponentState('__proto__', { deployed: true })
    ).to.eventually.be.rejected.and.have.property('code', 'INVALID_COMPONENT_ID');
    await expect(
      storage.writeComponentOutputs('constructor', { endpoint: 'https://example.com' })
    ).to.eventually.be.rejected.and.have.property('code', 'INVALID_COMPONENT_ID');

    expect(storage.state.components).to.equal(undefined);
  });

  it('aggregates outputs into a null-prototype registry', async () => {
    const storage = new InMemoryStateStorage({
      components: Object.assign(Object.create(null), {
        service: {
          outputs: { ok: true },
        },
      }),
    });

    const outputs = await storage.readComponentsOutputs();

    expect(Object.getPrototypeOf(outputs)).to.equal(null);
    expect(outputs.service).to.deep.equal({ ok: true });
  });

  it('skips reserved component ids when aggregating outputs from raw state', async () => {
    const storage = new InMemoryStateStorage({
      components: JSON.parse(
        '{"__proto__":{"outputs":{"hidden":true}},"service":{"outputs":{"ok":true}}}'
      ),
    });

    const outputs = await storage.readComponentsOutputs();

    expect(outputs).to.deep.equal(Object.assign(Object.create(null), { service: { ok: true } }));
    expect(await storage.readComponentOutputs('__proto__')).to.deep.equal({});
  });
});
