'use strict';

const chai = require('chai');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const ComponentsService = require('../../../../lib/compose/ComponentsService');
const Context = require('../../../../lib/compose/Context');
const { stripVTControlCharacters: stripAnsi } = require('node:util');
const readStream = require('../read-stream');

const expect = chai.expect;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const frameworkComponentPath = path.dirname(
  require.resolve('../../../../lib/compose/components/framework/index.js')
);

describe('test/unit/src/components-service.test.js', () => {
  let componentsService;
  before(async () => {
    const configuration = {
      name: 'test-service',
      services: {
        resources: {
          path: 'resources',
        },
        consumer: {
          path: 'consumer',
          params: {
            workerQueueArn: '${resources.WorkerQueueArn}',
          },
        },
        anotherservice: {
          component: '@foo/bar',
          path: 'another',
          dependsOn: 'consumer',
        },
      },
    };
    const contextConfig = {
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    };
    const context = new Context(contextConfig);
    await context.init();
    componentsService = new ComponentsService(context, configuration, {});
    await componentsService.init();
  });

  it('has properly resolved components', () => {
    expect(Object.getPrototypeOf(componentsService.allComponents)).to.equal(null);
    expect(componentsService.allComponents).to.deep.equal({
      anotherservice: {
        dependencies: ['consumer'],
        inputs: {
          component: '@foo/bar',
          dependsOn: 'consumer',
          path: 'another',
        },
        path: '@foo/bar',
      },
      consumer: {
        dependencies: ['resources'],
        inputs: {
          component: 'serverless-framework',
          params: {
            workerQueueArn: '${resources.WorkerQueueArn}',
          },
          path: 'consumer',
        },
        path: frameworkComponentPath,
      },
      resources: {
        dependencies: [],
        inputs: {
          component: 'serverless-framework',
          path: 'resources',
        },
        path: frameworkComponentPath,
      },
    });
  });

  it('does not treat inherited object keys as internal components', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsService(
      context,
      {
        services: {
          resources: {
            component: 'constructor',
            path: 'resources',
          },
        },
      },
      {}
    );

    await localComponentsService.init();

    expect(localComponentsService.allComponents.resources.path).to.equal('constructor');
  });

  it('has properly resolved components graph', () => {
    expect(componentsService.componentsGraph.nodeCount()).to.equal(3);
    expect(componentsService.componentsGraph.edgeCount()).to.equal(2);
    expect(componentsService.componentsGraph.sinks()).to.deep.equal(['resources']);
    expect(componentsService.componentsGraph.sources()).to.deep.equal(['anotherservice']);
  });

  it('throws an error when configuration has components with the same type and path', async () => {
    const configuration = {
      name: 'test-service',
      services: {
        resources: {
          path: 'resources',
        },
        duplicated: {
          path: 'resources',
          params: {
            workerQueueArn: '${resources.WorkerQueueArn}',
          },
        },
        anotherservice: {
          path: 'another',
          dependsOn: 'consumer',
        },
      },
    };
    const contextConfig = {
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    };
    const context = new Context(contextConfig);
    await context.init();
    componentsService = new ComponentsService(context, configuration, {});

    await expect(componentsService.init()).to.eventually.be.rejectedWith(
      'Service "resources" has the same "path" as the following services: "duplicated". This is currently not supported because deploying the same service in parallel generates packages in the same ".serverless/" directory which can cause conflicts.'
    );
  });

  it('rejects circular component dependencies', async () => {
    const configuration = {
      name: 'cycle-test',
      services: {
        resources: {
          component: '@foo/resources',
          path: 'resources',
          dependsOn: 'consumer',
        },
        consumer: {
          component: '@foo/consumer',
          path: 'consumer',
          dependsOn: 'resources',
        },
      },
    };
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsService(context, configuration, {});

    await expect(localComponentsService.init()).to.eventually.be.rejected.and.have.property(
      'code',
      'CIRCULAR_GRAPH_DEPENDENCIES'
    );
  });

  it('rejects inherited dependency names that are not real services', async () => {
    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
          dependsOn: 'constructor',
        },
      },
    };
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsService(context, configuration, {});

    await expect(localComponentsService.init()).to.eventually.be.rejected.and.have.property(
      'code',
      'REFERENCED_COMPONENT_DOES_NOT_EXIST'
    );
  });

  it('rejects reserved service aliases during initialization', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsService(
      context,
      {
        services: {
          constructor: {
            path: 'resources',
          },
        },
      },
      {}
    );

    await expect(localComponentsService.init()).to.eventually.be.rejected.and.have.property(
      'code',
      'INVALID_SERVICE_ALIAS'
    );
  });

  it('does not resolve inherited output paths from prototypes', async () => {
    const loadComponent = sinon.stub().callsFake(async ({ alias, inputs }) => ({
      inputs,
      async deploy() {
        return undefined;
      },
      commands: {},
      alias,
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({
      foundation: {
        endpoint: 'https://example.com',
      },
    });

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
          params: {
            inherited: '${foundation.constructor.name}',
          },
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();

    await expect(localComponentsService.deploy()).to.eventually.be.rejected.and.have.property(
      'code',
      'REFERENCED_OUTPUT_DOES_NOT_EXIST'
    );
  });

  it('resolves own array output properties like length', async () => {
    const loadComponent = sinon.stub().callsFake(async ({ alias, inputs }) => ({
      inputs,
      async deploy() {
        return undefined;
      },
      commands: {},
      alias,
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({
      foundation: {
        items: ['one', 'two', 'three'],
      },
    });

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
          params: {
            count: '${foundation.items.length}',
          },
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();
    await localComponentsService.deploy();

    expect(loadComponent.secondCall.args[0].inputs.params.count).to.equal(3);
  });

  it('deploys dependencies before dependents', async () => {
    const order = [];
    const loadComponent = sinon.stub().callsFake(async ({ alias }) => ({
      async deploy() {
        order.push(alias);
      },
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });

    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({});

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
        },
        app: {
          component: '@foo/app',
          path: 'app',
          dependsOn: 'api',
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();
    await localComponentsService.deploy();

    expect(order).to.deep.equal(['foundation', 'api', 'app']);
  });

  it('removes dependents before dependencies', async () => {
    const order = [];
    const loadComponent = sinon.stub().callsFake(async ({ alias }) => ({
      async remove() {
        order.push(alias);
      },
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });

    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({});
    context.stateStorage.removeState = async () => {};

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
        },
        app: {
          component: '@foo/app',
          path: 'app',
          dependsOn: 'api',
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();
    await localComponentsService.remove();

    expect(order).to.deep.equal(['app', 'api', 'foundation']);
  });

  it('deploys branched DAGs in dependency order', async () => {
    const order = [];
    const loadComponent = sinon.stub().callsFake(async ({ alias }) => ({
      async deploy() {
        order.push(alias);
      },
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });

    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({});

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
        },
        worker: {
          component: '@foo/worker',
          path: 'worker',
          dependsOn: 'foundation',
        },
        app: {
          component: '@foo/app',
          path: 'app',
          dependsOn: ['api', 'worker'],
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();
    await localComponentsService.deploy();

    const foundationIndex = order.indexOf('foundation');
    const apiIndex = order.indexOf('api');
    const workerIndex = order.indexOf('worker');
    const appIndex = order.indexOf('app');

    expect(foundationIndex).to.be.lessThan(apiIndex);
    expect(foundationIndex).to.be.lessThan(workerIndex);
    expect(apiIndex).to.be.lessThan(appIndex);
    expect(workerIndex).to.be.lessThan(appIndex);
  });

  it('skips downstream graph layers after a failure', async () => {
    const order = [];
    const loadComponent = sinon.stub().callsFake(async ({ alias, context }) => ({
      async deploy() {
        context.progresses.start(alias, 'deploying');
        order.push(alias);
        if (alias === 'api') {
          throw new Error('boom');
        }
        context.progresses.success(alias, 'deployed');
      },
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });

    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({});

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
          dependsOn: 'foundation',
        },
        app: {
          component: '@foo/app',
          path: 'app',
          dependsOn: 'api',
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {});
    await localComponentsService.init();
    await localComponentsService.deploy();

    expect(order).to.deep.equal(['foundation', 'api']);
    expect(context.componentCommandsOutcomes.foundation).to.equal('success');
    expect(context.componentCommandsOutcomes.api).to.equal('failure');
    expect(context.componentCommandsOutcomes.app).to.equal('skip');
  });

  it('honors max-concurrency for parallel component commands', async () => {
    const release = createDeferred();
    const twoStarted = createDeferred();
    const started = [];
    let active = 0;
    let maxActive = 0;
    const loadComponent = sinon.stub().callsFake(async ({ alias }) => ({
      async info() {
        started.push(alias);
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (active === 2) {
          twoStarted.resolve();
        }
        await release.promise;
        active -= 1;
      },
    }));
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });

    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage.readComponentsOutputs = async () => ({});

    const configuration = {
      services: {
        foundation: {
          component: '@foo/foundation',
          path: 'foundation',
        },
        api: {
          component: '@foo/api',
          path: 'api',
        },
        worker: {
          component: '@foo/worker',
          path: 'worker',
        },
      },
    };

    const localComponentsService = new ComponentsServiceWithStubbedLoad(context, configuration, {
      'max-concurrency': 2,
    });
    await localComponentsService.init();

    const infoPromise = localComponentsService.info({ 'max-concurrency': 2 });

    await twoStarted.promise;

    expect(active).to.equal(2);
    expect(maxActive).to.equal(2);
    expect(started.length).to.equal(2);

    release.resolve();
    await infoPromise;

    expect(maxActive).to.equal(2);
    expect(started).to.have.members(['foundation', 'api', 'worker']);
  });

  it('correctly handles outputs command', async () => {
    const configuration = {
      name: 'test-service',
      services: {
        resources: {
          path: 'resources',
        },
        anotherservice: {
          path: 'another',
          dependsOn: 'consumer',
        },
      },
    };
    const contextConfig = {
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    };
    const mockedStateStorage = {
      readServiceState: () => ({ id: 123, detectedFrameworkVersion: '9.9.9' }),
      readComponentsOutputs: () => {
        return {
          resources: {
            somethingelse: '123',
          },
          anotherservice: {
            endpoint: 'https://example.com',
            additional: '123',
          },
        };
      },
    };
    const context = new Context(contextConfig);
    await context.init();
    context.stateStorage = mockedStateStorage;
    componentsService = new ComponentsService(context, configuration, {});

    await componentsService.outputs();
    expect(stripAnsi(await readStream(context.output.stdout))).to.equal(
      [
        'resources: ',
        '  somethingelse: 123',
        'anotherservice: ',
        '  endpoint: https://example.com',
        '  additional: 123',
        '',
      ].join('\n')
    );
  });

  it('correctly handles outputs command for single component', async () => {
    const configuration = {
      name: 'test-service',
      services: {
        resources: {
          path: 'resources',
        },
        anotherservice: {
          path: 'another',
          dependsOn: 'consumer',
        },
      },
    };
    const contextConfig = {
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    };
    const mockedStateStorage = {
      readServiceState: () => ({ id: 123, detectedFrameworkVersion: '9.9.9' }),
      readComponentOutputs: () => {
        return {
          somethingelse: '123',
        };
      },
    };
    const context = new Context(contextConfig);
    await context.init();
    context.stateStorage = mockedStateStorage;
    componentsService = new ComponentsService(context, configuration, {});

    await componentsService.outputs({ componentName: 'resources' });
    expect(stripAnsi(await readStream(context.output.stdout))).to.equal(
      ['somethingelse: 123', ''].join('\n')
    );
  });

  it('rejects global outputs command when no deployed service outputs exist', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage = {
      readComponentsOutputs: () => Object.create(null),
    };

    const localComponentsService = new ComponentsService(
      context,
      {
        name: 'test-service',
        services: {},
      },
      {}
    );

    await expect(localComponentsService.outputs()).to.eventually.be.rejected.and.have.property(
      'code',
      'NO_DEPLOYED_SERVICES_FOUND'
    );
  });

  it('renders non-empty null-prototype outputs', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    context.stateStorage = {
      readComponentsOutputs: () =>
        Object.assign(Object.create(null), {
          resources: {
            endpoint: 'https://example.com',
          },
        }),
    };

    const localComponentsService = new ComponentsService(
      context,
      {
        name: 'test-service',
        services: {},
      },
      {}
    );

    await localComponentsService.outputs();

    expect(stripAnsi(await readStream(context.output.stdout))).to.equal(
      ['resources: ', '  endpoint: https://example.com', ''].join('\n')
    );
  });

  it('does not add graph edges for services with no dependencies', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsService(
      context,
      {
        name: 'test-service',
        services: {
          resources: {
            path: 'resources',
          },
          api: {
            path: 'api',
          },
        },
      },
      {}
    );

    await localComponentsService.init();

    expect(localComponentsService.allComponents.resources.dependencies).to.deep.equal([]);
    expect(localComponentsService.allComponents.api.dependencies).to.deep.equal([]);
    expect(localComponentsService.componentsGraph.edgeCount()).to.equal(0);
  });

  it('returns without loading components when graph execution has no nodes', async () => {
    const loadComponent = sinon.stub();
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        name: 'test-service',
        services: {},
      },
      {}
    );

    await localComponentsService.init();
    await localComponentsService.executeComponentsGraph({ method: 'deploy' });
    await localComponentsService.instantiateComponents();

    expect(loadComponent).to.not.have.been.called;
  });

  it('rejects reserved component aliases in direct command invocation', async () => {
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();
    const localComponentsService = new ComponentsService(context, { services: {} }, {});

    await expect(
      localComponentsService.invokeComponentCommand('__proto__', 'outputs', {})
    ).to.eventually.be.rejected.and.have.property('code', 'INVALID_SERVICE_ALIAS');
  });

  it('rejects inherited Object prototype command names', async () => {
    const loadComponent = sinon.stub().resolves({
      commands: {},
    });
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        services: {
          foundation: {
            component: '@foo/foundation',
            path: 'foundation',
          },
        },
      },
      {}
    );
    await localComponentsService.init();

    await expect(
      localComponentsService.invokeComponentCommand('foundation', 'toString', {})
    ).to.eventually.be.rejected.and.have.property('code', 'COMPONENT_COMMAND_NOT_FOUND');
  });

  it('does not invoke inherited custom commands', async () => {
    const inheritedHandler = sinon.spy();
    const loadComponent = sinon.stub().resolves({
      commands: Object.create({
        inherited: {
          handler: inheritedHandler,
        },
      }),
    });
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        services: {
          foundation: {
            component: '@foo/foundation',
            path: 'foundation',
          },
        },
      },
      {}
    );
    await localComponentsService.init();

    await expect(
      localComponentsService.invokeComponentCommand('foundation', 'inherited', {})
    ).to.eventually.be.rejected.and.have.property('code', 'COMPONENT_COMMAND_NOT_FOUND');
    expect(inheritedHandler.called).to.equal(false);
  });

  it('rejects custom commands without callable handlers', async () => {
    const loadComponent = sinon.stub().resolves({
      commands: {
        broken: {
          handler: 'not-a-function',
        },
      },
    });
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        services: {
          foundation: {
            component: '@foo/foundation',
            path: 'foundation',
          },
        },
      },
      {}
    );
    await localComponentsService.init();

    await expect(
      localComponentsService.invokeComponentCommand('foundation', 'broken', {})
    ).to.eventually.be.rejected.and.have.property('code', 'COMPONENT_COMMAND_NOT_FOUND');
  });

  it('passes nested commands through for Serverless Framework services', async () => {
    const command = sinon.stub().resolves();

    class FakeServerlessFramework {
      async command(commandName, options) {
        return command(commandName, options);
      }
    }

    const loadComponent = sinon.stub().resolves(new FakeServerlessFramework());
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
      '../../lib/compose/components/framework': FakeServerlessFramework,
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        services: {
          api: {
            path: 'api',
          },
        },
      },
      {}
    );
    await localComponentsService.init();

    const cases = [
      {
        command: 'deploy:function',
        options: { function: 'handler' },
      },
      {
        command: 'deploy:list:functions',
        options: {},
      },
      {
        command: 'rollback:function',
        options: { 'function': 'handler', 'function-version': '23' },
      },
      {
        command: 'invoke:local',
        options: { function: 'handler' },
      },
    ];

    for (const testCase of cases) {
      await localComponentsService.invokeComponentCommand(
        'api',
        testCase.command,
        testCase.options
      );
    }

    expect(command).to.have.callCount(cases.length);
    cases.forEach((testCase, index) => {
      expect(command.getCall(index).args).to.deep.equal([testCase.command, testCase.options]);
    });
    expect(context.componentCommandsOutcomes.api).to.equal('success');
  });

  it('supports default commands implemented on component prototypes', async () => {
    const deploy = sinon.stub().resolves();

    class FakeComponent {
      async deploy(options) {
        return deploy(options);
      }
    }

    const loadComponent = sinon.stub().resolves(new FakeComponent());
    const ComponentsServiceWithStubbedLoad = proxyquire('../../../../lib/compose/ComponentsService', {
      './load': { loadComponent },
    });
    const context = new Context({
      root: process.cwd(),
      stage: 'dev',
      disableIO: true,
      configuration: {},
    });
    await context.init();

    const localComponentsService = new ComponentsServiceWithStubbedLoad(
      context,
      {
        services: {
          foundation: {
            component: '@foo/foundation',
            path: 'foundation',
          },
        },
      },
      {}
    );
    await localComponentsService.init();
    await localComponentsService.invokeComponentCommand('foundation', 'deploy', { force: true });

    expect(deploy.calledOnceWithExactly({ force: true })).to.equal(true);
    expect(context.componentCommandsOutcomes.foundation).to.equal('success');
  });
});
