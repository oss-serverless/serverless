'use strict';

const { log } = require('@serverless/utils/log');
const _ = require('lodash');
const promptWithHistory = require('@serverless/utils/inquirer/prompt-with-history');

const awsCredentials = require('../../plugins/aws/utils/credentials');
const { confirm } = require('./utils');
const openBrowser = require('../../utils/open-browser');

const isValidAwsAccessKeyId = RegExp.prototype.test.bind(/^[A-Z0-9]{10,}$/);
const isValidAwsSecretAccessKey = RegExp.prototype.test.bind(/^[a-zA-Z0-9/+]{10,}$/);
const AWS = require('../../aws/sdk-v2');

const CREDENTIALS_SETUP_CHOICE = {
  LOCAL: '_local_',
  SKIP: '_skip_',
};

const awsAccessKeyIdInput = async ({ stepHistory }) => {
  return await promptWithHistory({
    message: 'AWS Access Key Id:',
    type: 'input',
    name: 'accessKeyId',
    stepHistory,
    validate: (input) => {
      if (isValidAwsAccessKeyId(input.trim())) return true;
      return 'AWS Access Key Id seems invalid.\n   Expected something like AKIAIOSFODNN7EXAMPLE';
    },
  });
};

const awsSecretAccessKeyInput = async ({ stepHistory }) => {
  return await promptWithHistory({
    message: 'AWS Secret Access Key:',
    type: 'input',
    name: 'secretAccessKey',
    stepHistory,
    validate: (input) => {
      if (isValidAwsSecretAccessKey(input.trim())) return true;
      return (
        'AWS Secret Access Key seems invalid.\n' +
        '   Expected something like wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      );
    },
  });
};

const credentialsSetupChoice = async (context) => {
  const credentialsSetupChoices = [
    { name: 'Local AWS Access Keys', value: CREDENTIALS_SETUP_CHOICE.LOCAL },
    { name: 'Skip', value: CREDENTIALS_SETUP_CHOICE.SKIP }
  ];
  const message =
    "No AWS credentials found. Serverless Framework needs these to automate deployment of infra & code.\n  Choose which type of AWS credentials you would like to use, and we'll help you set them up:";

  return await promptWithHistory({
    message,
    type: 'list',
    name: 'credentialsSetupChoice',
    choices: credentialsSetupChoices,
    stepHistory: context.stepHistory,
  });
};

const steps = {
  writeOnSetupSkip: () => {
    log.notice();
    log.notice.skip('You can setup your AWS account later.');
  },

  ensureAwsAccount: async ({ stepHistory }) => {
    if (await confirm('Do you have an AWS account?', { name: 'hasAwsAccount' })) return;
    openBrowser('https://portal.aws.amazon.com/billing/signup');
    await promptWithHistory({
      message: 'Create an AWS account. Then press [Enter] to continue.',
      name: 'createAwsAccountPrompt',
      stepHistory,
    });
  },
  ensureAwsCredentials: async ({ options, configuration, stepHistory }) => {
    const region = options.region || configuration.provider.region || 'us-east-1';
    openBrowser(
      `https://console.aws.amazon.com/iam/home?region=${region}#/users$new?step=final&accessKey&userNames=serverless&permissionType=policies&policies=arn:aws:iam::aws:policy%2FAdministratorAccess`
    );
    await promptWithHistory({
      message:
        'In your AWS account, create an AWS user with access keys. Then press [Enter] to continue.',
      name: 'generateAwsCredsPrompt',
      stepHistory,
    });
  },
  inputAwsCredentials: async (context) => {
    const accessKeyId = await awsAccessKeyIdInput(context);
    const secretAccessKey = await awsSecretAccessKeyInput(context);
    await awsCredentials.saveFileProfiles(new Map([['default', { accessKeyId, secretAccessKey }]]));
    log.notice();
    log.notice.success(
      `AWS credentials saved on your machine at "${
        process.platform === 'win32' ? '%userprofile%\\.aws\\credentials' : '~/.aws/credentials'
      }". Go there to change them at any time.`
    );
  },
};

module.exports = {
  async isApplicable(context) {
    const { configuration, serviceDir } = context;

    if (!serviceDir) {
      context.inapplicabilityReasonCode = 'NOT_IN_SERVICE_DIRECTORY';
      return false;
    }

    if (
      _.get(configuration, 'provider') !== 'aws' &&
      _.get(configuration, 'provider.name') !== 'aws'
    ) {
      context.inapplicabilityReasonCode = 'NON_AWS_PROVIDER';
      return false;
    }

    if (new AWS.S3().config.credentials) {
      context.inapplicabilityReasonCode = 'LOCAL_CREDENTIALS_CONFIGURED';
      return false;
    }
    if ((await awsCredentials.resolveFileProfiles()).size) {
      context.inapplicabilityReasonCode = 'LOCAL_CREDENTIAL_PROFILES_CONFIGURED';
      return false;
    }

    return true;
  },
  async run(context) {
    const credentialsSetupChoiceAnswer = await credentialsSetupChoice(context);

    if (credentialsSetupChoiceAnswer === CREDENTIALS_SETUP_CHOICE.LOCAL) {
      await steps.ensureAwsAccount(context);
      await steps.ensureAwsCredentials(context);
      await steps.inputAwsCredentials(context);
      return;
    }

    steps.writeOnSetupSkip();
  },
  steps,
  configuredQuestions: [
    'credentialsSetupChoice',
    'hasAwsAccount',
    'createAwsAccountPrompt',
    'generateAwsCredsPrompt',
    'accessKeyId',
    'secretAccessKey',
  ],
};
