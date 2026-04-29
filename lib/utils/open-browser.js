'use strict';

const fs = require('node:fs');
const open = require('open');
const { log, style } = require('./serverless-utils/log');

let isDockerCached;

function hasDockerEnv() {
  try {
    fs.statSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
}

function hasDockerMountInfo() {
  try {
    return fs.readFileSync('/proc/self/mountinfo', 'utf8').includes('/docker/containers/');
  } catch {
    return false;
  }
}

function isDocker() {
  isDockerCached ??= hasDockerEnv() || hasDockerCGroup() || hasDockerMountInfo();
  return isDockerCached;
}

module.exports = function openBrowser(url) {
  log.notice();
  log.notice(
    style.aside(`If your browser does not open automatically, please open this URL: ${url}`)
  );
  log.notice();
  const browser = process.env.BROWSER;
  if (browser === 'none' || isDocker()) return;
  open(url).then((subprocess) =>
    subprocess.on('error', (err) => {
      log.info(`Opening of browser window errored with ${err.stack}`);
    })
  );
};
