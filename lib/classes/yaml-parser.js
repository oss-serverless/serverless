'use strict';

const $RefParser = require('@apidevtools/json-schema-ref-parser');
const yaml = require('js-yaml');
const cloudformationSchema = require('@serverless/utils/cloudformation-schema');

class YamlParser {
  constructor(serverless) {
    this.serverless = serverless;
  }

  async parse(yamlFilePath) {
    return $RefParser.dereference(yamlFilePath, {
      parse: {
        yaml: {
          parse(file) {
            const contents = file.data.toString();
            try {
              return yaml.load(contents, {
                filename: file.url,
                schema: cloudformationSchema,
              });
            } catch (err) {
              return yaml.load(contents, { filename: file.url });
            }
          },
        },
      },
    });
  }
}

module.exports = YamlParser;
