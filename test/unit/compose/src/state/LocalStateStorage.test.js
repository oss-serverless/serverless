'use strict';

const os = require('os');
const path = require('path');
const fsp = require('fs').promises;
const expect = require('chai').expect;

const LocalStateStorage = require('../../../../../lib/compose/state/LocalStateStorage');
const { ensureDir, remove } = require('../../../../lib/compose/fs');

describe('test/unit/src/state/LocalStateStorage.test.js', () => {
  let rootDir;

  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'compose-local-state-'));
    await ensureDir(path.join(rootDir, '.serverless'));
  });

  afterEach(async () => {
    if (rootDir) {
      await remove(rootDir);
    }
  });

  it('normalizes reserved top-level component ids while preserving nested payload unsafe keys', async () => {
    const statePath = path.join(rootDir, '.serverless', 'state.dev.json');
    await fsp.writeFile(
      statePath,
      JSON.stringify({
        components: {
          __proto__: {
            outputs: { hidden: true },
          },
          constructor: {
            outputs: { hidden: true },
          },
          prototype: {
            outputs: { hidden: true },
          },
          service: {
            outputs: JSON.parse('{"__proto__":{"value":"ok"}}'),
          },
        },
      })
    );

    const storage = new LocalStateStorage(rootDir, 'dev');
    const state = await storage.readState();

    expect(Object.getPrototypeOf(state.components)).to.equal(null);
    expect(Object.keys(state.components)).to.deep.equal(['service']);
    expect(
      Object.getOwnPropertyDescriptor(state.components.service.outputs, '__proto__').value
    ).to.deep.equal({ value: 'ok' });
  });

  for (const stage of ['foo/../../tmp/x', 'foo\\bar', 'feature.prod', 'my_stage', 'café', '']) {
    it(`rejects invalid local state stage ${JSON.stringify(stage)}`, () => {
      expect(() => new LocalStateStorage(rootDir, stage))
        .to.throw()
        .and.have.property('code', 'INVALID_STAGE');
    });
  }

  it('uses validated stage in local state filename', async () => {
    const storage = new LocalStateStorage(rootDir, 'prod-1');
    storage.state = { service: { id: 'abc' } };

    await storage.writeState();

    const statePath = path.join(rootDir, '.serverless', 'state.prod-1.json');
    expect(JSON.parse(await fsp.readFile(statePath, 'utf8'))).to.deep.equal({
      service: { id: 'abc' },
    });
  });
});
