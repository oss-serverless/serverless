# IoT

AWS IoT lets you invoke a Lambda function in response to messages published to the AWS IoT message broker. osls creates an [IoT topic rule](https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html) whose SQL statement selects matching MQTT messages and invokes your function. See the [AWS IoT documentation](https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html).

## Simple event definition

This will enable your Lambda function to be called by an AWS IoT rule.

```yaml
functions:
  myIoT:
    handler: myIoT.handler
    events:
      - iot:
          sql: "SELECT * FROM 'some_topic'"
```

## Enabling / Disabling

**Note:** `iot` events are enabled by default.

This will create and attach a disabled `iot` event for the `myIoT` function.

```yaml
functions:
  myIoT:
    handler: myIoT.handler
    events:
      - iot:
          sql: "SELECT * FROM 'some_topic'"
          enabled: false
```

## Specify Name and Description

Name and Description can be specified with the help of the `name` and `description` properties.

```yaml
functions:
  myIoT:
    handler: myIoT.handler
    events:
      - iot:
          name: 'myIotEvent'
          sql: "SELECT * FROM 'some_topic'"
          description: 'My IoT Event Description'
```

## Specify SQL Versions

[SQL Versions](http://docs.aws.amazon.com/iot/latest/developerguide/iot-rule-sql-version.html) can be specified for an `iot` event. However the `sqlVersion` is not a required property.

```yaml
functions:
  myIoT:
    handler: myIoT.handler
    events:
      - iot:
          sql: "SELECT * FROM 'some_topic'"
          sqlVersion: 'beta'
```

---

[← All Events](./README.md) · [Docs Home](../README.md)
