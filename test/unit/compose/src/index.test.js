'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const expect = chai.expect;

describe('test/unit/src/index.test.js', () => {
  const moduleSignals = ['SIGINT', 'SIGTERM'];
  const moduleEvents = ['uncaughtException', ...moduleSignals];
  let listenerSnapshots = [];

  const snapshotListeners = () =>
    new Map(moduleEvents.map((event) => [event, process.listeners(event)]));

  const restoreAddedListeners = (snapshot) => {
    for (const [event, previousListeners] of snapshot) {
      for (const listener of process.listeners(event)) {
        if (!previousListeners.includes(listener)) {
          process.removeListener(event, listener);
        }
      }
    }
  };

  afterEach(() => {
    for (const snapshot of listenerSnapshots) restoreAddedListeners(snapshot);
    listenerSnapshots = [];
    sinon.restore();
  });

  const loadRunComponents = (componentsServiceInstances, validateOptions = sinon.stub()) => {
    const contextInit = sinon.stub().resolves();
    const contextInstances = [];
    class FakeContext {
      constructor(config) {
        this.root = config.root;
        this.stage = config.stage;
        this.output = {
          log: sinon.stub(),
        };
        this.componentCommandsOutcomes = {};
        contextInstances.push(this);
      }

      async init() {
        return contextInit();
      }

      shutdown() {
        return undefined;
      }
    }

    const ComponentsService = sinon.stub();
    componentsServiceInstances.forEach((instance, index) => {
      ComponentsService.onCall(index).returns(instance);
    });
    const renderHelp = sinon.stub().resolves();
    const resolveConfigurationVariables = sinon.stub().resolves();
    const resolveConfigurationPath = sinon.stub().resolves('serverless-compose.yml');
    const readConfiguration = sinon.stub().resolves({
      services: {
        api: {
          path: 'api',
        },
      },
    });
    const validateConfiguration = sinon.stub();
    const handleError = sinon.stub();

    const listenerSnapshot = snapshotListeners();
    listenerSnapshots.push(listenerSnapshot);
    delete require.cache[require.resolve('../../../../lib/compose/index.js')];
    const { runComponents } = proxyquire.noCallThru().load('../../../../lib/compose', {
      'signal-exit/signals': { signals: moduleSignals },
      './render-help': renderHelp,
      './Context': FakeContext,
      './ComponentsService': ComponentsService,
      './handle-error': handleError,
      './configuration/resolve-variables': resolveConfigurationVariables,
      './configuration/resolve-path': resolveConfigurationPath,
      './configuration/read': readConfiguration,
      './configuration/validate': {
        validateConfiguration,
      },
      './validate-options': validateOptions,
      '../utils/serverless-utils/log-reporters/node': {},
    });

    return {
      runComponents,
      validateOptions,
      ComponentsService,
      contextInit,
      contextInstances,
      renderHelp,
      resolveConfigurationVariables,
      resolveConfigurationPath,
      readConfiguration,
      validateConfiguration,
      handleError,
    };
  };

  it('renders help for empty argv without resolving configuration', async () => {
    const { runComponents, validateOptions, renderHelp, resolveConfigurationPath } =
      loadRunComponents([]);

    await runComponents([]);

    expect(renderHelp).to.have.been.calledOnceWithExactly();
    expect(validateOptions).to.not.have.been.called;
    expect(resolveConfigurationPath).to.not.have.been.called;
  });

  it('renders help option without validating options or resolving configuration', async () => {
    const { runComponents, validateOptions, renderHelp, resolveConfigurationPath } =
      loadRunComponents([]);

    await runComponents(['--help']);

    expect(renderHelp).to.have.been.calledOnceWithExactly();
    expect(validateOptions).to.not.have.been.called;
    expect(resolveConfigurationPath).to.not.have.been.called;
  });

  it('rejects unsupported native options before configuration or state initialization', async () => {
    const validateOptions = sinon.spy(require('../../../../lib/compose/validate-options'));
    const {
      runComponents,
      contextInit,
      contextInstances,
      resolveConfigurationPath,
      readConfiguration,
      resolveConfigurationVariables,
      ComponentsService,
    } = loadRunComponents([], validateOptions);

    let caughtError;
    try {
      await runComponents(['deploy', '--aws-profile', 'prod']);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.have.property('code', 'UNRECOGNIZED_CLI_OPTIONS');
    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ 'aws-profile': 'prod' }),
      'deploy'
    );
    expect(resolveConfigurationPath).to.not.have.been.called;
    expect(readConfiguration).to.not.have.been.called;
    expect(resolveConfigurationVariables).to.not.have.been.called;
    expect(contextInstances).to.have.length(0);
    expect(contextInit).to.not.have.been.called;
    expect(ComponentsService).to.not.have.been.called;
  });

  it('rejects unsupported region option before configuration or state initialization', async () => {
    const validateOptions = sinon.spy(require('../../../../lib/compose/validate-options'));
    const { runComponents, contextInit, contextInstances, resolveConfigurationPath } =
      loadRunComponents([], validateOptions);

    let caughtError;
    try {
      await runComponents(['deploy', '--region', 'eu-west-1']);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.have.property('code', 'UNRECOGNIZED_CLI_OPTIONS');
    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ region: 'eu-west-1' }),
      'deploy'
    );
    expect(resolveConfigurationPath).to.not.have.been.called;
    expect(contextInstances).to.have.length(0);
    expect(contextInit).to.not.have.been.called;
  });

  it('rejects invalid stage before configuration or state initialization', async () => {
    const validateOptions = sinon.spy(require('../../../../lib/compose/validate-options'));
    const {
      runComponents,
      contextInit,
      contextInstances,
      resolveConfigurationPath,
      readConfiguration,
      resolveConfigurationVariables,
      ComponentsService,
    } = loadRunComponents([], validateOptions);

    let caughtError;
    try {
      await runComponents(['deploy', '--stage', 'foo/../../tmp/x']);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.have.property('code', 'INVALID_STAGE');
    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ stage: 'foo/../../tmp/x' }),
      'deploy'
    );
    expect(resolveConfigurationPath).to.not.have.been.called;
    expect(readConfiguration).to.not.have.been.called;
    expect(resolveConfigurationVariables).to.not.have.been.called;
    expect(contextInstances).to.have.length(0);
    expect(contextInit).to.not.have.been.called;
    expect(ComponentsService).to.not.have.been.called;
  });

  it('rejects missing stage value before configuration or state initialization', async () => {
    const { runComponents, resolveConfigurationPath, contextInit, contextInstances } =
      loadRunComponents([]);

    let caughtError;
    try {
      await runComponents(['deploy', '--stage']);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.have.property('code', 'MISSING_CLI_PARAM_VALUE');
    expect(resolveConfigurationPath).to.not.have.been.called;
    expect(contextInstances).to.have.length(0);
    expect(contextInit).to.not.have.been.called;
  });

  it('rejects repeated stage values before configuration or state initialization', async () => {
    const { runComponents, resolveConfigurationPath, contextInit, contextInstances } =
      loadRunComponents([]);

    let caughtError;
    try {
      await runComponents(['deploy', '--stage', 'dev', '--stage', 'prod']);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.have.property('code', 'UNEXPECTED_CLI_PARAM_MULTIPLE_VALUE');
    expect(resolveConfigurationPath).to.not.have.been.called;
    expect(contextInstances).to.have.length(0);
    expect(contextInit).to.not.have.been.called;
  });

  it('passes validated stage to configuration resolution and context', async () => {
    const componentsServiceInstance = {
      init: sinon.stub().resolves(),
      invokeComponentCommand: sinon.stub().resolves(),
      invokeGlobalCommand: sinon.stub().resolves(),
      allComponents: {},
    };
    const { runComponents, contextInstances, resolveConfigurationVariables } = loadRunComponents([
      componentsServiceInstance,
    ]);
    const processExit = sinon.stub(process, 'exit');
    sinon.stub(process, 'getMaxListeners').returns(10);
    sinon.stub(process, 'setMaxListeners');

    await runComponents(['deploy', '--stage', 'prod-1']);

    expect(resolveConfigurationVariables).to.have.been.calledOnceWithExactly(
      sinon.match.object,
      'serverless-compose.yml',
      'prod-1'
    );
    expect(contextInstances).to.have.length(1);
    expect(contextInstances[0].stage).to.equal('prod-1');
    expect(processExit).to.have.been.calledOnceWithExactly(0);
  });

  for (const stage of ['123', '001']) {
    it(`passes numeric-looking stage ${stage} as a string`, async () => {
      const componentsServiceInstance = {
        init: sinon.stub().resolves(),
        invokeComponentCommand: sinon.stub().resolves(),
        invokeGlobalCommand: sinon.stub().resolves(),
        allComponents: {},
      };
      const { runComponents, contextInstances, resolveConfigurationVariables } = loadRunComponents([
        componentsServiceInstance,
      ]);
      const processExit = sinon.stub(process, 'exit');
      sinon.stub(process, 'getMaxListeners').returns(10);
      sinon.stub(process, 'setMaxListeners');

      await runComponents(['deploy', '--stage', stage]);

      expect(resolveConfigurationVariables).to.have.been.calledOnceWithExactly(
        sinon.match.object,
        'serverless-compose.yml',
        stage
      );
      expect(contextInstances).to.have.length(1);
      expect(contextInstances[0].stage).to.equal(stage);
      expect(processExit).to.have.been.calledOnceWithExactly(0);
    });
  }

  it('preserves nested shortcut service commands', async () => {
    const componentsServiceInstance = {
      init: sinon.stub().resolves(),
      invokeComponentCommand: sinon.stub().resolves(),
      invokeGlobalCommand: sinon.stub().resolves(),
      allComponents: {},
    };
    const { runComponents, validateOptions } = loadRunComponents([componentsServiceInstance]);
    const processExit = sinon.stub(process, 'exit');
    sinon.stub(process, 'getMaxListeners').returns(10);
    sinon.stub(process, 'setMaxListeners');

    await runComponents(['api:deploy:function', '--function', 'handler']);

    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ function: 'handler' }),
      'deploy:function'
    );
    expect(componentsServiceInstance.invokeComponentCommand).to.have.been.calledOnceWithExactly(
      'api',
      'deploy:function',
      sinon.match({ function: 'handler' })
    );
    expect(componentsServiceInstance.invokeGlobalCommand.called).to.equal(false);
    expect(processExit).to.have.been.calledOnceWithExactly(0);
  });

  it('preserves nested commands when using --service', async () => {
    const componentsServiceInstance = {
      init: sinon.stub().resolves(),
      invokeComponentCommand: sinon.stub().resolves(),
      invokeGlobalCommand: sinon.stub().resolves(),
      allComponents: {},
    };
    const { runComponents, validateOptions } = loadRunComponents([componentsServiceInstance]);
    const processExit = sinon.stub(process, 'exit');
    sinon.stub(process, 'getMaxListeners').returns(10);
    sinon.stub(process, 'setMaxListeners');

    await runComponents(['invoke', 'local', '--service', 'api', '--function', 'handler']);

    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ function: 'handler' }),
      'invoke:local'
    );
    expect(componentsServiceInstance.invokeComponentCommand).to.have.been.calledOnceWithExactly(
      'api',
      'invoke:local',
      sinon.match({ function: 'handler' })
    );
    expect(componentsServiceInstance.invokeGlobalCommand.called).to.equal(false);
    expect(processExit).to.have.been.calledOnceWithExactly(0);
  });

  it('allows Framework options for nested passthrough commands after normalization', async () => {
    const componentsServiceInstance = {
      init: sinon.stub().resolves(),
      invokeComponentCommand: sinon.stub().resolves(),
      invokeGlobalCommand: sinon.stub().resolves(),
      allComponents: {},
    };
    const validateOptions = sinon.spy(require('../../../../lib/compose/validate-options'));
    const { runComponents } = loadRunComponents([componentsServiceInstance], validateOptions);
    const processExit = sinon.stub(process, 'exit');
    sinon.stub(process, 'getMaxListeners').returns(10);
    sinon.stub(process, 'setMaxListeners');

    await runComponents(['api:deploy:function', '--region', 'eu-west-1', '--aws-profile', 'dev']);

    expect(validateOptions).to.have.been.calledOnceWithExactly(
      sinon.match({ 'region': 'eu-west-1', 'aws-profile': 'dev' }),
      'deploy:function'
    );
    expect(componentsServiceInstance.invokeComponentCommand).to.have.been.calledOnceWithExactly(
      'api',
      'deploy:function',
      sinon.match({ 'region': 'eu-west-1', 'aws-profile': 'dev' })
    );
    expect(componentsServiceInstance.invokeGlobalCommand.called).to.equal(false);
    expect(processExit).to.have.been.calledOnceWithExactly(0);
  });
});
