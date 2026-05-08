'use strict';

const path = require('path');
const isPlainObject = require('type/plain-object/is');
const utils = require('./utils');
const packageJson = require('../../package.json');
const LocalStateStorage = require('./state/LocalStateStorage');
const getS3StateStorageFromConfig = require('./state/get-s3-state-storage-from-config');
const Output = require('./cli/Output');
const readline = require('readline');
const formatOutput = require('./cli/format-output');
const Progresses = require('./cli/Progresses');
const { stderrCliColors } = require('./cli/colors');
const ServerlessError = require('../serverless-error');
const { createRegistry } = require('./utils/safe-object');

class Context {
  constructor(config) {
    this.version = packageJson.version;
    this.root = path.resolve(config.root || process.cwd());
    this.output = new Output(config.verbose || false, config.disableIO);
    /** @type {string} */
    this.stage = config.stage;
    this.id = undefined;
    this.componentCommandsOutcomes = createRegistry();
    this.hasEnabledVerboseInteractively = false;

    this.progresses = new Progresses(this.output);
    if (!config.verbose) {
      this.progresses.setFooterText(stderrCliColors.gray('Press [?] to enable verbose logs'));
    }

    // Resolved Compose configuration
    this.configuration = config.configuration;
  }

  async init() {
    this.startInteractiveInput();
    await this.setupStateStorage();
    const serviceState = await this.stateStorage.readServiceState({ id: utils.randomId() });
    this.id = serviceState.id;
  }

  async setupStateStorage() {
    if (!this.configuration.state) {
      this.stateStorage = new LocalStateStorage(this.root, this.stage);
      return;
    }

    let stateConfiguration;
    if (typeof this.configuration.state === 'string') {
      stateConfiguration = {
        backend: this.configuration.state,
      };
    } else if (isPlainObject(this.configuration.state)) {
      stateConfiguration = this.configuration.state;
    } else {
      throw new ServerlessError(
        'Invalid "state" configuration provided. It should be a string or an object.',
        'INVALID_STATE_CONFIGURATION_FORMAT'
      );
    }

    if (stateConfiguration.backend === 's3') {
      this.stateStorage = await getS3StateStorageFromConfig(stateConfiguration, this);
      return;
    }

    throw new ServerlessError(
      `Unrecognized state backend: "${stateConfiguration.backend}"`,
      'UNRECOGNIZED_STATE_BACKEND'
    );
  }

  renderOutputs(outputs) {
    if (!outputs || typeof outputs !== 'object' || Object.keys(outputs).length === 0) {
      return;
    }

    this.output.writeText(formatOutput(outputs).trimEnd());
  }

  logVerbose(message) {
    this.output.verbose(message, ['serverless']);
  }

  startInteractiveInput() {
    if (!this.output.interactiveStdin) {
      return;
    }
    // Start listening to specific keypresses
    readline.emitKeypressEvents(this.output.interactiveStdin);
    this.output.interactiveStdin.on('keypress', (character, key) => {
      if (character === '?') {
        this.output.enableVerbose();
        this.hasEnabledVerboseInteractively = true;
        this.progresses.setFooterText();
      }
      if (key && key.ctrl && key.name === 'c') {
        // Restore the Ctrl+C behavior by sending SIGINT to ourselves
        // See https://nodejs.org/api/tty.html#readstreamsetrawmodemode
        process.kill(process.pid, 'SIGINT');
      }
    });
    // This is the line that enables the interactive mode
    // If later we need user input (e.g. prompts), we need to disable this
    // See https://nodejs.org/api/tty.html#readstreamsetrawmodemode
    this.output.interactiveStdin.setRawMode(true);
  }

  shutdown() {
    this.progresses.setFooterText('');
    this.progresses.stopAll();
  }
}

module.exports = Context;
