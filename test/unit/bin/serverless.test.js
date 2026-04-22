'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('test/unit/bin/serverless.test.js', () => {
  let originalServerlessCommandStartTime;

  beforeEach(() => {
    originalServerlessCommandStartTime = EvalError.$serverlessCommandStartTime;
  });

  afterEach(() => {
    if (originalServerlessCommandStartTime === undefined) {
      delete EvalError.$serverlessCommandStartTime;
    } else {
      EvalError.$serverlessCommandStartTime = originalServerlessCommandStartTime;
    }
    sinon.restore();
  });

  const loadBin = (stubs) => {
    delete require.cache[require.resolve('../../../bin/serverless.js')];
    proxyquire.noCallThru().load('../../../bin/serverless.js', stubs);
  };

  it('exits before CLI triage on unsupported Node versions', () => {
    const isSupportedNodeVersion = sinon.stub().returns(false);
    const triage = sinon.stub();
    const stderrWrite = sinon.stub(process.stderr, 'write');
    const processExitError = new Error('process.exit');
    const processExit = sinon.stub(process, 'exit').callsFake(() => {
      throw processExitError;
    });

    expect(() => {
      loadBin({
        '../lib/cli/is-supported-node-version': isSupportedNodeVersion,
        '../package.json': { version: '3.40.1' },
        '../lib/cli/triage': triage,
      });
    }).to.throw(processExitError);

    expect(isSupportedNodeVersion).to.have.been.calledOnceWithExactly(process.version);
    expect(stderrWrite).to.have.been.calledOnceWithExactly(
      'Error: Serverless Framework v3.40.1 does not support ' +
        `Node.js ${process.version}. Please upgrade Node.js to the latest ` +
        'LTS release. Minimum supported version: v20.0.0.\n'
    );
    expect(processExit).to.have.been.calledOnceWithExactly(1);
    expect(triage.called).to.equal(false);
  });

  it('dispatches compose requests through run-compose on supported Node versions', async () => {
    const triage = sinon.stub().returns(Promise.resolve('@osls/compose'));
    const runCompose = sinon.stub().resolves();

    loadBin({
      '../lib/cli/is-supported-node-version': sinon.stub().returns(true),
      '../lib/utils/is-standalone-executable': false,
      '../lib/cli/triage': triage,
      '../lib/cli/run-compose': runCompose,
    });

    await Promise.resolve();

    expect(triage).to.have.been.calledOnceWithExactly();
    expect(runCompose).to.have.been.calledOnceWithExactly();
  });
});
