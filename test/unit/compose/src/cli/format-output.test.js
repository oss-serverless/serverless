'use strict';

const expect = require('chai').expect;
const { stripVTControlCharacters: stripAnsi } = require('node:util');

const colors = require('../../../../../lib/compose/cli/colors');
const formatOutput = require('../../../../../lib/compose/cli/format-output');

describe('test/unit/src/cli/format-output.test.js', () => {
  it('renders nested outputs in the current CLI format', () => {
    const result = formatOutput({
      service: {
        url: 'https://example.com',
        enabled: true,
      },
      values: [1, 'text', { nested: false }],
      emptyArr: [],
      emptyObject: {},
      description: 'line1\nline2',
    });

    expect(stripAnsi(result)).to.equal(
      [
        'service: ',
        '  url: https://example.com',
        '  enabled: true',
        'values: ',
        '  - 1',
        '  - text',
        '  - ',
        '    nested: false',
        'emptyArr: (empty array)',
        'emptyObject: ',
        'description: ',
        '  """',
        '    line1',
        '    line2',
        '  """',
        '',
      ].join('\n')
    );
  });

  it('preserves sparse arrays and edge scalar values', () => {
    const holes = [];
    holes[1] = 1;

    const result = formatOutput({
      holes,
      nullValue: null,
      undefinedValue: undefined,
      nested: [[{ x: 1 }]],
      bools: [true, false],
    });

    expect(stripAnsi(result)).to.equal(
      [
        'holes: ',
        '  - undefined',
        '  - 1',
        'nullValue: null',
        'undefinedValue: undefined',
        'nested: ',
        '  - ',
        '    - ',
        '      x: 1',
        'bools: ',
        '  - true',
        '  - false',
        '',
      ].join('\n')
    );
  });

  it('renders nested empty collections and multiline strings in arrays', () => {
    const result = formatOutput({
      items: [[], {}],
      nested: {
        arr: [[]],
        obj: { empty: {} },
      },
      multi: ['line1\nline2'],
    });

    expect(stripAnsi(result)).to.equal(
      [
        'items: ',
        '  - (empty array)',
        '  - ',
        'nested: ',
        '  arr: ',
        '    - (empty array)',
        '  obj: ',
        '    empty: ',
        'multi: ',
        '  - ',
        '    """',
        '      line1',
        '      line2',
        '    """',
        '',
      ].join('\n')
    );
  });

  it('caps nested rendering depth consistently across objects and arrays', () => {
    const result = formatOutput({
      a: {
        b: {
          c: {
            d: {
              e: 1,
            },
          },
        },
      },
      arr: [[[[{ x: 1 }]]]],
      multiline: {
        a: {
          b: {
            c: 'line1\nline2',
          },
        },
      },
      multilineArr: [[[['line1\nline2']]]],
    });

    expect(stripAnsi(result)).to.equal(
      [
        'a: ',
        '  b: ',
        '    c: ',
        '      d: (max depth reached)',
        'arr: ',
        '  - ',
        '    - ',
        '      - (max depth reached)',
        'multiline: ',
        '  a: ',
        '    b: ',
        '      c: (max depth reached)',
        'multilineArr: ',
        '  - ',
        '    - ',
        '      - (max depth reached)',
        '',
      ].join('\n')
    );
  });

  it('applies the expected CLI colors', () => {
    const result = formatOutput({
      count: 1,
      enabled: true,
      disabled: false,
      missing: null,
      unknown: undefined,
      text: 'value',
      items: [1],
    });

    expect(result).to.equal(
      [
        `${colors.gray('count: ')}${colors.white('1')}`,
        `${colors.gray('enabled: ')}${colors.white('true')}`,
        `${colors.gray('disabled: ')}${colors.white('false')}`,
        `${colors.gray('missing: ')}${colors.gray('null')}`,
        `${colors.gray('unknown: ')}${colors.gray('undefined')}`,
        `${colors.gray('text: ')}value`,
        `${colors.gray('items: ')}`,
        `${colors.gray('  - ')}${colors.white('1')}`,
        '',
      ].join('\n')
    );
  });
});
