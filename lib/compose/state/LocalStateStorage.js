'use strict';

const BaseStateStorage = require('./BaseStateStorage');
const fileExists = require('../../utils/fs/file-exists');
const readFile = require('../../utils/fs/read-file');
const writeFile = require('../../utils/fs/write-file');
const path = require('path');
const fsp = require('fs').promises;
const normalizeState = require('./normalize-state');
const validateStage = require('../../utils/validate-stage');

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
      if (await fileExists(stateFilePath)) {
        this.state = normalizeState(await readFile(stateFilePath));
      } else {
        this.state = normalizeState({});
      }
    }
    return this.state;
  }

  async writeState() {
    const stateFilePath = this.getStateFilePath();
    await writeFile(stateFilePath, this.state);
  }

  async removeState() {
    const stateFilePath = this.getStateFilePath();
    await fsp.unlink(stateFilePath);
  }
}

module.exports = LocalStateStorage;
