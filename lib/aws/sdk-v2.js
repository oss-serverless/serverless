'use strict';

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = 1;

require('aws-sdk/lib/maintenance_mode_message').suppress = true;

module.exports = require('aws-sdk');
