'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire');

describe('test/unit/lib/utils/serverless-utils/lib/log-reporters/node/style.test.js', () => {
  it('uses stdout colors for shared style decorators', () => {
    const styleState = {
      aside: (value) => value,
      error: (value) => value,
      link: (value) => value,
      linkStrong: (value) => value,
      noticeSymbol: (value) => value,
      strong: (value) => value,
      title: (value) => value,
      warning: (value) => value,
    };

    proxyquire
      .noCallThru()
      .load('../../../../../../../../lib/utils/serverless-utils/lib/log-reporters/node/style', {
        d: (value) => value,
        'd/auto-bind': (value) => value,
        'ext/function/identity': (value) => value,
        '../../../../colors': {
          stdoutColors: {
            gray: (value) => `stdout-gray(${value})`,
            brandRed: (value) => `stdout-red(${value})`,
            underline: (value) => `stdout-underline(${value})`,
            warning: (value) => `stdout-warning(${value})`,
          },
        },
        '../../../log': {
          style: styleState,
          log: { notice: () => {} },
        },
        '../../log/join-text-tokens': (tokens) => `${tokens.join('')}\n`,
      });

    expect(styleState.aside('x')).to.equal('stdout-gray(x)');
    expect(styleState.error('x')).to.equal('stdout-red(x)');
    expect(styleState.title('x')).to.equal('stdout-underline(x)');
    expect(styleState.warning('x')).to.equal('stdout-warning(x)');
  });
});
