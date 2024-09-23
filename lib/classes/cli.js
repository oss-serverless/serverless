'use strict';

const chalk = require('chalk');
const { log } = require('@serverless/utils/log');
const resolveCliInput = require('../cli/resolve-input');
const renderHelp = require('../cli/render-help');

const legacyPluginLog = log.get('plugin-legacy');

class CLI {
  constructor(serverless) {
    this.serverless = serverless;
    this.loadedPlugins = [];
    this.loadedCommands = {};
  }

  setLoadedPlugins(plugins) {
    this.loadedPlugins = plugins;
  }

  setLoadedCommands(commands) {
    this.loadedCommands = commands;
  }

  displayHelp() {
    if (!resolveCliInput().isHelpRequest) return false;
    renderHelp(this.serverless.pluginManager.externalPlugins);
    return true;
  }

  printDot() {
    process.stdout.write(chalk.yellow('.'));
  }

  log(message, entity, opts) {
    const { underline = false, bold = false, color = null } = opts || {};

    let print = chalk;

    if (color) print = chalk.keyword(color);
    if (underline) print = print.underline;
    if (bold) print = print.bold;

    legacyPluginLog.notice(entity ? `${entity}: ${print(message)}` : print(message));
  }

  consoleLog(message) {
    process.stdout.write(`${message}\n`);
  }
}

module.exports = CLI;
