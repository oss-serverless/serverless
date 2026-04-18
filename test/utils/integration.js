// Integration tests related utils

'use strict';

const path = require('path');
const fsp = require('fs').promises;
const spawn = require('child-process-ext/spawn');
const log = require('log').get('serverless:test');
const logFetch = require('log').get('fetch');
const resolveAwsEnv = require('../lib/resolve-aws-env');
const { load: loadYaml } = require('js-yaml');

const serverlessExec = require('../serverless-binary');

const env = resolveAwsEnv();

async function resolveServiceName(cwd) {
  const configContent = await (async () => {
    try {
      return await fsp.readFile(path.join(cwd, 'serverless.yml'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  })();
  if (!configContent) return null;
  const configObject = (() => {
    try {
      return loadYaml(configContent);
    } catch (error) {
      return null;
    }
  })();
  if (!configObject) return null;
  return configObject.service;
}

async function deployService(cwd) {
  log.notice('deploy %s (at %s)', (await resolveServiceName(cwd)) || '[unknown]', cwd);
  return spawn(serverlessExec, ['deploy'], { cwd, env });
}

async function removeService(cwd) {
  log.notice('remove %s (at %s)', (await resolveServiceName(cwd)) || '[unknown]', cwd);
  return spawn(serverlessExec, ['remove'], { cwd, env });
}

let lastRequestId = 0;
async function fetchWithLogging(url, options) {
  const requestId = ++lastRequestId;
  logFetch.debug('[%d] %s %o', requestId, url, options);

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    logFetch.error('[%d] request error: %o', requestId, error);
    throw error;
  }

  logFetch.debug(
    '[%d] %d %j',
    requestId,
    response.status,
    Object.fromEntries(response.headers.entries())
  );
  response
    .clone()
    .arrayBuffer()
    .then(
      (buffer) => logFetch.debug('[%d] %s', requestId, Buffer.from(buffer).toString()),
      (error) => logFetch.error('[%d] response resolution error: %o', requestId, error)
    );
  return response;
}

function getMarkers(functionName) {
  return {
    start: `--- START ${functionName} ---`,
    end: `--- END ${functionName} ---`,
  };
}

module.exports = {
  deployService,
  env,
  fetch: fetchWithLogging,
  removeService,
  getMarkers,
};
