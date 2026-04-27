'use strict';

module.exports = class TestPlugin {
  constructor(serverless, options, utils) {
    this.serverless = serverless;
    this.options = options;
    this.utils = utils;
    this.commands = {
      customCommand: {
        usage: 'Description of custom command',
        configDependent: false,
        lifecycleEvents: ['run'],
        options: {
          pluginOption: {
            usage: 'Plugin option',
            type: 'string',
          },
        },
      },
    };

    this.hooks = {
      'customCommand:run': () => {
        this.utils.writeText(
          `customCommand invoked${this.options.pluginOption ? ` ${this.options.pluginOption}` : ''}`
        );
      },
    };
  }
};
