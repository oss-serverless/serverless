'use strict';

const expect = require('chai').expect;
const stream = require('stream');
const streamToString = require('../../../../../lib/compose/utils/stream-to-string');

describe('test/unit/src/utils/stream-to-string.test.js', () => {
  it('correctly handles streams', async () => {
    const readableStream = stream.Readable.from([
      Buffer.from('first'),
      Buffer.from('second'),
      Buffer.from('\n'),
      Buffer.from('third'),
    ]);

    expect(await streamToString(readableStream)).to.equal('firstsecond\nthird');
  });
});
