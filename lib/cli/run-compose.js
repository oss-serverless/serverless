'use strict';

const { runComponents } = require('../compose');

module.exports = async () => runComponents(process.argv.slice(2));
