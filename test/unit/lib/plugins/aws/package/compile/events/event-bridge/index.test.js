'use strict';

const chai = require('chai');
const runServerless = require('../../../../../../../../utils/run-serverless');

const expect = chai.expect;

describe('EventBridgeEvents', () => {
  describe('using native CloudFormation', () => {
    describe('when event bus is created as a part of the stack', () => {
      let cfResources;
      let naming;
      let eventBusLogicalId;
      let ruleResource;
      let ruleTarget;
      const schedule = 'rate(10 minutes)';
      const eventBusName = 'nondefault';
      const description = 'My lambda description';
      const pattern = {
        source: ['aws.cloudformation'],
      };
      const input = {
        key1: 'value1',
        key2: {
          nested: 'value2',
        },
      };
      const inputPath = '$.stageVariables';
      const inputTransformer = {
        inputTemplate: '{"time": <eventTime>, "key1": "value1"}',
        inputPathsMap: {
          eventTime: '$.time',
        },
      };
      const retryPolicy = {
        maximumEventAge: 7200,
        maximumRetryAttempts: 9,
      };

      const deadLetterQueueArn = {
        'Fn::GetAtt': ['test', 'Arn'],
      };

      const getRuleResourceEndingWith = (resources, ending) =>
        Object.values(resources).find(
          (resource) =>
            resource.Type === 'AWS::Events::Rule' && resource.Properties.Name.endsWith(ending)
        );

      before(async () => {
        const { cfTemplate, awsNaming } = await runServerless({
          fixture: 'function',
          configExt: {
            functions: {
              basic: {
                events: [
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      input,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      inputPath,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      inputTransformer,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      enabled: false,
                      pattern,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      enabled: true,
                      pattern,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      retryPolicy,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      deadLetterQueueArn,
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: eventBusName,
                      schedule,
                      pattern,
                      description,
                    },
                  },
                ],
              },
            },
          },
          command: 'package',
        });
        cfResources = cfTemplate.Resources;
        naming = awsNaming;
        eventBusLogicalId = naming.getEventBridgeEventBusLogicalId(eventBusName);
        ruleResource = getRuleResourceEndingWith(cfResources, '1');
        ruleTarget = ruleResource.Properties.Targets[0];
      });

      it('should create an EventBus resource', () => {
        expect(cfResources[eventBusLogicalId].Properties).to.deep.equal({ Name: eventBusName });
      });

      it('should correctly set ScheduleExpression on a created rule', () => {
        expect(ruleResource.Properties.ScheduleExpression).to.equal('rate(10 minutes)');
      });

      it('should correctly set State by default on a created rule', () => {
        expect(ruleResource.Properties.State).to.equal('ENABLED');
      });

      it('should correctly set State when disabled on a created rule', () => {
        const disabledRuleResource = getRuleResourceEndingWith(cfResources, '4');
        expect(disabledRuleResource.Properties.State).to.equal('DISABLED');
      });

      it('should correctly set State when enabled on a created rule', () => {
        const enabledRuleResource = getRuleResourceEndingWith(cfResources, '5');
        expect(enabledRuleResource.Properties.State).to.equal('ENABLED');
      });

      it('should correctly set EventPattern on a created rule', () => {
        expect(ruleResource.Properties.EventPattern).to.deep.equal(pattern);
      });

      it('should correctly set Input on the target for the created rule', () => {
        expect(ruleTarget.Input).to.deep.equal(JSON.stringify(input));
      });

      it('should correctly set InputPath on the target for the created rule', () => {
        const inputPathRuleResource = getRuleResourceEndingWith(cfResources, '2');
        const inputPathRuleTarget = inputPathRuleResource.Properties.Targets[0];
        expect(inputPathRuleTarget.InputPath).to.deep.equal(inputPath);
      });

      it('should correctly set InputTransformer on the target for the created rule', () => {
        const inputTransformerRuleResource = getRuleResourceEndingWith(cfResources, '3');
        const inputTransformerRuleTarget = inputTransformerRuleResource.Properties.Targets[0];
        expect(inputTransformerRuleTarget.InputTransformer.InputPathsMap).to.deep.equal(
          inputTransformer.inputPathsMap
        );
        expect(inputTransformerRuleTarget.InputTransformer.InputTemplate).to.deep.equal(
          inputTransformer.inputTemplate
        );
      });

      it('should support retryPolicy configuration', () => {
        const retryPolicyRuleTarget = getRuleResourceEndingWith(cfResources, '6').Properties
          .Targets[0];
        expect(retryPolicyRuleTarget.RetryPolicy).to.deep.equal({
          MaximumEventAgeInSeconds: 7200,
          MaximumRetryAttempts: 9,
        });
      });

      it('should support deadLetterQueueArn configuration', () => {
        const deadLetterConfigRuleTarget = getRuleResourceEndingWith(cfResources, '7').Properties
          .Targets[0];
        expect(deadLetterConfigRuleTarget.DeadLetterConfig).to.have.property('Arn');
      });

      it('should create a rule that depends on created EventBus', () => {
        expect(ruleResource.DependsOn).to.equal(eventBusLogicalId);
      });

      it('should create a rule that references correct function in target', () => {
        expect(ruleTarget.Arn['Fn::GetAtt'][0]).to.equal(naming.getLambdaLogicalId('basic'));
      });

      it('should create a lambda permission resource that correctly references event bus in SourceArn', () => {
        const lambdaPermissionResource =
          cfResources[naming.getEventBridgeLambdaPermissionLogicalId('basic', 1)];

        expect(
          lambdaPermissionResource.Properties.SourceArn['Fn::Join'][1][5]['Fn::Join'][1][1]
        ).to.deep.equal(eventBusName);
      });

      it('should correctly set ScheduleExpression on a created rule', () => {
        const descriptionResource = getRuleResourceEndingWith(cfResources, '8');
        expect(descriptionResource.Properties.Description).to.equal('My lambda description');
      });
    });

    describe('when it references already existing EventBus or uses default one', () => {
      let cfResources;
      let naming;

      before(async () => {
        const { cfTemplate, awsNaming } = await runServerless({
          fixture: 'function',
          command: 'package',
          configExt: {
            functions: {
              basic: {
                name: 'event-bridge-lambda',
                events: [
                  {
                    eventBridge: {
                      schedule: 'rate(10 minutes)',
                      eventBus: 'arn:xxxxx',
                    },
                  },
                  {
                    eventBridge: {
                      schedule: 'rate(10 minutes)',
                      eventBus: { Ref: 'ImportedEventBus' },
                    },
                  },
                  {
                    eventBridge: {
                      schedule: 'rate(10 minutes)',
                      eventBus: 'default',
                    },
                  },
                  {
                    eventBridge: {
                      schedule: 'rate(10 minutes)',
                    },
                  },
                  {
                    eventBridge: {
                      eventBus: 'default',
                      schedule: 'rate(10 minutes)',
                      name: 'custom-event-name-test',
                      enabled: false,
                    },
                  },
                ],
              },
            },
          },
        });
        cfResources = cfTemplate.Resources;
        naming = awsNaming;
      });

      it('should not create an EventBus if it is provided or default', async () => {
        expect(Object.values(cfResources).some((value) => value.Type === 'AWS::Events::EventBus'))
          .to.be.false;
      });

      it('should create a lambda permission resource that correctly references arn event bus in SourceArn', () => {
        const lambdaPermissionResource =
          cfResources[naming.getEventBridgeLambdaPermissionLogicalId('basic', 1)];

        expect(
          lambdaPermissionResource.Properties.SourceArn['Fn::Join'][1][5]['Fn::Join'][1][1]
        ).to.deep.equal('arn:xxxxx');
      });

      it('should create a lambda permission resource that correctly references CF event bus in SourceArn', () => {
        const lambdaPermissionResource =
          cfResources[naming.getEventBridgeLambdaPermissionLogicalId('basic', 2)];

        expect(
          lambdaPermissionResource.Properties.SourceArn['Fn::Join'][1][5]['Fn::Join'][1][1]
        ).to.deep.equal({ Ref: 'ImportedEventBus' });
      });

      it('should create a lambda permission resource that correctly references explicit default event bus in SourceArn', () => {
        const lambdaPermissionResource =
          cfResources[naming.getEventBridgeLambdaPermissionLogicalId('basic', 3)];

        expect(
          lambdaPermissionResource.Properties.SourceArn['Fn::Join'][1][5]['Fn::Join'][1][1]
        ).to.equal('default');
      });

      it('should create a lambda permission resource that correctly references implicit default event bus in SourceArn', () => {
        const lambdaPermissionResource =
          cfResources[naming.getEventBridgeLambdaPermissionLogicalId('basic', 4)];

        expect(
          lambdaPermissionResource.Properties.SourceArn['Fn::Join'][1][5]['Fn::Join'][1]
        ).not.to.include('default');
      });

      it('should correctly set event name when set', () => {
        const eventBridgeResource =
          cfResources[naming.getEventBridgeRuleLogicalId('Eventbridgelambdarule5')];

        const customName = 'custom-event-name-test';
        expect(eventBridgeResource.Properties.Name).to.eq(customName);
      });
    });
  });

  it('should reject removed `provider.eventBridge.useCloudFormation` setting', async () => {
    await expect(
      runServerless({
        fixture: 'function',
        command: 'package',
        configExt: {
          provider: {
            eventBridge: {
              useCloudFormation: true,
            },
          },
        },
      })
    ).to.be.eventually.rejected.and.have.property(
      'code',
      'INVALID_NON_SCHEMA_COMPLIANT_CONFIGURATION'
    );
  });
});
