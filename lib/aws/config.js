'use strict';

const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const https = require('https');
const fs = require('fs');

/**
 * Build AWS SDK v3 client configuration from environment and options
 * @param {Object} options - Configuration options
 * @param {string} options.region - AWS region
 * @param {Object} options.credentials - AWS credentials
 * @param {number} options.maxAttempts - Maximum retry attempts
 * @param {string} options.retryMode - Retry mode ('legacy', 'standard', 'adaptive')
 * @returns {Object} AWS SDK v3 client configuration
 */
function buildClientConfig(options = {}) {
  const config = {
    region:
      options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    maxAttempts: options.maxAttempts || getMaxRetries(),
    retryMode: options.retryMode || 'standard',
  };

  // Add credentials if provided
  if (options.credentials) {
    config.credentials = options.credentials;
  }

  // Configure HTTP options (proxy, timeout, certificates)
  const httpOptions = buildHttpOptions();
  if (httpOptions) {
    config.requestHandler = httpOptions;
  }

  return config;
}

/**
 * Get maximum retry attempts from environment
 * @returns {number} Maximum retry attempts
 */
function getMaxRetries() {
  const userValue = Number(process.env.SLS_AWS_REQUEST_MAX_RETRIES);
  return userValue >= 0 ? userValue : 4;
}

/**
 * Build HTTP options for AWS SDK v3 clients
 * @returns {Object|null} HTTP configuration or null if no special config needed
 */
function buildHttpOptions() {
  const httpOptions = {};
  let needsCustomAgent = false;

  // Configure timeout
  const timeout = process.env.AWS_CLIENT_TIMEOUT || process.env.aws_client_timeout;
  if (timeout) {
    httpOptions.requestTimeout = parseInt(timeout, 10);
  }

  // Configure proxy
  const proxy = getProxyUrl();
  if (proxy) {
    httpOptions.httpsAgent = new HttpsProxyAgent(buildProxyOptions(proxy));
    needsCustomAgent = true;
  }

  // Configure custom CA certificates
  const caCerts = getCACertificates();
  if (caCerts.length > 0) {
    const agentOptions = {
      rejectUnauthorized: true,
      ca: caCerts,
    };

    if (proxy) {
      // Merge with existing proxy agent options
      Object.assign(httpOptions.httpsAgent.options, agentOptions);
    } else {
      httpOptions.httpsAgent = new https.Agent(agentOptions);
      needsCustomAgent = true;
    }
  }

  return needsCustomAgent || httpOptions.requestTimeout ? httpOptions : null;
}

/**
 * Get proxy URL from environment variables
 * @returns {string|null} Proxy URL or null if not configured
 */
function getProxyUrl() {
  return (
    process.env.proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    null
  );
}

/**
 * Build proxy options for HttpsProxyAgent
 * @param {string} proxyUrl - Proxy URL
 * @returns {Object} Proxy configuration options
 */
function buildProxyOptions(proxyUrl) {
  // not relying on recommended WHATWG URL
  // due to missing support for it in https-proxy-agent
  // https://github.com/TooTallNate/node-https-proxy-agent/issues/117
  return url.parse(proxyUrl);
}

/**
 * Get CA certificates from environment variables and files
 * @returns {Array} Array of CA certificates
 */
function getCACertificates() {
  let caCerts = [];

  // Get certificates from environment variable
  const ca = process.env.ca || process.env.HTTPS_CA || process.env.https_ca;
  if (ca) {
    // Can be a single certificate or multiple, comma separated.
    const caArr = ca.split(',');
    // Replace the newline -- https://stackoverflow.com/questions/30400341
    caCerts = caCerts.concat(caArr.map((cert) => cert.replace(/\\n/g, '\n')));
  }

  // Get certificates from files
  const cafile = process.env.cafile || process.env.HTTPS_CAFILE || process.env.https_cafile;
  if (cafile) {
    // Can be a single certificate file path or multiple paths, comma separated.
    const caPathArr = cafile.split(',');
    caCerts = caCerts.concat(caPathArr.map((cafilePath) => fs.readFileSync(cafilePath.trim())));
  }

  return caCerts;
}

/**
 * Check if S3 transfer acceleration should be used
 * @param {string} method - S3 method name
 * @param {Object} params - Request parameters
 * @returns {boolean} Whether to use acceleration
 */
function shouldUseS3Acceleration(method, params) {
  const accelerationCompatibleMethods = new Set(['upload', 'putObject']);

  return (
    accelerationCompatibleMethods.has(method) && params && params.isS3TransferAccelerationEnabled
  );
}

module.exports = {
  buildClientConfig,
  shouldUseS3Acceleration,
};
