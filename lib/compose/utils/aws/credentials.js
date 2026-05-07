'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { fromIni, fromNodeProviderChain } = require('@aws-sdk/credential-providers');

const defaultConfigProfileSectionRegex = /^profile\s+(?:default|"default"|'default')$/;

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

function expandHomeDirPath(filePath) {
  return filePath.startsWith('~/') ? path.join(os.homedir(), filePath.slice(2)) : filePath;
}

function getSharedCredentialsFilepath() {
  return expandHomeDirPath(
    process.env.AWS_SHARED_CREDENTIALS_FILE || path.join(os.homedir(), '.aws', 'credentials')
  );
}

function getSharedConfigFilepath() {
  return expandHomeDirPath(
    process.env.AWS_CONFIG_FILE || path.join(os.homedir(), '.aws', 'config')
  );
}

function fromProfile(profile) {
  return fromIni({
    profile,
    filepath: getSharedCredentialsFilepath(),
    configFilepath: getSharedConfigFilepath(),
    mfaCodeProvider: promptMfaCode,
  });
}

function getIniSectionNames(filePath) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    const sectionNames = new Set();

    for (const line of contents.split(/\r?\n/)) {
      const trimmedLine = line.split(/(^|\s)[;#]/)[0].trim();
      if (trimmedLine[0] === '[' && trimmedLine[trimmedLine.length - 1] === ']') {
        sectionNames.add(trimmedLine.slice(1, -1));
      }
    }

    return sectionNames;
  } catch (error) {
    if (error && error.code === 'ENOENT') return new Set();
    throw error;
  }
}

function isDefaultConfigProfileSection(sectionName) {
  return sectionName === 'default' || defaultConfigProfileSectionRegex.test(sectionName);
}

function doesImplicitDefaultProfileExist() {
  const credentialsProfiles = getIniSectionNames(getSharedCredentialsFilepath());
  if (credentialsProfiles.has('default')) return true;

  const configSectionNames = getIniSectionNames(getSharedConfigFilepath());
  for (const sectionName of configSectionNames) {
    if (isDefaultConfigProfileSection(sectionName)) return true;
  }

  return false;
}

function fromImplicitDefaultProfileWithFallback() {
  const profileProvider = fromProfile('default');
  let fallbackProvider;

  return async (providerOptions) => {
    try {
      return await profileProvider(providerOptions);
    } catch (error) {
      if (doesImplicitDefaultProfileExist()) throw error;
      if (!fallbackProvider) fallbackProvider = fromNodeProviderChain();
      return fallbackProvider(providerOptions);
    }
  };
}

function getCredentialProvider({ profile, stage } = {}) {
  const stageUpper = stage ? stage.toUpperCase() : null;

  if (profile) return fromProfile(profile);
  if (stageUpper && process.env[`AWS_${stageUpper}_PROFILE`]) {
    return fromProfile(process.env[`AWS_${stageUpper}_PROFILE`]);
  }
  if (stageUpper && hasEnvironmentCredentials(`AWS_${stageUpper}`)) {
    return fromPrefixedEnv(`AWS_${stageUpper}`);
  }
  if (process.env.AWS_PROFILE) return fromProfile(process.env.AWS_PROFILE);
  if (hasEnvironmentCredentials('AWS')) return fromPrefixedEnv('AWS');
  if (process.env.AWS_DEFAULT_PROFILE) return fromProfile(process.env.AWS_DEFAULT_PROFILE);

  return fromImplicitDefaultProfileWithFallback();
}

module.exports = {
  doesImplicitDefaultProfileExist,
  fromPrefixedEnv,
  getCredentialProvider,
  hasEnvironmentCredentials,
};
