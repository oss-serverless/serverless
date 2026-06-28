# AWS - Generate Event

Creates sample Lambda function payloads for different types of events.

```bash
osls generate-event --type eventType
```

## Options

- `--type` or `-t` The type of the event to generate payload for. **Required**.
- `--body` or `-b` The body for the message, request, or stream event.

## Available event types

- aws:alexaSkill
- aws:alexaSmartHome
- aws:apiGateway
- aws:cloudWatch
- aws:cloudWatchLog
- aws:cognitoUserPool
- aws:dynamo
- aws:iot
- aws:kinesis
- aws:s3
- aws:sns
- aws:sqs
- aws:websocket

## Examples

### Generate SQS event payload

```bash
osls generate-event -t aws:sqs
```

### Generate Kinesis event payload with body

```bash
osls generate-event -t aws:kinesis -b '{"foo": "bar"}'
```

### Generate SQS event and save it to a file

```bash
osls generate-event -t aws:sqs > event.json
```

---

[← All Commands](./README.md) · [Docs Home](../README.md)
