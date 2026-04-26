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
const pluginName = 'serverless-plugin-1';
const spawnFake = sinon.fake();
const uninstallPlugin = proxyquire('../../../commands/plugin-uninstall', {
  '../lib/utils/spawn': spawnFake,
});

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

describe('test/unit/commands/plugin-uninstall.test.js', async () => {
  let serviceDir;
  let configurationFilePath;

  before(async () => {
    const fixture = await fixturesEngine.setup('function', {
      configExt: {
        plugins: [pluginName],
      },
    });

    const configuration = fixture.serviceConfig;
    serviceDir = fixture.servicePath;
    configurationFilePath = await resolveConfigurationPath({
      cwd: serviceDir,
    });
    const configurationFilename = configurationFilePath.slice(serviceDir.length + 1);
    const options = {
      name: pluginName,
    };

    await uninstallPlugin({
      configuration,
      serviceDir,
      configurationFilename,
      options,
    });
  });

  afterEach(() => {
    spawnFake.resetHistory();
  });

  it('should uninstall plugin', () => {
    const firstCall = spawnFake.firstCall;
    const command = [firstCall.args[0], ...firstCall.args[1]].join(' ');
    const expectedCommand = `${npmCommand} uninstall --save-dev ${pluginName}`;
    expect(command).to.have.string(expectedCommand);
  });

  it('should remove plugin from serverless file', async () => {
    const serverlessFileObj = yaml.load(await fse.readFile(configurationFilePath, 'utf8'), {
      filename: configurationFilePath,
    });
    expect(serverlessFileObj.plugins).to.be.undefined;
  });

  describe('with intrinsic-tagged yaml', () => {
    it('preserves shorthand intrinsic tags when removing a plugin from array-form yaml', async () => {
      const fixture = await fixturesEngine.setup('function');
      const fixtureServiceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        'plugins:',
        `  - ${pluginName}`,
        '',
        'custom:',
        '  pluginLogGroupArn: !GetAtt PluginLogGroup.Arn',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath: fixtureConfigurationPath, configuration } =
        await writeRawConfiguration(fixtureServiceDir, rawYaml);

      await uninstallPlugin({
        configuration,
        serviceDir: fixtureServiceDir,
        configurationFilename: path.basename(fixtureConfigurationPath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(fixtureConfigurationPath, 'utf8');
      const parsed = await readParsedConfiguration(fixtureConfigurationPath);

      expect(fileText).to.include('pluginLogGroupArn: !GetAtt PluginLogGroup.Arn');
      expect(fileText).to.not.include(`- ${pluginName}`);
      expect(parsed.plugins).to.equal(undefined);
      expect(parsed.custom.pluginLogGroupArn).to.deep.equal({
        'Fn::GetAtt': ['PluginLogGroup', 'Arn'],
      });
    });

    it('preserves sibling shorthand tags when removing a plugin from object-form plugins.modules', async () => {
      const fixture = await fixturesEngine.setup('function');
      const fixtureServiceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        'plugins:',
        '  localPath: ./.serverless_plugins',
        '  modules:',
        `    - ${pluginName}`,
        '',
        'custom:',
        '  taggedValue: !Sub ${AWS::Region}',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath: fixtureConfigurationPath, configuration } =
        await writeRawConfiguration(fixtureServiceDir, rawYaml);

      await uninstallPlugin({
        configuration,
        serviceDir: fixtureServiceDir,
        configurationFilename: path.basename(fixtureConfigurationPath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(fixtureConfigurationPath, 'utf8');
      const parsed = await readParsedConfiguration(fixtureConfigurationPath);

      expect(fileText).to.include('taggedValue: !Sub ${AWS::Region}');
      expect(fileText).to.not.include(`- ${pluginName}`);
      expect(parsed.plugins.localPath).to.equal('./.serverless_plugins');
      expect(parsed.plugins.modules).to.equal(undefined);
      expect(parsed.custom.taggedValue).to.deep.equal({
        'Fn::Sub': '${AWS::Region}',
      });
    });

    it('preserves later plugins siblings when removing the last object-form plugin entry', async () => {
      const fixture = await fixturesEngine.setup('function');
      const fixtureServiceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        'plugins:',
        '  modules:',
        `    - ${pluginName}`,
        '  localPath: ./.serverless_plugins',
        '',
        'custom:',
        '  taggedValue: !Sub ${AWS::Region}',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath: fixtureConfigurationPath, configuration } =
        await writeRawConfiguration(fixtureServiceDir, rawYaml);

      await uninstallPlugin({
        configuration,
        serviceDir: fixtureServiceDir,
        configurationFilename: path.basename(fixtureConfigurationPath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(fixtureConfigurationPath, 'utf8');
      const parsed = await readParsedConfiguration(fixtureConfigurationPath);

      expect(fileText).to.include('localPath: ./.serverless_plugins');
      expect(fileText).to.include('taggedValue: !Sub ${AWS::Region}');
      expect(fileText).to.not.include(`- ${pluginName}`);
      expect(parsed.plugins.localPath).to.equal('./.serverless_plugins');
      expect(parsed.plugins.modules).to.equal(undefined);
      expect(parsed.custom.taggedValue).to.deep.equal({
        'Fn::Sub': '${AWS::Region}',
      });
    });

    it('removes plugins from a quoted top level plugins array without leaving a duplicate section', async () => {
      const fixture = await fixturesEngine.setup('function');
      const fixtureServiceDir = fixture.servicePath;
      const rawYaml = [
        'service: raw-plugin-yaml',
        'configValidationMode: error',
        "frameworkVersion: '*'",
        '',
        '"plugins":',
        `  - ${pluginName}`,
        '',
        'custom:',
        '  taggedValue: !Sub ${AWS::Region}',
        '',
        'provider:',
        '  name: aws',
        '  runtime: nodejs20.x',
        '',
      ].join('\n');

      const { configurationFilePath: fixtureConfigurationPath, configuration } =
        await writeRawConfiguration(fixtureServiceDir, rawYaml);

      await uninstallPlugin({
        configuration,
        serviceDir: fixtureServiceDir,
        configurationFilename: path.basename(fixtureConfigurationPath),
        options: {
          name: pluginName,
        },
      });

      const fileText = await fse.readFile(fixtureConfigurationPath, 'utf8');
      const parsed = await readParsedConfiguration(fixtureConfigurationPath);

      expect(fileText.match(/^(?:"plugins"|plugins):/gm)).to.equal(null);
      expect(parsed.plugins).to.equal(undefined);
      expect(parsed.custom.taggedValue).to.deep.equal({
        'Fn::Sub': '${AWS::Region}',
      });
    });
  });
});
