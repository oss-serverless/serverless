'use strict';

const { MAX_AWS_REQUEST_TRY } = require('../../utils');
const { getEventBusName, getEventBusTargetId } = require('./utils');
const {
  CreateEventBusCommand,
  DeleteEventBusCommand,
  PutRuleCommand,
  DeleteRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} = require('@aws-sdk/client-eventbridge');
const AWSClientFactory = require('../../../../../../aws/client-factory');

const awsFactory = new AWSClientFactory({ maxAttempts: MAX_AWS_REQUEST_TRY });

async function createEventBus(config) {
  const { eventBus, region } = config;

  if (eventBus) {
    if (eventBus.startsWith('arn')) {
      return Promise.resolve();
    }
    return awsFactory.send(
      'EventBridge',
      new CreateEventBusCommand({
        Name: eventBus,
      }),
      { region }
    );
  }
  return Promise.resolve();
}

async function deleteEventBus(config) {
  const { eventBus, region } = config;

  if (eventBus) {
    if (eventBus.startsWith('arn')) {
      return Promise.resolve();
    }

    return awsFactory.send(
      'EventBridge',
      new DeleteEventBusCommand({
        Name: eventBus,
      }),
      { region }
    );
  }
  return Promise.resolve();
}

async function updateRuleConfiguration(config) {
  const { ruleName, eventBus, pattern, schedule, region, state } = config;

  const EventBusName = getEventBusName(eventBus);

  return awsFactory.send(
    'EventBridge',
    new PutRuleCommand({
      Name: ruleName,
      EventBusName,
      EventPattern: JSON.stringify(pattern),
      ScheduleExpression: schedule,
      State: state,
    }),
    { region }
  );
}

async function removeRuleConfiguration(config) {
  const { ruleName, eventBus, region } = config;

  const EventBusName = getEventBusName(eventBus);

  return awsFactory.send(
    'EventBridge',
    new DeleteRuleCommand({
      Name: ruleName,
      EventBusName,
    }),
    { region }
  );
}

async function updateTargetConfiguration(config) {
  const { lambdaArn, ruleName, eventBus, input, inputPath, inputTransformer, region } = config;

  const EventBusName = getEventBusName(eventBus);

  let target = {
    Arn: lambdaArn,
    Id: getEventBusTargetId(ruleName),
  };

  if (input) {
    target = Object.assign(target, { Input: JSON.stringify(input) });
  } else if (inputPath) {
    target = Object.assign(target, { InputPath: inputPath });
  } else if (inputTransformer) {
    target = Object.assign(target, { InputTransformer: inputTransformer });
  }

  return removeTargetConfiguration(config).then(() =>
    awsFactory.send(
      'EventBridge',
      new PutTargetsCommand({
        Rule: ruleName,
        EventBusName,
        Targets: [target],
      }),
      { region }
    )
  );
}

async function removeTargetConfiguration(config) {
  const { ruleName, eventBus, region } = config;
  const EventBusName = getEventBusName(eventBus);

  return awsFactory.send(
    'EventBridge',
    new RemoveTargetsCommand({
      Ids: [getEventBusTargetId(ruleName)],
      Rule: ruleName,
      EventBusName,
    }),
    { region }
  );
}

module.exports = {
  createEventBus,
  deleteEventBus,
  updateRuleConfiguration,
  removeRuleConfiguration,
  updateTargetConfiguration,
  removeTargetConfiguration,
};
