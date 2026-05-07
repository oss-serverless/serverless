'use strict';

class ComponentContext {
  /**
   * @param {string} componentId
   * @param {import('./Context')} context
   */
  constructor(componentId, context) {
    this.componentId = componentId;
    this.stage = context.stage;
    /** @type {Record<string, any>} */
    this.state = {};
    /** @type {Record<string, any>} */
    this.outputs = {};

    /** @private Let's keep the context private so that we limit the API surface for components */
    this.context = context;
  }

  // populating state is an async operation in most contexts
  // and we can't run async operations in the constructor
  // so we can't auto populate state on instance construction
  async init() {
    this.state = await this.context.stateStorage.readComponentState(this.componentId);
    this.outputs = await this.context.stateStorage.readComponentOutputs(this.componentId);
  }

  async save() {
    await this.context.stateStorage.writeComponentState(this.componentId, this.state);
  }

  /**
   * @param {Record<string, any>} outputs
   */
  async updateOutputs(outputs) {
    this.outputs = outputs;
    await this.context.stateStorage.writeComponentOutputs(this.componentId, this.outputs);
  }

  /**
   * @param {string} message
   * @param {string[]} [namespace]
   */
  writeText(message, namespace = []) {
    this.context.output.writeText(message, [this.componentId, ...namespace]);
  }

  /**
   * @param {string} message
   * @param {string[]} [namespace]
   */
  logVerbose(message, namespace = []) {
    this.context.output.verbose(message, [this.componentId, ...namespace]);
  }

  /**
   * @param {string|Error} error
   * @param {string[]} [namespace]
   */
  logError(error, namespace = []) {
    this.context.output.error(error, [this.componentId, ...namespace]);
  }

  startProgress(text) {
    this.context.progresses.start(this.componentId, text);
  }

  updateProgress(text) {
    this.context.progresses.update(this.componentId, text);
  }

  successProgress(text) {
    this.context.progresses.success(this.componentId, text);
  }
}

module.exports = ComponentContext;
