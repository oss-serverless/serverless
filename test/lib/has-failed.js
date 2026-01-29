'use strict';

module.exports = (suite) => {
  if (suite.tests.some((test) => test.state === 'failed')) return true;
  return suite.suites.some(module.exports);
};
