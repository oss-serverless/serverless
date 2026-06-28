# Event Sources

This is the catalog of AWS Lambda event sources supported by osls. Each event source can be attached to a function under the `events` key in `serverless.yml`. For general information on how Lambda events work in osls, see the [events guide](../guides/events.md).

## HTTP

- [HTTP API (API Gateway v2)](http-api.md) — Deploy low-latency, low-cost HTTP APIs using API Gateway v2.
- [REST API (API Gateway v1)](apigateway.md) — Deploy full-featured REST APIs using API Gateway v1.
- [Application Load Balancer](alb.md) — Route incoming HTTP(S) requests from an ALB directly to Lambda functions.
- [Websocket](websocket.md) — Build bi-directional, real-time communication channels via API Gateway WebSocket APIs.

## Other event sources

- [ActiveMQ](activemq.md) — Trigger functions from messages on an Amazon MQ ActiveMQ broker.
- [Alexa Skill](alexa-skill.md) — Invoke functions in response to Alexa Skill requests.
- [Alexa Smart Home](alexa-smart-home.md) — Invoke functions from Alexa Smart Home skill events.
- [CloudFront](cloudfront.md) — Run functions at CloudFront edge locations (Lambda@Edge) to process CDN requests and responses.
- [CloudWatch Event](cloudwatch-event.md) — Trigger functions from CloudWatch (EventBridge) events. (Consider [EventBridge](event-bridge.md) for new projects.)
- [CloudWatch Log](cloudwatch-log.md) — Trigger functions from CloudWatch Logs log group subscriptions.
- [Cognito User Pool](cognito-user-pool.md) — Invoke functions from Cognito User Pool lifecycle triggers.
- [EventBridge](event-bridge.md) — React to events from AWS services, SaaS, and your own applications via Amazon EventBridge.
- [IoT](iot.md) — Trigger functions from AWS IoT rule events.
- [IoT Fleet Provisioning](iot-fleet-provisioning.md) — Invoke functions during AWS IoT fleet provisioning hooks.
- [Kafka](kafka.md) — Consume records from a self-managed Apache Kafka cluster.
- [MSK](msk.md) — Consume records from an Amazon Managed Streaming for Apache Kafka (MSK) cluster.
- [RabbitMQ](rabbitmq.md) — Trigger functions from messages on an Amazon MQ RabbitMQ broker.
- [S3](s3.md) — Invoke functions in response to Amazon S3 bucket object events.
- [Schedule](schedule.md) — Run functions on a recurring schedule using `rate` or `cron` expressions.
- [SNS](sns.md) — Invoke functions when messages are published to an Amazon SNS topic.
- [SQS](sqs.md) — Process messages from an Amazon SQS queue.
- [DynamoDB / Kinesis Streams](streams.md) — Consume records from DynamoDB Streams or Kinesis Data Streams.
