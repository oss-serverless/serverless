'use strict';

const path = require('path');
const { log, progress, style } = require('../utils/serverless-utils/log');
const standaloneUtils = require('../utils/standalone');
const { remove } = require('../utils/fs/remove');
const cliCommandsSchema = require('../cli/commands-schema');

const BINARY_PATH = standaloneUtils.path;
const mainProgress = progress.get('main');

module.exports = class Standalone {
  constructor(serverless, cliOptions) {
    this.serverless = serverless;
    this.cliOptions = cliOptions;

    this.commands = {
      uninstall: {
        ...cliCommandsSchema.get('uninstall'),
      },
    };

    this.hooks = {
      'uninstall:uninstall': async () => this.uninstall(),
    };
  }

  async uninstall() {
    mainProgress.notice('Uninstalling standalone binary', { isMainEvent: true });
    await remove(path.dirname(BINARY_PATH));
    log.notice();
    log.notice.success(
      `Standalone binary uninstalled ${style.aside(
        `(${Math.floor((Date.now() - this.serverless.pluginManager.commandRunStartTime) / 1000)}s)`
      )}`
    );
  }
};
