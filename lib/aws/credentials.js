'use strict';

const v2CredentialProviders = new WeakMap();

function resolveV2Credentials(credentials) {
  if (!credentials) return Promise.resolve();

  if (typeof credentials.getPromise === 'function') {
    return credentials.getPromise();
  }

  if (typeof credentials.get === 'function') {
    return new Promise((resolve, reject) => {
      credentials.get((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  const shouldRefresh =
    typeof credentials.needsRefresh !== 'function' || credentials.needsRefresh();

  if (shouldRefresh && typeof credentials.refreshPromise === 'function') {
    return credentials.refreshPromise();
  }

  if (shouldRefresh && typeof credentials.refresh === 'function') {
    return new Promise((resolve, reject) => {
      credentials.refresh((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  return Promise.resolve();
}

function createCredentialsProviderError(message) {
  return Object.assign(new Error(message), { name: 'CredentialsProviderError' });
}

function normalizeCredentialIdentity(credentials) {
  if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) {
    throw createCredentialsProviderError('Could not load credentials from Serverless AWS provider');
  }

  const result = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  };

  if (credentials.sessionToken) result.sessionToken = credentials.sessionToken;
  if (credentials.expireTime) result.expiration = credentials.expireTime;

  return result;
}

function v2CredentialsToV3Provider(credentials) {
  if (!credentials) return undefined;

  if (v2CredentialProviders.has(credentials)) return v2CredentialProviders.get(credentials);

  const provider = async () => {
    await resolveV2Credentials(credentials);
    return normalizeCredentialIdentity(credentials);
  };

  v2CredentialProviders.set(credentials, provider);
  return provider;
}

function staticCredentialsToV3Provider(credentials) {
  if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) return undefined;

  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  };
}

function toV3CredentialsProvider(params = {}) {
  if (params.credentials) return v2CredentialsToV3Provider(params.credentials);
  return staticCredentialsToV3Provider(params);
}

module.exports = {
  toV3CredentialsProvider,
  v2CredentialsToV3Provider,
};
