'use strict';

/**
 * Test: YamlParser Function Class
 */

const http = require('http');
const yaml = require('js-yaml');
const path = require('path');
const { pathToFileURL } = require('url');
const Serverless = require('../../../../lib/serverless');
const { getTmpFilePath, getTmpDirPath } = require('../../../utils/fs');

// Configure chai
const expect = require('chai').expect;

const serverless = new Serverless({ commands: [], options: {} });

describe('YamlParser', () => {
  describe('#parse()', () => {
    it('should parse a simple .yaml file', () => {
      const tmpFilePath = getTmpFilePath('simple.yaml');

      serverless.utils.writeFileSync(tmpFilePath, yaml.dump({ foo: 'bar' }));

      return expect(serverless.yamlParser.parse(tmpFilePath))
        .to.eventually.have.property('foo')
        .to.equal('bar');
    });

    it('should parse a simple .yml file', () => {
      const tmpFilePath = getTmpFilePath('simple.yml');

      serverless.utils.writeFileSync(tmpFilePath, yaml.dump({ foo: 'bar' }));

      return expect(serverless.yamlParser.parse(tmpFilePath))
        .to.eventually.have.property('foo')
        .to.equal('bar');
    });

    it('should parse a .yml file with JSON-REF to YAML', () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), { foo: 'bar' });

      const testYml = {
        main: {
          $ref: './ref.yml',
        },
      };

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), testYml);

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml')))
        .to.eventually.have.nested.property('main.foo')
        .to.equal('bar');
    });

    it('should parse a .yml file with JSON-REF to JSON', () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.json'), { foo: 'bar' });

      const testYml = {
        main: {
          $ref: './ref.json',
        },
      };

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), testYml);

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml')))
        .to.eventually.have.nested.property('main.foo')
        .to.equal('bar');
    });

    it('should parse a .yml file with recursive JSON-REF', () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'three.yml'), { foo: 'bar' });

      const twoYml = {
        two: {
          $ref: './three.yml',
        },
      };

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'two.yml'), twoYml);

      const oneYml = {
        one: {
          $ref: './two.yml',
        },
      };

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'one.yml'), oneYml);

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'one.yml')))
        .to.eventually.have.nested.property('one.two.foo')
        .to.equal('bar');
    });

    it('should leave same-document refs in the root file untouched', async () => {
      const tmpFilePath = getTmpFilePath('same-document.yml');

      serverless.utils.writeFileSync(tmpFilePath, {
        target: { foo: 'bar' },
        main: {
          $ref: '#/target',
        },
      });

      return expect(serverless.yamlParser.parse(tmpFilePath)).to.eventually.deep.equal({
        target: { foo: 'bar' },
        main: {
          $ref: '#/target',
        },
      });
    });

    it('should resolve same-document refs in externally referenced files', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), {
        definitions: {
          value: { foo: 'bar' },
        },
        outer: {
          child: {
            $ref: '#/definitions/value',
          },
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './ref.yml#/outer',
        },
      });

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml')))
        .to.eventually.have.nested.property('main.child.foo')
        .to.equal('bar');
    });

    it('should ignore sibling properties on resolved external refs', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), { foo: 'bar' });
      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './ref.yml',
          extra: 'ignored',
        },
      });

      return expect(
        serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'))
      ).to.eventually.deep.equal({
        main: { foo: 'bar' },
      });
    });

    it('should preserve identity for repeated external refs to the same target', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), { foo: 'bar' });
      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        first: {
          $ref: './ref.yml',
        },
        second: {
          $ref: './ref.yml',
        },
      });

      return expect(
        serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'))
      ).to.eventually.be.fulfilled.then((result) => {
        expect(result.first).to.equal(result.second);
      });
    });

    it('should leave missing external refs untouched', async () => {
      const tmpFilePath = getTmpFilePath('missing-external.yml');

      serverless.utils.writeFileSync(tmpFilePath, {
        main: {
          $ref: './missing.yml',
          extra: 'kept',
        },
      });

      return expect(serverless.yamlParser.parse(tmpFilePath)).to.eventually.deep.equal({
        main: {
          $ref: './missing.yml',
          extra: 'kept',
        },
      });
    });

    it('should keep nested missing refs untouched while resolving the rest of an external file', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), {
        ok: { foo: 'bar' },
        missing: {
          $ref: './missing.yml',
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './ref.yml',
        },
      });

      return expect(
        serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'))
      ).to.eventually.deep.equal({
        main: {
          ok: { foo: 'bar' },
          missing: {
            $ref: './missing.yml',
          },
        },
      });
    });

    it('should leave direct external cycles as raw $refs instead of creating object cycles', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'a.yml'), {
        schema: {
          fromA: true,
          next: {
            $ref: './b.yml#/schema',
          },
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'b.yml'), {
        schema: {
          fromB: true,
          next: {
            $ref: './a.yml#/schema',
          },
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './a.yml#/schema',
        },
      });

      const result = await serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'));

      expect(result.main).to.deep.equal({
        fromA: true,
        next: {
          fromB: true,
          next: {
            $ref: './a.yml#/schema',
          },
        },
      });
      expect(() => JSON.stringify(result)).to.not.throw();
    });

    it('should leave aliased external cycles as raw $refs', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'a.yml'), {
        definitions: {
          node: {
            fromA: true,
            next: {
              $ref: './b.yml#/schema',
            },
          },
        },
        schema: {
          $ref: '#/definitions/node',
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'b.yml'), {
        schema: {
          $ref: './a.yml#/schema',
        },
      });

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './a.yml#/schema',
        },
      });

      const result = await serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'));

      expect(result.main).to.deep.equal({
        fromA: true,
        next: {
          $ref: './a.yml#/schema',
        },
      });
      expect(() => JSON.stringify(result)).to.not.throw();
    });

    it('should leave malformed external yaml refs untouched', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'bad.yml'), 'foo: [');
      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './bad.yml',
        },
      });

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'))).to.eventually
        .deep.equal({
          main: {
            $ref: './bad.yml',
          },
        });
    });

    it('should leave invalid external pointers untouched', async () => {
      const tmpDirPath = getTmpDirPath();

      serverless.utils.writeFileSync(path.join(tmpDirPath, 'ref.yml'), { foo: 'bar' });
      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: './ref.yml#/missing',
        },
      });

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml'))).to.eventually
        .deep.equal({
          main: {
            $ref: './ref.yml#/missing',
          },
        });
    });

    it('should allow explicit file refs', async () => {
      const tmpDirPath = getTmpDirPath();
      const refPath = path.join(tmpDirPath, 'ref.yml');

      serverless.utils.writeFileSync(refPath, { foo: 'bar' });
      serverless.utils.writeFileSync(path.join(tmpDirPath, 'test.yml'), {
        main: {
          $ref: pathToFileURL(refPath).href,
        },
      });

      return expect(serverless.yamlParser.parse(path.join(tmpDirPath, 'test.yml')))
        .to.eventually.have.nested.property('main.foo')
        .to.equal('bar');
    });

    it('should allow remote HTTP refs', async () => {
      const tmpFilePath = getTmpFilePath('remote-ref.yml');
      const server = http.createServer((req, res) => {
        if (req.url === '/ref.yml') {
          res.writeHead(200, { 'Content-Type': 'application/yaml' });
          res.end('foo: bar\n');
          return;
        }

        res.writeHead(404);
        res.end('not found');
      });

      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();

      serverless.utils.writeFileSync(tmpFilePath, {
        main: {
          $ref: `http://127.0.0.1:${port}/ref.yml`,
        },
      });

      try {
        const result = await serverless.yamlParser.parse(tmpFilePath);

        expect(result).to.have.nested.property('main.foo').to.equal('bar');
      } finally {
        await new Promise((resolve, reject) =>
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          })
        );
      }
    });
  });
});
