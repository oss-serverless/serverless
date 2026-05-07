'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const expect = chai.expect;

describe('test/unit/src/utils/serverless-utils/log-reporters/node.test.js', () => {
  const loadModule = (uniGlobalState = {}, overrides = {}) => {
    const logReporter = overrides.logReporter || sinon.stub();
    const progressReporter = overrides.progressReporter || sinon.stub();
    const outputEmitter = overrides.outputEmitter || { on: sinon.stub() };
    const joinTextTokens = overrides.joinTextTokens || sinon.stub().returns('joined');
    const env = overrides.env || {};
    const argv = overrides.argv || [];
    const stdin = overrides.stdin || { isTTY: false };
    const stdout = overrides.stdout || { isTTY: false, write: sinon.stub() };

    const initializeNodeLogging = proxyquire
      .noCallThru()
      .load('../../../../../../../lib/compose/utils/serverless-utils/log-reporters/node', {
        'uni-global': () => uniGlobalState,
        '../lib/log-reporters/node/log-reporter': logReporter,
        '../lib/log/get-output-reporter': { emitter: outputEmitter },
        '../lib/log/join-text-tokens': joinTextTokens,
        'log/levels': ['debug', 'info', 'notice'],
        '../lib/log-reporters/node/style': {},
        '../lib/log-reporters/node/progress-reporter': progressReporter,
      });

    const result = initializeNodeLogging({ argv, env, stdin, stdout });

    return { logReporter, progressReporter, outputEmitter, joinTextTokens, env, stdout, result };
  };

  it('sets SLS_LOG_LEVEL=info when verbose mode is enabled', () => {
    const { env, logReporter, outputEmitter } = loadModule({}, { argv: ['deploy', '--verbose'] });

    expect(env.SLS_LOG_LEVEL).to.equal('info');
    expect(logReporter).to.have.been.calledOnceWithExactly({
      logLevelIndex: 1,
      debugNamespaces: undefined,
    });
    expect(outputEmitter.on).to.have.been.calledOnce;
  });

  it('stores the derived log level in shared state', () => {
    const uniGlobalState = {};

    const { outputEmitter } = loadModule(uniGlobalState, { argv: ['deploy', '--verbose'] });

    expect(uniGlobalState.logLevelIndex).to.equal(1);
    expect(outputEmitter.on).to.have.been.calledOnce;
  });

  it('does not override debug logging with verbose mode', () => {
    const { env, logReporter } = loadModule(
      {},
      {
        argv: ['deploy', '--verbose'],
        env: { SLS_LOG_LEVEL: 'debug' },
      }
    );

    expect(env.SLS_LOG_LEVEL).to.equal('debug');
    expect(logReporter).to.have.been.calledOnceWithExactly({
      logLevelIndex: 0,
      debugNamespaces: undefined,
    });
  });

  it('is idempotent when reporter setup already happened', () => {
    const uniGlobalState = { logLevelIndex: 1 };

    const { logReporter, progressReporter, outputEmitter, result } = loadModule(uniGlobalState, {
      argv: ['deploy', '--verbose'],
    });

    expect(logReporter.called).to.equal(false);
    expect(progressReporter.called).to.equal(false);
    expect(outputEmitter.on.called).to.equal(false);
    expect(result).to.deep.equal({ logLevelIndex: 1, isInteractive: undefined });
  });

  it('maps debug namespaces from argv into SLS_LOG_DEBUG', () => {
    const { env, logReporter } = loadModule({}, { argv: ['deploy', '--debug=aws'] });

    expect(env.SLS_LOG_DEBUG).to.equal('aws');
    expect(logReporter).to.have.been.calledOnceWithExactly({
      logLevelIndex: 2,
      debugNamespaces: 'aws',
    });
  });

  it('registers the progress reporter when interactive setup is enabled', () => {
    const uniGlobalState = {};

    const { progressReporter } = loadModule(uniGlobalState, {
      env: { SLS_INTERACTIVE_SETUP_ENABLE: '1' },
    });

    expect(progressReporter).to.have.been.calledOnceWithExactly({ logLevelIndex: 2 });
    expect(uniGlobalState.logIsInteractive).to.equal('1');
  });

  it('registers the progress reporter when stdin and stdout are TTY outside CI', () => {
    const uniGlobalState = {};

    const { progressReporter, result } = loadModule(uniGlobalState, {
      stdin: { isTTY: true },
      stdout: { isTTY: true, write: sinon.stub() },
      env: {},
    });

    expect(progressReporter).to.have.been.calledOnceWithExactly({ logLevelIndex: 2 });
    expect(uniGlobalState.logIsInteractive).to.equal(true);
    expect(result).to.deep.equal({ logLevelIndex: 2, isInteractive: true });
  });

  it('matches Serverless by treating empty CI as interactive', () => {
    const uniGlobalState = {};

    const { progressReporter, result } = loadModule(uniGlobalState, {
      stdin: { isTTY: true },
      stdout: { isTTY: true, write: sinon.stub() },
      env: { CI: '' },
    });

    expect(progressReporter).to.have.been.calledOnceWithExactly({ logLevelIndex: 2 });
    expect(uniGlobalState.logIsInteractive).to.equal(true);
    expect(result).to.deep.equal({ logLevelIndex: 2, isInteractive: true });
  });

  it('does not register the progress reporter when stdin is not TTY', () => {
    const uniGlobalState = {};

    const { progressReporter, result } = loadModule(uniGlobalState, {
      stdin: { isTTY: false },
      stdout: { isTTY: true, write: sinon.stub() },
      env: {},
    });

    expect(progressReporter.called).to.equal(false);
    expect(uniGlobalState.logIsInteractive).to.equal(undefined);
    expect(result).to.deep.equal({ logLevelIndex: 2, isInteractive: undefined });
  });

  it('does not register the progress reporter when stdout is not TTY', () => {
    const uniGlobalState = {};

    const { progressReporter, result } = loadModule(uniGlobalState, {
      stdin: { isTTY: true },
      stdout: { isTTY: false, write: sinon.stub() },
      env: {},
    });

    expect(progressReporter.called).to.equal(false);
    expect(uniGlobalState.logIsInteractive).to.equal(undefined);
    expect(result).to.deep.equal({ logLevelIndex: 2, isInteractive: undefined });
  });

  it('does not register the progress reporter when CI is truthy', () => {
    const uniGlobalState = {};

    const { progressReporter, result } = loadModule(uniGlobalState, {
      stdin: { isTTY: true },
      stdout: { isTTY: true, write: sinon.stub() },
      env: { CI: '1' },
    });

    expect(progressReporter.called).to.equal(false);
    expect(uniGlobalState.logIsInteractive).to.equal(undefined);
    expect(result).to.deep.equal({ logLevelIndex: 2, isInteractive: undefined });
  });

  it('writes text-mode output events through joinTextTokens', () => {
    const handlers = new Map();
    const outputEmitter = {
      on: sinon.stub().callsFake((eventName, handler) => {
        handlers.set(eventName, handler);
      }),
    };
    const joinTextTokens = sinon.stub().returns('joined\n');
    const stdout = { isTTY: false, write: sinon.stub() };

    loadModule({}, { outputEmitter, joinTextTokens, stdout });
    handlers.get('write')({ mode: 'text', textTokens: ['first', 'second'] });

    expect(joinTextTokens).to.have.been.calledOnceWithExactly(['first', 'second']);
    expect(stdout.write).to.have.been.calledOnceWithExactly('joined\n');
  });
});
