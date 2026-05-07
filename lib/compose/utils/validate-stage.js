'use strict';

const ServerlessError = require('../serverless-error');

const STAGE_NAME_PATTERN = '^[A-Za-z0-9-]+$';
const stageNamePattern = new RegExp(STAGE_NAME_PATTERN);

const validateStage = (stage) => {
  if (typeof stage !== 'string' || !stageNamePattern.test(stage)) {
    throw new ServerlessError(
      'Invalid stage name. Stage names may contain only ASCII letters, numbers, and hyphens.',
      'INVALID_STAGE'
    );
  }

  return stage;
};

module.exports = validateStage;
module.exports.STAGE_NAME_PATTERN = STAGE_NAME_PATTERN;
