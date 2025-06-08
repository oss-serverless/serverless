'use strict';

const path = require('path');
const validate = require('./lib/validate');
const stdin = require('get-stdin');
const formatLambdaLogEvent = require('./utils/format-lambda-log-event');
const ServerlessError = require('../../serverless-error');
const { writeText, style } = require('@serverless/utils/log');

class AwsInvoke {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');

    Object.assign(this, validate);

    this.hooks = {
      'invoke:invoke': async () => {
        await this.extendedValidate();
        this.log(await this.invoke());
      },
    };
  }

  /**
   * Helper method to route Lambda requests through v2 or v3 based on feature flag
   * @private
   */
  async _lambdaRequest(method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3('Lambda', method, params);
    }
    return this.provider.request('Lambda', method, params);
  }

  async validateFile(key) {
    const absolutePath = path.resolve(this.serverless.serviceDir, this.options[key]);
    try {
      return await this.serverless.utils.readFile(absolutePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new ServerlessError('The file you provided does not exist.', 'FILE_NOT_FOUND');
      }
      throw err;
    }
  }

  async extendedValidate() {
    this.validate();
    // validate function exists in service
    this.options.functionObj = this.serverless.service.getFunction(this.options.function);
    this.options.data = this.options.data || '';

    if (!this.options.data) {
      if (this.options.path) {
        this.options.data = await this.validateFile('path');
      } else {
        try {
          this.options.data = await stdin();
        } catch {
          // continue if no stdin was provided
        }
      }
    }

    if (!this.options.context && this.options.contextPath) {
      this.options.context = await this.validateFile('contextPath');
    }

    try {
      if (!this.options.raw) {
        this.options.data = JSON.parse(this.options.data);
      }
    } catch (exception) {
      // do nothing if it's a simple string or object already
    }

    try {
      if (!this.options.raw && this.options.context) {
        this.options.context = JSON.parse(this.options.context);
      }
    } catch (exception) {
      // do nothing if it's a simple string or object already
    }
  }

  async invoke() {
    const invocationType = this.options.type || 'RequestResponse';
    if (invocationType !== 'RequestResponse') {
      this.options.log = 'None';
    } else {
      this.options.log = this.options.log ? 'Tail' : 'None';
    }

    const params = {
      FunctionName: this.options.functionObj.name,
      InvocationType: invocationType,
      LogType: this.options.log,
      Payload: Buffer.from(JSON.stringify(this.options.data || {})),
    };

    if (this.options.context) {
      params.ClientContext = Buffer.from(JSON.stringify(this.options.context)).toString('base64');
    }

    if (this.options.qualifier) {
      params.Qualifier = this.options.qualifier;
    }

    return this._lambdaRequest('invoke', params);
  }

  log(invocationReply) {
    if (invocationReply.Payload) {
      const response = JSON.parse(invocationReply.Payload);

      writeText(JSON.stringify(response, null, 4));
    }

    if (invocationReply.LogResult) {
      writeText(
        style.aside('--------------------------------------------------------------------')
      );
      const logResult = Buffer.from(invocationReply.LogResult, 'base64').toString();
      logResult.split('\n').forEach((line) => {
        if (line.includes('SERVERLESS_ENTERPRISE') || line.startsWith('END')) {
          return;
        }
        writeText(formatLambdaLogEvent(line));
      });
    }

    if (invocationReply.FunctionError) {
      throw new ServerlessError('Invoked function failed', 'AWS_LAMBDA_INVOCATION_FAILED');
    }
  }
}

module.exports = AwsInvoke;
