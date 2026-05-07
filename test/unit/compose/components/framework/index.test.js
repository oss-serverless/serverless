'use strict';

const fs = require('node:fs').promises;
const path = require('path');
const proxyquire = require('proxyquire');
const chai = require('chai');
const sinon = require('sinon');
const Context = require('../../../../../lib/compose/Context');
const ComponentContext = require('../../../../../lib/compose/ComponentContext');
const { validateComponentInputs } = require('../../../../../lib/compose/configuration/validate');
const { configSchema } = require('../../../../../lib/compose/components/framework/configuration');
const ServerlessFramework = require('../../../../../lib/compose/components/framework');
const { outputFile, remove } = require('../../../../lib/compose/fs');

const expect = chai.expect;

const createSpawnExecution = ({ code = 0, stdout = '', stderr = '' } = {}) => {
  const child = {
    stdout: {
      on: (event, callback) => {
        if (event === 'data' && stdout) callback(Buffer.from(stdout));
      },
    },
    stderr: {
      on: (event, callback) => {
        if (event === 'data' && stderr) callback(Buffer.from(stderr));
      },
    },
    on: (event, callback) => {
      if (event === 'close') process.nextTick(() => callback(code));
    },
    kill: sinon.stub(),
  };
  const execution = Promise.resolve({
    child,
    stdoutBuffer: Buffer.from(stdout),
    stderrBuffer: Buffer.from(stderr),
    stdBuffer: Buffer.from(`${stdout}${stderr}`),
    code,
    signal: null,
  });

  execution.child = child;
  execution.stdout = child.stdout;
  execution.stderr = child.stderr;
  execution.std = null;

  return execution;
};

/**
 * @returns {Promise<ComponentContext>}
 */
const getContext = async () => {
  const contextConfig = {
    root: process.cwd(),
    stage: 'dev',
    disableIO: true,
    configuration: {},
  };
  const context = new Context(contextConfig);
  await context.init();
  const componentContext = new ComponentContext('id', context);
  await componentContext.init();
  return componentContext;
};

