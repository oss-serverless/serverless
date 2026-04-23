'use strict';

module.exports = async (options, configuration) => {
  const stage =
    options.stage ||
    (configuration && configuration.provider && configuration.provider.stage) ||
    'dev';
  if (!configuration.useDotenv) return false;
  require('./load-dotenv')(stage);
  return true;
};
