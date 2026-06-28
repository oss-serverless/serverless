# CloudWatch Event

[CloudWatch Events](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/WhatIsCloudWatchEvents.html) (now part of [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)) deliver a near real-time stream of system events that describe changes in AWS resources. osls can wire a `cloudwatchEvent` rule to a Lambda function so that the function runs whenever a matching event occurs. For new projects, consider the [`eventBridge`](event-bridge.md) event source instead.

## Simple event definition

This will enable your Lambda function to be called by an EC2 event rule.
Please check the page of [Event Types for CloudWatch Events](http://docs.aws.amazon.com/AmazonCloudWatch/latest/events/EventTypes.html).

```yaml
functions:
  myCloudWatch:
    handler: myCloudWatch.handler
    events:
      - cloudwatchEvent:
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
```

## Enabling / Disabling

**Note:** `cloudwatchEvent` events are enabled by default.

This will create and attach a disabled `cloudwatchEvent` event for the `myCloudWatch` function.

```yaml
functions:
  myCloudWatch:
    handler: myCloudWatch.handler
    events:
      - cloudwatchEvent:
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
          enabled: false
```

## Specify Input or Inputpath

You can specify input values ​​to the Lambda function.

```yaml
functions:
  myCloudWatch:
    handler: myCloudWatch.handler
    events:
      - cloudwatchEvent:
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
          input:
            key1: value1
            key2: value2
            stageParams:
              stage: dev
      - cloudwatchEvent:
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
          inputPath: '$.stageVariables'
      - cloudwatchEvent:
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
          inputTransformer:
            inputPathsMap:
              eventTime: '$.time'
            inputTemplate: '{"time": <eventTime>, "key1": "value1"}'
```

## Specifying a Description

You can also specify a CloudWatch Event description.

```yaml
functions:
  myCloudWatch:
    handler: myCloudWatch.handler
    events:
      - cloudwatchEvent:
          description: 'CloudWatch Event triggered on EC2 Instance pending state'
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
```

## Specifying a Name

You can also specify a CloudWatch Event name. Keep in mind that the name must begin with a letter; contain only ASCII letters, digits, and hyphens; and not end with a hyphen or contain two consecutive hyphens. More information [here](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-name.html).

```yaml
functions:
  myCloudWatch:
    handler: myCloudWatch.handler
    events:
      - cloudwatchEvent:
          name: 'my-cloudwatch-event-name'
          event:
            source:
              - 'aws.ec2'
            detail-type:
              - 'EC2 Instance State-change Notification'
            detail:
              state:
                - pending
```

---

[← All Events](./README.md) · [Docs Home](../README.md)
