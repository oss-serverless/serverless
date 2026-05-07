'use strict';

const BaseStateStorage = require('./BaseStateStorage');
const utils = require('../utils/fs');
const path = require('path');
const fsp = require('fs').promises;
const normalizeState = require('./normalize-state');
const validateStage = require('../utils/validate-stage');

class LocalStateStorage extends BaseStateStorage {
  constructor(root, stage) {
    super();
    this.stateRoot = path.join(root, '.serverless');
    this.stage = validateStage(stage);
  }

  getStateFilePath() {
    return path.join(this.stateRoot, `state.${this.stage}.json`);
  }

  async readState() {
    // Load the state only once
    // We will assume it doesn't change outside of our process
    // TODO add locking mechanism in the future
    if (this.state === undefined) {
      const stateFilePath = this.getStateFilePath();
      if (await utils.fileExists(stateFilePath)) {
        this.state = normalizeState(await utils.readFile(stateFilePath));
      } else {
        this.state = normalizeState({});
      }
    }
    return this.state;
  }

  async writeState() {
    const stateFilePath = this.getStateFilePath();
    await utils.writeFile(stateFilePath, this.state);
  }

  async removeState() {
    const stateFilePath = this.getStateFilePath();
    await fsp.unlink(stateFilePath);
  }
}

module.exports = LocalStateStorage;
