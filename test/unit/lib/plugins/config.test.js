'use strict';

const fs = require('fs');
const BbPromise = require('bluebird');
const runServerless = require('../../../utils/run-serverless');

BbPromise.promisifyAll(fs);

describe('Config', () => {
  it('should support "config credentials" command', () =>
    runServerless({
      noService: true,
      command: 'config credentials',
      options: { provider: 'aws', key: 'foo', secret: 'bar' },
    }));
});
