'use strict';

const BbPromise = require('bluebird');
const { ProxyAgent } = require('undici');
const { log, writeText, style } = require('../../../utils/serverless-utils/log');

module.exports = {
  async getPlugins() {
    const endpoint = 'https://raw.githubusercontent.com/serverless/plugins/master/plugins.json';

    const proxy =
      process.env.proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy;

    const options = {};
    if (proxy) {
      options.dispatcher = new ProxyAgent(proxy);
    }

    return fetch(endpoint, options)
      .then((result) => result.json())
      .then((json) => json);
  },

  async display(plugins) {
    // Ignore malformed registry entries instead of failing the entire listing.
    const orderedPlugins = Array.isArray(plugins)
      ? plugins
          .filter(
            (plugin) => plugin && typeof plugin === 'object' && typeof plugin.name === 'string'
          )
          .sort((pluginA, pluginB) => pluginA.name.localeCompare(pluginB.name))
      : [];

    if (orderedPlugins.length) {
      orderedPlugins.forEach((plugin) => {
        writeText(`${style.title(plugin.name)} ${style.aside(plugin.description)}`);
      });
      writeText(
        null,
        'Install a plugin by running:',
        '  serverless plugin install --name ...',
        null,
        'It will be automatically downloaded and added to package.json and serverless.yml'
      );
    } else {
      log.notice.skip('There are no plugins available to display');
    }

    return BbPromise.resolve();
  },
};
