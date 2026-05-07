'use strict';

const ComponentContext = require('./ComponentContext');
const ServerlessError = require('./serverless-error');
const { validateComponentInputs } = require('./configuration/validate');

/**
 * @param {{
 *     context: import('./Context'),
 *     path: string,
 *     alias: string,
 *     inputs: Record<string, any>,
 * }} param
 */
async function loadComponent({ context, path, alias, inputs }) {
  const ComponentClass = require(path);

  if (typeof ComponentClass !== 'function') {
    throw new ServerlessError(
      `Component type "${path}" (service "${alias}") is invalid: "${path}" does not returns a component class`,
      'UNRECOGNIZED_COMPONENT'
    );
  }

  const componentId = alias;

  // Validate inputs
  // TODO: do this earlier, but this will require some heavier refactoring
  // @ts-ignore
  const configSchema = ComponentClass.SCHEMA;
  if (configSchema !== undefined) {
    validateComponentInputs(componentId, configSchema, inputs);
  }

  const componentContext = new ComponentContext(componentId, context);
  await componentContext.init();

  return new ComponentClass(componentId, componentContext, inputs);
}

module.exports = { loadComponent };
