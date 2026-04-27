'use strict';

const readline = require('readline');
const { fromIni, fromNodeProviderChain } = require('@aws-sdk/credential-providers');

function hasEnvironmentCredentials(prefix) {
  return Boolean(
    process.env[`${prefix}_ACCESS_KEY_ID`] && process.env[`${prefix}_SECRET_ACCESS_KEY`]
  );
}

function fromPrefixedEnv(prefix) {
  return async () => {
    const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`];
    const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`];
    const sessionToken = process.env[`${prefix}_SESSION_TOKEN`];

    if (!accessKeyId || !secretAccessKey) {
      throw Object.assign(new Error(`Could not load credentials from ${prefix} environment`), {
        name: 'CredentialsProviderError',
      });
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    };
  };
}

function promptMfaCode(mfaSerial) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`Enter MFA code for ${mfaSerial}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function getSharedCredentialsFilepath() {
  return process.env.AWS_SHARED_CREDENTIALS_FILE || undefined;
}

function getSharedConfigFilepath() {
  return process.env.AWS_CONFIG_FILE || undefined;
}

function fromProfile(profile) {
  return fromIni({
    profile,
    filepath: getSharedCredentialsFilepath(),
    configFilepath: getSharedConfigFilepath(),
    mfaCodeProvider: promptMfaCode,
  });
}

function isMissingProfileError(error, profile) {
  const message = String(error && error.message ? error.message : '');

  return (
    error &&
    error.name === 'CredentialsProviderError' &&
    (message.includes(`Profile ${profile} could not be found`) ||
      message.includes(`Could not resolve credentials using profile: ${profile}`) ||
      message.includes(`Could not resolve credentials using profile: [${profile}]`) ||
      message.includes('Profile is not configured'))
  );
}

function fromDefaultProfileWithFallback(profile) {
  const profileProvider = fromProfile(profile);
  const defaultProvider = fromNodeProviderChain();

  return async () => {
    try {
      return await profileProvider();
    } catch (error) {
      if (!isMissingProfileError(error, profile)) throw error;
      return defaultProvider();
    }
  };
}

function getAwsSdkV3CredentialsProviderCacheKey({ provider, profile } = {}) {
  const stage = provider && provider.getStage ? provider.getStage() : null;
  const stageUpper = stage ? stage.toUpperCase() : null;
  const providerProfile =
    provider && provider.serverless && provider.serverless.service.provider.profile;
  const cliProfile = provider && provider.options && provider.options['aws-profile'];

  return JSON.stringify({
    profile: profile || null,
    stage: stage || null,
    cliProfile: cliProfile || null,
    providerProfile: providerProfile || null,
    awsProfile: process.env.AWS_PROFILE || null,
    awsDefaultProfile: process.env.AWS_DEFAULT_PROFILE || null,
    stageProfile: stageUpper ? process.env[`AWS_${stageUpper}_PROFILE`] || null : null,
    hasStageEnvironmentCredentials: stageUpper
      ? hasEnvironmentCredentials(`AWS_${stageUpper}`)
      : false,
    hasEnvironmentCredentials: hasEnvironmentCredentials('AWS'),
    sharedCredentialsFile: process.env.AWS_SHARED_CREDENTIALS_FILE || null,
    sharedConfigFile: process.env.AWS_CONFIG_FILE || null,
  });
}

function getAwsSdkV3CredentialsProvider({ provider, profile } = {}) {
  const stage = provider && provider.getStage ? provider.getStage() : null;
  const stageUpper = stage ? stage.toUpperCase() : null;
  const providerProfile =
    provider && provider.serverless && provider.serverless.service.provider.profile;
  const cliProfile = provider && provider.options && provider.options['aws-profile'];

  if (cliProfile) return fromProfile(cliProfile);
  if (profile) return fromProfile(profile);
  if (stageUpper && process.env[`AWS_${stageUpper}_PROFILE`]) {
    return fromProfile(process.env[`AWS_${stageUpper}_PROFILE`]);
  }
  if (stageUpper && hasEnvironmentCredentials(`AWS_${stageUpper}`)) {
    return fromPrefixedEnv(`AWS_${stageUpper}`);
  }
  if (process.env.AWS_PROFILE) return fromProfile(process.env.AWS_PROFILE);
  if (hasEnvironmentCredentials('AWS')) return fromPrefixedEnv('AWS');
  if (providerProfile) return fromProfile(providerProfile);

  return fromDefaultProfileWithFallback(process.env.AWS_DEFAULT_PROFILE || 'default');
}

module.exports = {
  fromPrefixedEnv,
  getAwsSdkV3CredentialsProviderCacheKey,
  getAwsSdkV3CredentialsProvider,
  hasEnvironmentCredentials,
  isMissingProfileError,
};
