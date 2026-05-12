'use strict';

const path = require('path');
const { log, progress, style } = require('../utils/serverless-utils/log');
const ServerlessError = require('../serverless-error');
const standaloneUtils = require('../utils/standalone');
const { remove } = require('../utils/fs/remove');
const cliCommandsSchema = require('../cli/commands-schema');

const BINARY_PATH = standaloneUtils.path;
const mainProgress = progress.get('main');
const upgradeCommandDeprecationMessage = [
  'The standalone `sls upgrade` command is deprecated and no longer updates osls.',
  'It is scheduled for removal in osls v4.0.0.',
  '',
  'Upgrade osls via npm instead:',
  '',
  '  npm install -g osls@latest',
  '',
  'More info: https://github.com/oss-serverless/osls/blob/main/docs/guides/deprecations.md#STANDALONE_UPGRADE_COMMAND_DEPRECATED',
].join('\n');

module.exports = class Standalone {
  constructor(serverless, cliOptions) {
    this.serverless = serverless;
    this.cliOptions = cliOptions;

    this.commands = {
      upgrade: {
        ...cliCommandsSchema.get('upgrade'),
      },
      uninstall: {
        ...cliCommandsSchema.get('uninstall'),
      },
    };

    this.hooks = {
      'upgrade:upgrade': async () => this.upgrade(),
      'uninstall:uninstall': async () => this.uninstall(),
    };
  }

  async upgrade() {
    throw new ServerlessError(
      upgradeCommandDeprecationMessage,
      'STANDALONE_UPGRADE_COMMAND_DEPRECATED'
    );
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
