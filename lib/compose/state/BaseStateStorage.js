'use strict';

const ServerlessError = require('../serverless-error');
const { createRegistry, hasOwn, isReservedComponentId } = require('../utils/safe-object');

const ensureValidComponentId = (componentId) => {
  if (!isReservedComponentId(componentId)) return;

  throw new ServerlessError(
    `Component ID "${componentId}" is reserved and cannot be persisted.`,
    'INVALID_COMPONENT_ID'
  );
};

class BaseStateStorage {
  async readServiceState(defaultState) {
    await this.readState();

    if (this.state.service === undefined) {
      this.state.service = defaultState;
      await this.writeState();
    }

    return this.state.service;
  }

  async readComponentState(componentId) {
    await this.readState();

    if (isReservedComponentId(componentId)) {
      return {};
    }

    if (!this.state.components || !hasOwn(this.state.components, componentId)) {
      return {};
    }

    return this.state.components[componentId].state || {};
  }

  async writeComponentState(componentId, componentState) {
    ensureValidComponentId(componentId);
    await this.readState();

    this.state.components = this.state.components || createRegistry();
    if (!hasOwn(this.state.components, componentId)) {
      this.state.components[componentId] = {};
    }
    this.state.components[componentId].state = componentState;

    await this.writeState();
  }

  async readComponentsOutputs() {
    await this.readState();

    if (!this.state || !this.state.components) {
      return createRegistry();
    }

    const outputs = createRegistry();
    for (const [id, data] of Object.entries(this.state.components)) {
      if (isReservedComponentId(id)) continue;
      outputs[id] = data.outputs || {};
    }
    return outputs;
  }

  async readComponentOutputs(componentId) {
    await this.readState();

    if (isReservedComponentId(componentId)) {
      return {};
    }

    if (!this.state.components || !hasOwn(this.state.components, componentId)) {
      return {};
    }

    return this.state.components[componentId].outputs || {};
  }

  async writeComponentOutputs(componentId, componentOutputs) {
    ensureValidComponentId(componentId);
    await this.readState();
    this.state.components = this.state.components || createRegistry();
    if (!hasOwn(this.state.components, componentId)) {
      this.state.components[componentId] = {};
    }
    this.state.components[componentId].outputs = componentOutputs;

    await this.writeState();
  }

  async readState() {
    // To be implemented by specialized StateStorage class
    throw new Error('Not implemented');
  }

  async writeState() {
    // To be implemented by specialized StateStorage class
    throw new Error('Not implemented');
  }

  async removeState() {
    // To be implemented by specialized StateStorage class
    throw new Error('Not implemented');
  }
}

module.exports = BaseStateStorage;
