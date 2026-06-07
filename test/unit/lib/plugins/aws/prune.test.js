'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const AwsPrune = require('../../../../../lib/plugins/aws/prune');
const AwsProvider = require('../../../../../lib/plugins/aws/provider');
const Serverless = require('../../../../../lib/serverless');
const ServerlessError = require('../../../../../lib/serverless-error');
const CLI = require('../../../../../lib/classes/cli');

describe('AwsPrune', () => {
  let serverless;
  let awsPrune;

  beforeEach(() => {
    serverless = new Serverless({ commands: [], options: {} });
    serverless.cli = new CLI(serverless);
    serverless.service.provider = { name: 'aws', versionFunctions: true };
    serverless.service.functions = {
      FunctionA: { name: 'service-FunctionA' },
      FunctionB: { name: 'service-FunctionB' },
    };
    serverless.service.layers = {
      LayerA: { name: 'layer-LayerA' },
    };
    serverless.service.getAllLayers = () => Object.keys(serverless.service.layers);
    serverless.service.getLayer = (key) => serverless.service.layers[key];
    const options = { stage: 'dev', region: 'us-east-1' };
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    awsPrune = new AwsPrune(serverless, options);
  });

  describe('#constructor()', () => {
    it('should define deploy hooks', () => {
      expect(awsPrune.hooks['before:deploy:deploy']).to.be.a('function');
      expect(awsPrune.hooks['after:deploy:deploy']).to.be.a('function');
    });
  });

  describe('#resolvePruneConfig()', () => {
    it('should return null when pruning is not configured', () => {
      expect(awsPrune.resolvePruneConfig()).to.equal(null);
    });

    it('should return the default number when enabled with true', () => {
      serverless.service.provider.pruneFunctionVersions = true;
      expect(awsPrune.resolvePruneConfig()).to.deep.equal({ number: 10 });
    });

    it('should return an explicit number from object configuration', () => {
      serverless.service.provider.pruneFunctionVersions = { number: 20 };
      expect(awsPrune.resolvePruneConfig()).to.deep.equal({ number: 20 });
    });

    it('should return null when explicitly disabled', () => {
      serverless.service.provider.pruneFunctionVersions = false;
      expect(awsPrune.resolvePruneConfig()).to.equal(null);
    });

    it('should throw when configuration is invalid', () => {
      serverless.service.provider.pruneFunctionVersions = { number: 'invalid' };
      expect(() => awsPrune.resolvePruneConfig()).to.throw(ServerlessError);
    });
  });

  describe('#shouldVersionFunction()', () => {
    it('should skip functions with versionFunction set to false', () => {
      serverless.service.functions.FunctionA.versionFunction = false;
      expect(awsPrune.shouldVersionFunction('FunctionA')).to.equal(false);
      expect(awsPrune.shouldVersionFunction('FunctionB')).to.equal(true);
    });
  });

  describe('#validateConfiguration()', () => {
    it('should throw when versionFunctions is false', () => {
      serverless.service.provider.pruneFunctionVersions = true;
      serverless.service.provider.versionFunctions = false;

      expect(() => awsPrune.validateConfiguration()).to.throw(ServerlessError);
    });

    it('should not throw when pruning is disabled', () => {
      serverless.service.provider.versionFunctions = false;
      expect(() => awsPrune.validateConfiguration()).to.not.throw();
    });
  });

  describe('#selectPruneVersionsForFunction()', () => {
    beforeEach(() => {
      serverless.service.provider.pruneFunctionVersions = { number: 2 };
    });

    it('should keep the requested number of newest versions', () => {
      const versions = [{ Version: '1' }, { Version: '2' }, { Version: '3' }, { Version: '4' }];
      const result = awsPrune.selectPruneVersionsForFunction(versions, []);
      expect(result).to.deep.equal(['2', '1']);
    });

    it('should not delete $LATEST or aliased versions', () => {
      const versions = [
        { Version: '$LATEST' },
        { Version: '1' },
        { Version: '2' },
        { Version: '3' },
        { Version: '4' },
        { Version: '5' },
      ];
      const aliases = [
        { FunctionVersion: '1' },
        { FunctionVersion: '3' },
        { FunctionVersion: '4' },
      ];
      const result = awsPrune.selectPruneVersionsForFunction(versions, aliases);
      expect(result).to.not.include('$LATEST');
      expect(result).to.not.include('1');
      expect(result).to.not.include('3');
      expect(result).to.not.include('4');
    });

    it('should not delete aliased versions when alias version is a number', () => {
      const versions = [{ Version: '1' }, { Version: '2' }, { Version: '3' }, { Version: '4' }];
      const aliases = [{ FunctionVersion: 2 }];
      const result = awsPrune.selectPruneVersionsForFunction(versions, aliases);
      expect(result).to.not.include('2');
    });
  });

  describe('#selectPruneVersionsForLayer()', () => {
    beforeEach(() => {
      serverless.service.provider.pruneFunctionVersions = { number: 2 };
    });

    it('should keep the requested number of newest layer versions', () => {
      const versions = [{ Version: 1 }, { Version: 2 }, { Version: 3 }, { Version: 4 }];
      const result = awsPrune.selectPruneVersionsForLayer(versions);
      expect(result).to.deep.equal([2, 1]);
    });
  });

  describe('#pruneFunctions()', () => {
    let listVersionsStub;
    let listAliasesStub;
    let deleteStub;

    beforeEach(() => {
      serverless.service.provider.pruneFunctionVersions = { number: 2 };
      listVersionsStub = sinon.stub(awsPrune, 'listVersionsForFunction');
      listAliasesStub = sinon.stub(awsPrune, 'listAliasesForFunction');
      deleteStub = sinon.stub(awsPrune, 'deleteVersionsForFunction').resolves();
    });

    afterEach(() => {
      listVersionsStub.restore();
      listAliasesStub.restore();
      deleteStub.restore();
    });

    it('should delete old versions of functions', async () => {
      listVersionsStub.resolves([
        { Version: '1' },
        { Version: '2' },
        { Version: '3' },
        { Version: '4' },
        { Version: '5' },
      ]);
      listAliasesStub.resolves([]);

      await awsPrune.pruneFunctions();

      expect(deleteStub.callCount).to.equal(2);
      expect(deleteStub.getCall(0).args).to.deep.equal(['service-FunctionA', ['3', '2', '1']]);
    });

    it('should skip functions with versionFunction set to false', async () => {
      serverless.service.functions.FunctionA.versionFunction = false;
      listVersionsStub.resolves([{ Version: '1' }, { Version: '2' }, { Version: '3' }]);
      listAliasesStub.resolves([]);

      await awsPrune.pruneFunctions();

      expect(deleteStub.calledOnce).to.equal(true);
      expect(deleteStub.firstCall.args[0]).to.equal('service-FunctionB');
    });
  });

  describe('#postDeploy()', () => {
    it('should prune functions and layers when enabled', async () => {
      serverless.service.provider.pruneFunctionVersions = true;
      const pruneFunctionsStub = sinon.stub(awsPrune, 'pruneFunctions').resolves();
      const pruneLayersStub = sinon.stub(awsPrune, 'pruneLayers').resolves();

      await awsPrune.postDeploy();

      expect(pruneFunctionsStub.calledOnce).to.equal(true);
      expect(pruneLayersStub.calledOnce).to.equal(true);
      pruneFunctionsStub.restore();
      pruneLayersStub.restore();
    });

    it('should prune when number is 0', async () => {
      serverless.service.provider.pruneFunctionVersions = { number: 0 };
      const pruneFunctionsStub = sinon.stub(awsPrune, 'pruneFunctions').resolves();
      const pruneLayersStub = sinon.stub(awsPrune, 'pruneLayers').resolves();

      await awsPrune.postDeploy();

      expect(pruneFunctionsStub.calledOnce).to.equal(true);
      pruneFunctionsStub.restore();
      pruneLayersStub.restore();
    });

    it('should not prune when disabled', async () => {
      const pruneFunctionsStub = sinon.stub(awsPrune, 'pruneFunctions').resolves();
      const pruneLayersStub = sinon.stub(awsPrune, 'pruneLayers').resolves();

      await awsPrune.postDeploy();

      expect(pruneFunctionsStub.called).to.equal(false);
      expect(pruneLayersStub.called).to.equal(false);
      pruneFunctionsStub.restore();
      pruneLayersStub.restore();
    });
  });
});
