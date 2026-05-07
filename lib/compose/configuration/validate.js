'use strict';

const path = require('path');
const ServerlessError = require('../serverless-error');
const isObject = require('type/object/is');
const { default: Ajv } = require('ajv');
const { RESERVED_COMPONENT_IDS, hasOwn, isReservedComponentId } = require('../utils/safe-object');

function validateConfiguration(configuration, configurationPath) {
  const configurationFilename = path.basename(configurationPath);
  if (configuration == null || typeof configuration !== 'object') {
    throw new ServerlessError(
      `Resolved "${configurationFilename}" does not contain valid Compose configuration.\n` +
        'Read about Serverless Framework Compose in the documentation: https://slss.io/docs-compose',
      'INVALID_NON_OBJECT_CONFIGURATION'
    );
  }

  if (!hasOwn(configuration, 'services') || !isObject(configuration.services)) {
    throw new ServerlessError(
      `Invalid configuration: "${configurationFilename}" must contain "services" property.\n` +
        'Read about Serverless Framework Compose configuration in the documentation: https://slss.io/docs-compose',
      'INVALID_NON_OBJECT_SERVICES_CONFIGURATION'
    );
  }

  Object.entries(configuration.services).forEach(([key, value]) => {
    if (isReservedComponentId(key)) {
      throw new ServerlessError(
        `Invalid configuration: definition of "${key}" service uses a reserved alias. ` +
          `Reserved aliases: ${Array.from(RESERVED_COMPONENT_IDS).join(', ')}.`,
        'INVALID_SERVICE_ALIAS'
      );
    }
    if (!isObject(value)) {
      throw new ServerlessError(
        `Invalid configuration: definition of "${key}" service must be an object.\n` +
          'Read about Serverless Framework Compose configuration in the documentation: https://slss.io/docs-compose',
        'INVALID_NON_OBJECT_SERVICE_CONFIGURATION'
      );
    }
  });

  // Provide a targeted error message if users use Framework options
  const frameworkConfigKeys = [
    'service',
    'provider',
    'functions',
    'params',
    'frameworkVersion',
    'useDotenv',
    'package',
    'layers',
    'resources',
    'custom',
  ];
  frameworkConfigKeys.forEach((key) => {
    if (hasOwn(configuration, key)) {
      throw new ServerlessError(
        `Invalid property "${key}" in "${configurationFilename}".\n` +
          'This is a Serverless Framework option (serverless.yml) that is not supported in serverless-compose.yml.\n' +
          'You can search and/or open feature requests here: https://slss.io/docs-compose',
        'INVALID_CONFIGURATION'
      );
    }
  });

  const recognizedTopLevelProperties = new Set(['services', 'state']);

  const extraProperties = Object.keys(configuration).filter(
    (key) => !recognizedTopLevelProperties.has(key)
  );
  if (extraProperties.length > 0) {
    throw new ServerlessError(
      `Unrecognized property ${extraProperties.join(', ')} in "${configurationFilename}".\n` +
        'Read about Serverless Framework Compose configuration in the documentation: https://slss.io/docs-compose',
      'INVALID_CONFIGURATION'
    );
  }
}

function validateComponentInputs(componentId, configSchema, inputs) {
  // Extend the JSON schema of the component to add validation for global properties
  configSchema.properties.component = { type: 'string' };
  // `dependsOn` is a string or an array of strings
  configSchema.properties.dependsOn = {
    anyOf: [
      { type: 'string' },
      {
        type: 'array',
        items: { type: 'string' },
      },
    ],
  };

  const ajv = new Ajv({
    allErrors: true,
  });
  const validate = ajv.compile(configSchema);
  validate(inputs);
  if (!validate.errors) {
    return;
  }

  const messages = validate.errors.map((error) => {
    let prefix = '';

    let propertyPath = error.instancePath;
    if (propertyPath) {
      // Remove the leading `/`
      propertyPath = propertyPath.slice(1);
      // `.` are more understandable than `/`
      propertyPath = propertyPath.replace('/', '.');
      prefix += `"${propertyPath}": `;
    }

    if (error.keyword === 'additionalProperties') {
      // Better error message than what AJV provides
      return `${prefix}unknown property "${error.params.additionalProperty}"`;
    }
    return prefix + error.message;
  });

  const errorText = messages.map((message) => `- ${message}`).join('\n');

  throw new ServerlessError(
    `Invalid configuration for component "${componentId}":\n${errorText}`,
    'INVALID_COMPONENT_CONFIGURATION'
  );
}

module.exports = { validateConfiguration, validateComponentInputs };
