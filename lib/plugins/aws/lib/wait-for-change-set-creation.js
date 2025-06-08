'use strict';

const wait = require('timers-ext/promise/sleep');
const ServerlessError = require('../../../serverless-error');
const isChangeSetWithoutChanges = require('../utils/is-change-set-without-changes');
const { log } = require('@serverless/utils/log');
const getMonitoringFrequency = require('../utils/get-monitoring-frequency');

module.exports = {
  /**
   * Helper method to route CloudFormation requests through v2 or v3 based on feature flag
   * @private
   */
  async _cloudFormationRequest(method, params) {
    // Use v3 if feature flag is enabled, otherwise fallback to v2
    if (this.provider._v3Enabled) {
      return this.provider.requestV3('CloudFormation', method, params);
    }
    return this.provider.request('CloudFormation', method, params);
  },

  async waitForChangeSetCreation(changeSetName, stackName) {
    const params = {
      ChangeSetName: changeSetName,
      StackName: stackName,
    };

    const callWithRetry = async () => {
      const changeSetDescription = await this._cloudFormationRequest('describeChangeSet', params);
      if (
        changeSetDescription.Status === 'CREATE_COMPLETE' ||
        isChangeSetWithoutChanges(changeSetDescription)
      ) {
        return changeSetDescription;
      }

      if (
        changeSetDescription.Status === 'CREATE_PENDING' ||
        changeSetDescription.Status === 'CREATE_IN_PROGRESS'
      ) {
        log.info('Change Set did not reach desired state, retrying');
        await wait(getMonitoringFrequency());
        return await callWithRetry();
      }

      throw new ServerlessError(
        `Could not create Change Set "${changeSetDescription.ChangeSetName}" due to: ${changeSetDescription.StatusReason}`,
        'AWS_CLOUD_FORMATION_CHANGE_SET_CREATION_FAILED'
      );
    };

    return await callWithRetry();
  },
};
