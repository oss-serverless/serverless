'use strict';

class LocalComponent {
  constructor(id, context, inputs) {
    this.id = id;
    this.context = context;
    this.inputs = inputs;
  }

  async emitLogs() {
    this.context.writeText(this.inputs.message);
    this.context.logVerbose(`verbose ${this.inputs.message}`);
  }
}

module.exports = LocalComponent;
