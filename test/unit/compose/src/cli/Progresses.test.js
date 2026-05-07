'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('test/unit/src/cli/Progresses.test.js', () => {
  let loadedProgresses = [];

  const createCliCursorStub = () => ({
    show: sinon.stub(),
    hide: sinon.stub(),
  });

  const loadProgresses = (isUnicodeSupported = true, cliCursor = createCliCursorStub()) => {
    const Progresses = proxyquire.noCallThru().load('../../../../../lib/compose/cli/Progresses', {
      './cursor': cliCursor,
      './is-unicode-supported': () => isUnicodeSupported,
    });
    loadedProgresses.push(Progresses);

    return { Progresses, cliCursor };
  };

  afterEach(() => {
    for (const Progresses of loadedProgresses) {
      if (Progresses.sigintHandler) {
        process.removeListener('SIGINT', Progresses.sigintHandler);
      }
      delete Progresses.sigintHandler;
      delete Progresses.lastBoundInstance;
    }
    loadedProgresses = [];
    sinon.restore();
  });

  const createProgresses = (columns = 5, rows = 3) => {
    const { Progresses } = loadProgresses();
    const progresses = Object.create(Progresses.prototype);
    progresses.output = {
      interactiveStderr: { columns, rows },
    };
    return progresses;
  };

  it('applies ellipsis based on visible width', () => {
    const progresses = createProgresses(5);

    expect(progresses.ellipsis('\u001B[31mabcdef\u001B[0m')).to.equal('abcd…');
  });

  it('wraps long lines based on visible width', () => {
    const progresses = createProgresses(5);

    expect(progresses.wrapLine('\u001B[31mabcdef\u001B[0m')).to.equal('abcd\nef');
  });

  it('limits output to terminal height', () => {
    const progresses = createProgresses(80, 3);

    expect(progresses.limitOutputToTerminalHeight('one\ntwo\nthree\nfour')).to.equal(
      'two\nthree\nfour'
    );
  });

  it('tracks progresses in a null-prototype registry', () => {
    const { Progresses } = loadProgresses();
    const progresses = Object.create(Progresses.prototype);
    progresses.output = {
      interactiveStderr: null,
      verbose: sinon.spy(),
    };
    progresses.progresses = Object.create(null);
    progresses.updateSpinnerState = sinon.stub();

    progresses.add('service');
    progresses.start('service', 'deploying');
    progresses.success('service', 'done');

    expect(Object.getPrototypeOf(progresses.progresses)).to.equal(null);
    expect(progresses.exists('service')).to.deep.include({ status: 'success', text: 'done' });
    expect(progresses.exists('constructor')).to.equal(undefined);
  });

  it('uses dots spinner when unicode is supported', () => {
    const { Progresses: LocalProgresses } = loadProgresses(true);
    sinon.stub(LocalProgresses.prototype, 'bindSigint');

    const progresses = new LocalProgresses({});

    expect(progresses.options.spinner.frames).to.deep.equal([
      '⠋',
      '⠙',
      '⠹',
      '⠸',
      '⠼',
      '⠴',
      '⠦',
      '⠧',
      '⠇',
      '⠏',
    ]);
  });

  it('uses dashes spinner when unicode is not supported', () => {
    const { Progresses: LocalProgresses } = loadProgresses(false);
    sinon.stub(LocalProgresses.prototype, 'bindSigint');

    const progresses = new LocalProgresses({});

    expect(progresses.options.spinner.frames).to.deep.equal(['-', '_']);
  });

  it('restores cursor and exits through SIGINT handler', () => {
    const { Progresses: LocalProgresses, cliCursor } = loadProgresses();
    const processExit = sinon.stub(process, 'exit');
    const moveCursor = sinon.stub();

    const progresses = new LocalProgresses({
      interactiveStderr: { moveCursor },
      verbose: sinon.stub(),
    });
    progresses.lineCount = 2;

    process.removeListener('SIGINT', LocalProgresses.sigintHandler);
    LocalProgresses.sigintHandler();

    expect(cliCursor.show).to.have.been.calledOnceWithExactly();
    expect(moveCursor).to.have.been.calledOnceWithExactly(0, 2);
    expect(processExit).to.have.been.calledOnceWithExactly(0);
  });
});
