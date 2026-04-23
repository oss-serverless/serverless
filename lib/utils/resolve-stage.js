'use strict';

const resolveStage = ({ configuration, options }) => {
  return (
    options.stage ||
    (configuration && configuration.provider && configuration.provider.stage) ||
    'dev'
  );
};

module.exports = resolveStage;