describe('test/unit/components/framework/index.test.js', () => {
  it('correctly handles deploy', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.deploy();

    expect(spawnStub).to.be.calledTwice;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['deploy', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(spawnStub.getCall(1).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(1).args[1]).to.deep.equal(['info', '--verbose', '--stage', 'dev']);
    expect(spawnStub.getCall(1).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('supports the shared spawn helper promise shape when executing framework commands', async () => {
    const spawnStub = sinon.stub();
    spawnStub.onFirstCall().returns(
      createSpawnExecution({
        stdout: 'region: us-east-1\n\nStack Outputs:\n  Key: Output',
      })
    );
    spawnStub.onSecondCall().returns(
      createSpawnExecution({
        stdout: 'region: us-east-1\n\nStack Outputs:\n  Key: Output',
      })
    );
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.deploy();

    expect(spawnStub).to.be.calledTwice;
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly handles package', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.package();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['package', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly handles refresh-outputs', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.refreshOutputs();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['info', '--verbose', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly recognizes region in inputs', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, {
      path: 'path',
      region: 'eu-central-1',
    });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.refreshOutputs();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal([
      'info',
      '--verbose',
      '--stage',
      'dev',
      '--region',
      'eu-central-1',
    ]);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly recognizes config in inputs', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, {
      path: 'path',
      config: 'different.yml',
    });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.refreshOutputs();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal([
      'info',
      '--verbose',
      '--stage',
      'dev',
      '--config',
      'different.yml',
    ]);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly set compose-specific specific env vars', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.refreshOutputs();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[2].env.SLS_DISABLE_AUTO_UPDATE).to.equal('1');
    expect(spawnStub.getCall(0).args[2].env.SLS_COMPOSE).to.equal('1');
  });

  it('passes through serverless logging env vars to child processes', async () => {
    const originalLogLevel = process.env.SLS_LOG_LEVEL;
    const originalLogDebug = process.env.SLS_LOG_DEBUG;

    try {
      process.env.SLS_LOG_LEVEL = 'info';
      process.env.SLS_LOG_DEBUG = 'aws';

      const spawnStub = sinon.stub().returns({
        on: (arg, cb) => {
          if (arg === 'close') cb(0);
        },
        stdout: {
          on: (arg, cb) => {
            const data = 'region: us-east-1\n\nStack Outputs:\n  Key: Output';
            if (arg === 'data') cb(data);
          },
        },
        kill: () => {},
      });
      const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
        '../../utils/spawn': spawnStub,
      });

      const context = await getContext();
      const component = new FrameworkComponent('some-id', context, { path: 'path' });
      context.state.detectedFrameworkVersion = '9.9.9';
      await component.refreshOutputs();

      expect(spawnStub).to.be.calledOnce;
      expect(spawnStub.getCall(0).args[2].env.SLS_LOG_LEVEL).to.equal('info');
      expect(spawnStub.getCall(0).args[2].env.SLS_LOG_DEBUG).to.equal('aws');
    } finally {
      if (originalLogLevel == null) delete process.env.SLS_LOG_LEVEL;
      else process.env.SLS_LOG_LEVEL = originalLogLevel;
      if (originalLogDebug == null) delete process.env.SLS_LOG_DEBUG;
      else process.env.SLS_LOG_DEBUG = originalLogDebug;
    }
  });

  it('correctly handles refresh-outputs with malformed info outputs', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          // Simulate the output we get with Serverless Domain Manager
          // https://github.com/serverless/compose/issues/105
          const data =
            'region: us-east-1\n\n' +
            'Stack Outputs:\n' +
            '  Key: Output\n' +
            'Serverless Domain Manager:\n' +
            '  Domain Name: example.com\n' +
            '  ------------------------';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.refreshOutputs();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['info', '--verbose', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({ detectedFrameworkVersion: '9.9.9' });
    expect(context.outputs).to.deep.equal({ Key: 'Output' });
  });

  it('correctly handles remove', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      kill: () => {},
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state = {
      key: 'val',
      detectedFrameworkVersion: '9.9.9',
    };
    context.outputs = {
      outputkey: 'outputval',
    };

    await component.remove();

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['remove', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
    expect(context.state).to.deep.equal({});
    expect(context.outputs).to.deep.equal({});
  });

  it('correctly handles command', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      kill: () => {},
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'custom-path' });
    context.state.detectedFrameworkVersion = '9.9.9';

    await component.command('print', { key: 'val', flag: true, o: 'shortoption' });

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal([
      'print',
      '--key=val',
      '--flag',
      '-o',
      'shortoption',
      '--stage',
      'dev',
    ]);
    expect(spawnStub.getCall(0).args[2].cwd).to.equal('custom-path');
  });

  it('passes documented nested Framework commands through to Serverless CLI', async () => {
    const cases = [
      {
        command: 'deploy:function',
        options: { function: 'handler' },
        expectedArgs: ['deploy', 'function', '--function=handler', '--stage', 'dev'],
      },
      {
        command: 'deploy:list',
        options: { 'region': 'us-east-1', 'aws-profile': 'dev-profile' },
        expectedArgs: [
          'deploy',
          'list',
          '--region=us-east-1',
          '--aws-profile=dev-profile',
          '--stage',
          'dev',
        ],
      },
      {
        command: 'deploy:list:functions',
        options: {},
        expectedArgs: ['deploy', 'list', 'functions', '--stage', 'dev'],
      },
      {
        command: 'rollback:function',
        options: { 'function': 'handler', 'function-version': '23' },
        expectedArgs: [
          'rollback',
          'function',
          '--function=handler',
          '--function-version=23',
          '--stage',
          'dev',
        ],
      },
      {
        command: 'invoke',
        options: { function: 'handler', data: '{"ok":true}', raw: true },
        expectedArgs: [
          'invoke',
          '--function=handler',
          '--data={"ok":true}',
          '--raw',
          '--stage',
          'dev',
        ],
      },
      {
        command: 'invoke:local',
        options: { function: 'handler', path: 'event.json' },
        expectedArgs: [
          'invoke',
          'local',
          '--function=handler',
          '--path=event.json',
          '--stage',
          'dev',
        ],
      },
    ];

    for (const testCase of cases) {
      const spawnStub = sinon.stub().returns({
        on: (arg, cb) => {
          if (arg === 'close') cb(0);
        },
        kill: () => {},
      });
      const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
        '../../utils/spawn': spawnStub,
      });

      const context = await getContext();
      const component = new FrameworkComponent('some-id', context, { path: 'path' });
      context.state.detectedFrameworkVersion = '9.9.9';

      await component.command(testCase.command, testCase.options);

      expect(spawnStub).to.be.calledOnce;
      expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
      expect(spawnStub.getCall(0).args[1]).to.deep.equal(testCase.expectedArgs);
      expect(spawnStub.getCall(0).args[2].cwd).to.equal('path');
      expect(spawnStub.getCall(0).args[2].stdio).to.equal('inherit');
    }
  });

  it('preserves repeated passthrough options', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      kill: () => {},
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';

    await component.command('invoke:local', {
      function: 'handler',
      env: ['VAR1=value1', 'VAR2=value2'],
      e: ['SHORT1=value1', 'SHORT2=value2'],
    });

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[1]).to.deep.equal([
      'invoke',
      'local',
      '--function=handler',
      '--env=VAR1=value1',
      '--env=VAR2=value2',
      '-e',
      'SHORT1=value1',
      '-e',
      'SHORT2=value2',
      '--stage',
      'dev',
    ]);
  });

  it('shows command-specific progress for selected passthrough commands', async () => {
    const cases = [
      {
        command: 'deploy:function',
        options: { function: 'handler' },
        start: 'deploying function "handler"',
        success: 'deployed function "handler"',
      },
      {
        command: 'deploy:list',
        options: {},
        start: 'listing deployments',
        success: 'listed deployments',
      },
      {
        command: 'deploy:list:functions',
        options: {},
        start: 'listing function deployments',
        success: 'listed function deployments',
      },
      {
        command: 'rollback:function',
        options: { 'function': 'handler', 'function-version': '23' },
        start: 'rolling back function "handler"',
        success: 'rolled back function "handler"',
      },
      {
        command: 'invoke',
        options: { function: 'handler' },
        start: 'invoking function "handler"',
        success: 'invoked function "handler"',
      },
      {
        command: 'invoke',
        options: { f: 'handler' },
        start: 'invoking function "handler"',
        success: 'invoked function "handler"',
      },
      {
        command: 'invoke:local',
        options: { function: 'handler' },
        start: 'invoking function locally "handler"',
        success: 'invoked function locally "handler"',
      },
    ];

    for (const testCase of cases) {
      const spawnStub = sinon.stub().returns({
        on: (arg, cb) => {
          if (arg === 'close') cb(0);
        },
        kill: () => {},
      });
      const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
        '../../utils/spawn': spawnStub,
      });

      const context = await getContext();
      sinon.spy(context, 'startProgress');
      sinon.spy(context, 'successProgress');

      const component = new FrameworkComponent('some-id', context, { path: 'path' });
      context.state.detectedFrameworkVersion = '9.9.9';

      await component.command(testCase.command, testCase.options);

      expect(context.startProgress).to.have.been.calledOnceWithExactly(testCase.start);
      expect(context.successProgress).to.have.been.calledOnceWithExactly(testCase.success);
      expect(spawnStub.getCall(0).args[2].stdio).to.equal('inherit');
    }
  });

  it('does not show special progress for unknown passthrough commands', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      kill: () => {},
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    sinon.spy(context, 'startProgress');
    sinon.spy(context, 'successProgress');

    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';

    await component.command('print', {});

    expect(context.startProgress.called).to.equal(false);
    expect(context.successProgress.called).to.equal(false);
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['print', '--stage', 'dev']);
    expect(spawnStub.getCall(0).args[2].stdio).to.equal('inherit');
  });

  it('correctly ignores `stage` from options to not duplicate it when executing command', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      kill: () => {},
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'custom-path' });
    context.state.detectedFrameworkVersion = '9.9.9';

    await component.command('print', { key: 'val', flag: true, stage: 'dev' });

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[1]).to.deep.equal([
      'print',
      '--key=val',
      '--flag',
      '--stage',
      'dev',
    ]);
  });

  it('reports detected unsupported framework version', async () => {
    const spawnExtStub = sinon.stub().resolves({
      stdoutBuffer: Buffer.from('Framework Core: 2.1.0'),
    });

    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnExtStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'foo' });
    await expect(component.deploy()).to.eventually.be.rejectedWith(
      'The installed version of Serverless Framework (2.1.0) is not supported by Compose. Please upgrade Serverless Framework to a version greater or equal to "3.7.7"'
    );
  });

  it('correctly handles logs for component with functions', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data =
            'functions:\n  hello:\n    handler: handler.hello\n  other:\n    handler: handler.other';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.logs({});

    expect(spawnStub).to.be.calledThrice;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['print', '--stage', 'dev']);
    expect(spawnStub.getCall(1).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(1).args[1]).to.deep.equal([
      'logs',
      '--function',
      'hello',
      '--stage',
      'dev',
    ]);
    expect(spawnStub.getCall(2).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(2).args[1]).to.deep.equal([
      'logs',
      '--function',
      'other',
      '--stage',
      'dev',
    ]);
  });

  it('correctly handles logs for component without functions', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'provider:\n  name: aws';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.logs({});

    expect(spawnStub).to.be.calledOnce;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['print', '--stage', 'dev']);
  });

  it('correctly handles tail option for logs', async () => {
    const spawnStub = sinon.stub().returns({
      on: (arg, cb) => {
        if (arg === 'close') cb(0);
      },
      stdout: {
        on: (arg, cb) => {
          const data = 'functions:\n  hello:\n    handler: handler.hello';
          if (arg === 'data') cb(data);
        },
      },
      kill: () => {},
    });
    const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
      '../../utils/spawn': spawnStub,
    });

    const context = await getContext();
    const component = new FrameworkComponent('some-id', context, { path: 'path' });
    context.state.detectedFrameworkVersion = '9.9.9';
    await component.logs({ tail: true });

    expect(spawnStub).to.be.calledTwice;
    expect(spawnStub.getCall(0).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(0).args[1]).to.deep.equal(['print', '--stage', 'dev']);
    expect(spawnStub.getCall(1).args[0]).to.equal('serverless');
    expect(spawnStub.getCall(1).args[1]).to.deep.equal([
      'logs',
      '--function',
      'hello',
      '--tail',
      '--stage',
      'dev',
    ]);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      validateComponentInputs('id', configSchema, {
        region: 123,
        params: 'foo',
      })
    )
      .to.throw()
      .and.have.property(
        'message',
        'Invalid configuration for component "id":\n' +
          "- must have required property 'path'\n" +
          '- "region": must be string\n' +
          '- "params": must be object'
      );
  });

  it('rejects path that is the root compose path', async () => {
    const context = await getContext();
    expect(() => new ServerlessFramework('id', context, { path: '.' }))
      .to.throw()
      .and.have.property('code', 'INVALID_PATH_IN_SERVICE_CONFIGURATION');
  });

  it('skips deploy when cache inputs and cache hash are unchanged', async () => {
    const serviceDir = await fs.mkdtemp(path.join(process.cwd(), 'cache-hash-skip-'));

    try {
      await outputFile(path.join(serviceDir, 'handler.js'), 'module.exports = 1;\n');

      const spawnStub = sinon.stub();
      const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
        '../../utils/spawn': spawnStub,
      });

      const context = await getContext();
      const inputs = {
        path: serviceDir,
        cachePatterns: ['handler.js'],
      };
      const component = new FrameworkComponent('id', context, inputs);

      context.state.inputs = inputs;
      context.state.cacheHash = await component.calculateCacheHash();

      await component.deploy();

      expect(spawnStub).to.not.have.been.called;
    } finally {
      await remove(serviceDir);
    }
  });

  it('updates cache hash after deploying changed cache pattern files', async () => {
    const serviceDir = await fs.mkdtemp(path.join(process.cwd(), 'cache-hash-update-'));

    try {
      const filePath = path.join(serviceDir, 'handler.js');
      await outputFile(filePath, 'module.exports = 1;\n');

      const spawnStub = sinon.stub();
      spawnStub.onFirstCall().returns(createSpawnExecution({ stderr: 'deployed' }));
      spawnStub.onSecondCall().returns(
        createSpawnExecution({
          stdout: 'region: us-east-1\n\nStack Outputs:\n  Key: Output',
        })
      );

      const FrameworkComponent = proxyquire('../../../../../lib/compose/components/framework/index.js', {
        '../../utils/spawn': spawnStub,
      });

      const context = await getContext();
      const inputs = {
        path: serviceDir,
        cachePatterns: ['handler.js'],
      };
      const component = new FrameworkComponent('id', context, inputs);

      context.state.detectedFrameworkVersion = '9.9.9';
      context.state.inputs = inputs;
      context.state.cacheHash = await component.calculateCacheHash();

      await outputFile(filePath, 'module.exports = 2;\n');

      await component.deploy();

      expect(spawnStub).to.be.calledTwice;
      expect(context.state.cacheHash).to.equal(await component.calculateCacheHash());
    } finally {
      await remove(serviceDir);
    }
  });

  it('expands literal directory cache patterns when calculating hashes', async () => {
    const serviceDir = await fs.mkdtemp(path.join(process.cwd(), 'cache-hash-dir-'));

    try {
      await outputFile(path.join(serviceDir, 'src', 'handler.js'), 'module.exports = 1;\n');

      const context = await getContext();
      const directoryPatternComponent = new ServerlessFramework('id', context, {
        path: serviceDir,
        cachePatterns: ['src'],
      });
      const globPatternComponent = new ServerlessFramework('id', context, {
        path: serviceDir,
        cachePatterns: ['src/**/*'],
      });

      expect(await directoryPatternComponent.calculateCacheHash()).to.equal(
        await globPatternComponent.calculateCacheHash()
      );
    } finally {
      await remove(serviceDir);
    }
  });

  it('supports negated cache patterns that re-include a later file', async () => {
    const serviceDir = await fs.mkdtemp(path.join(process.cwd(), 'cache-hash-negation-'));

    try {
      await Promise.all([
        outputFile(path.join(serviceDir, 'keep.js'), 'keep\n'),
        outputFile(path.join(serviceDir, 'ignored', 'drop.js'), 'drop\n'),
        outputFile(path.join(serviceDir, 'ignored', 'reinclude.js'), 'reinclude\n'),
      ]);

      const context = await getContext();
      const negatedPatternComponent = new ServerlessFramework('id', context, {
        path: serviceDir,
        cachePatterns: ['**/*', '!ignored/**/*', 'ignored/reinclude.js'],
      });
      const explicitPatternComponent = new ServerlessFramework('id', context, {
        path: serviceDir,
        cachePatterns: ['keep.js', 'ignored/reinclude.js'],
      });

      expect(await negatedPatternComponent.calculateCacheHash()).to.equal(
        await explicitPatternComponent.calculateCacheHash()
      );
    } finally {
      await remove(serviceDir);
    }
  });
});
