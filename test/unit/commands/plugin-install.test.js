'use strict';

const path = require('path');
const sinon = require('sinon');
const yaml = require('js-yaml');
const fse = require('fs-extra');
const proxyquire = require('proxyquire');
const fixturesEngine = require('../../fixtures/programmatic');
const resolveConfigurationPath = require('../../../lib/cli/resolve-configuration-path');
const cloudformationSchema = require('../../../lib/utils/serverless-utils/cloudformation-schema');
const { expect } = require('chai');

const npmCommand = 'npm';

const writeRawConfiguration = async (serviceDir, rawYaml) => {
  const configurationFilePath = await resolveConfigurationPath({
    cwd: serviceDir,
  });
  await fse.writeFile(configurationFilePath, rawYaml);
  return {
    configurationFilePath,
    configuration: yaml.load(rawYaml, {
      filename: configurationFilePath,
      schema: cloudformationSchema,
    }),
  };
};

const readParsedConfiguration = async (configurationFilePath) =>
  yaml.load(await fse.readFile(configurationFilePath, 'utf8'), {
    filename: configurationFilePath,
    schema: cloudformationSchema,
  });

describe('test/unit/commands/plugin-install.test.js', async () => {
  const spawnFake = sinon.fake();
  const installPlugin = proxyquire('../../../commands/plugin-install', {
    'child-process-ext/spawn': spawnFake,
  });
  const pluginName = 'serverless-plugin-1';

  afterEach(() => {
    spawnFake.resetHistory();
  });

  describe('without plugins in configuration', () => {
    let serviceDir;
    let configurationFilePath;
    before(async () => {
      const fixture = await fixturesEngine.setup('function');
      const configuration = fixture.serviceConfig;
      serviceDir = fixture.servicePath;
      configurationFilePath = await resolveConfigurationPath({
        cwd: serviceDir,
      });
      const configurationFilename = configurationFilePath.slice(serviceDir.length + 1);
      const options = {
        name: pluginName,
      };

      await installPlugin({
        configuration,
        serviceDir,
        configurationFilename,
        options,
      });
    });

    it('should install plugin', () => {
      const firstCall = spawnFake.firstCall;
      const command = [firstCall.args[0], ...firstCall.args[1]].join(' ');
      const expectedCommand = `${npmCommand} install --save-dev ${pluginName}`;
      expect(command).to.have.string(expectedCommand);
    });

    it('should add plugin to serverless file', async () => {
      const serverlessFileObj = yaml.load(await fse.readFile(configurationFilePath, 'utf8'), {
        filename: configurationFilePath,
      });
      expect(serverlessFileObj.plugins).to.include(pluginName);
    });
  });

  describe('with plugins in configuration', () => {
    it('should not add plugin to serverless file if it is already present in configuration but configured behind a variable', async () => {
      const fixture = await fixturesEngine.setup('function', {
        configExt: {
          plugins: ['${self:custom.pluginName}'],
          custom: {
            pluginName,
          },
        },
      });

      const configuration = fixture.serviceConfig;

      // Simulate that the variable has been resolved
      configuration.plugins = [pluginName];
      const serviceDir = fixture.servicePath;
      const configurationFilePath = await resolveConfigurationPath({
        cwd: serviceDir,
      });
      const configurationFilename = configurationFilePath.slice(serviceDir.length + 1);
      const options = {
        name: pluginName,
      };

      await installPlugin({
        configuration,
        serviceDir,
        configurationFilename,
        options,
      });
      const serverlessFileObj = yaml.load(await fse.readFile(configurationFilePath, 'utf8'), {
        filename: configurationFilePath,
      });
      expect(serverlessFileObj.plugins).not.to.include(pluginName);
    });
  });

  describe('with intrinsic-tagged yaml', () => {
    it('preserves shorthand intrinsic tags when adding a plugin to array-form yaml', async () => {
      const fixture = await fixturesEngine.setup('function');
      const serviceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        'custom:',
        '  pluginLogGroupArn: !Sub arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${self:service}-${sls:stage}:*',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
        'functions:',
        '  basic:',
        '    handler: handler.hello',
        '',
      ].join('\n');

      const { configurationFilePath, configuration } = await writeRawConfiguration(
        serviceDir,
        rawYaml
      );

      await installPlugin({
        configuration,
        serviceDir,
        configurationFilename: path.basename(configurationFilePath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(configurationFilePath, 'utf8');
      const parsed = await readParsedConfiguration(configurationFilePath);

      expect(fileText).to.include(
        'pluginLogGroupArn: !Sub arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${self:service}-${sls:stage}:*'
      );
      expect(fileText).to.include(`- ${pluginName}`);
      expect(parsed.plugins).to.include(pluginName);
      expect(parsed.custom.pluginLogGroupArn).to.deep.equal({
        'Fn::Sub':
          'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${self:service}-${sls:stage}:*',
      });
    });

    it('preserves sibling shorthand tags when adding a plugin to object-form plugins.modules', async () => {
      const fixture = await fixturesEngine.setup('function');
      const serviceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        'plugins:',
        '  localPath: ./.serverless_plugins',
        '  modules:',
        '    - existing-plugin',
        '',
        'custom:',
        '  taggedValue: !Sub ${AWS::Region}',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath, configuration } = await writeRawConfiguration(
        serviceDir,
        rawYaml
      );

      await installPlugin({
        configuration,
        serviceDir,
        configurationFilename: path.basename(configurationFilePath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(configurationFilePath, 'utf8');
      const parsed = await readParsedConfiguration(configurationFilePath);

      expect(fileText).to.include('taggedValue: !Sub ${AWS::Region}');
      expect(parsed.plugins.localPath).to.equal('./.serverless_plugins');
      expect(parsed.plugins.modules).to.deep.equal(['existing-plugin', pluginName]);
      expect(parsed.custom.taggedValue).to.deep.equal({
        'Fn::Sub': '${AWS::Region}',
      });
    });

    it('updates a quoted top level plugins array without duplicating the section', async () => {
      const fixture = await fixturesEngine.setup('function');
      const serviceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        '"plugins":',
        '  - existing-plugin',
        '',
        'custom:',
        '  taggedValue: !Sub ${AWS::Region}',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath, configuration } = await writeRawConfiguration(
        serviceDir,
        rawYaml
      );

      await installPlugin({
        configuration,
        serviceDir,
        configurationFilename: path.basename(configurationFilePath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(configurationFilePath, 'utf8');
      const parsed = await readParsedConfiguration(configurationFilePath);

      expect(fileText.match(/^(?:"plugins"|plugins):/gm)).to.have.length(1);
      expect(parsed.plugins).to.deep.equal(['existing-plugin', pluginName]);
      expect(parsed.custom.taggedValue).to.deep.equal({
        'Fn::Sub': '${AWS::Region}',
      });
    });
  });
});
