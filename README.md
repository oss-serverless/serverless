# osls

osls, short for Open Serverless, is an open-source command-line tool for deploying serverless applications on AWS. It uses familiar YAML in `serverless.yml` to define Lambda functions, event sources, IAM permissions, and supporting CloudFormation resources.

osls v4 continues the osls project that began as a maintained fork of [Serverless Framework](https://github.com/serverless/serverless) v3. It is independent from upstream Serverless Framework v4 and does not use Serverless Dashboard, Console, or licensing services. It remains compatible with most Serverless Framework v3 service configurations, with the v4 breaking changes documented in the [upgrade guide](./docs/guides/upgrading-to-v4.md).

osls v4 is currently in beta and will be released as stable soon. The stable osls v3 line lives on the [`3.x` branch](https://github.com/oss-serverless/osls/tree/3.x) and continues to receive regular releases. If you are coming from osls v3 or Serverless Framework v3, start with [Upgrading to v4](./docs/guides/upgrading-to-v4.md).

## Installation

Requires Node.js `^20.19.0 || ^22.13.0 || >=24`.

If you are replacing a global Serverless Framework installation, remove it first so the `serverless` command resolves to osls.

```sh
npm uninstall -g serverless
npm install -g osls@4

osls --version
```

The package provides the `osls`, `sls`, and `serverless` commands.

## Get Started

- [Setup](./docs/getting-started.md)
- [Upgrading to v4](./docs/guides/upgrading-to-v4.md)
- [Concepts](./docs/guides/intro.md)
- [AWS Credentials](./docs/guides/credentials.md)

## Usage

- [Deploying](./docs/guides/deploying.md)
- [Packaging](./docs/guides/packaging.md)
- [Testing](./docs/guides/testing.md)
- [Services](./docs/guides/services.md)
- [Functions](./docs/guides/functions.md)
- [Layers](./docs/guides/layers.md)
- [IAM Function Permissions](./docs/guides/iam.md)
- [Parameters](./docs/guides/parameters.md)
- [Variables](./docs/guides/variables.md)
- [Resources](./docs/guides/resources.md)
- [Composing services](./docs/guides/compose.md)
- [Workflow Tips](./docs/guides/workflow.md)
- [Security Model](./docs/guides/security.md)
- [Serverless.yml Reference](./docs/guides/serverless.yml.md)

## Function events

- [Overview](./docs/guides/events.md)
- [HTTP (API Gateway v2)](./docs/events/http-api.md)
- [REST (API Gateway v1)](./docs/events/apigateway.md)
- [ActiveMQ](./docs/events/activemq.md)
- [Application Load Balancer](./docs/events/alb.md)
- [Alexa Skill](./docs/events/alexa-skill.md)
- [Alexa Smart Home](./docs/events/alexa-smart-home.md)
- [CloudWatch Event](./docs/events/cloudwatch-event.md)
- [CloudWatch Log](./docs/events/cloudwatch-log.md)
- [CloudFront](./docs/events/cloudfront.md)
- [Cognito User Pool](./docs/events/cognito-user-pool.md)
- [EventBridge Event](./docs/events/event-bridge.md)
- [IoT](./docs/events/iot.md)
- [IoT Fleet Provisioning](./docs/events/iot-fleet-provisioning.md)
- [Kafka](./docs/events/kafka.md)
- [Kinesis & DynamoDB](./docs/events/streams.md)
- [MSK](./docs/events/msk.md)
- [RabbitMQ](./docs/events/rabbitmq.md)
- [S3](./docs/events/s3.md)
- [Schedule](./docs/events/schedule.md)
- [SNS](./docs/events/sns.md)
- [SQS](./docs/events/sqs.md)
- [Websocket](./docs/events/websocket.md)

## CLI Reference

- [Overview](./docs/cli-reference)
- [config credentials](./docs/cli-reference/config-credentials.md)
- [create](./docs/cli-reference/create.md)
- [install](./docs/cli-reference/install.md)
- [package](./docs/cli-reference/package.md)
- [deploy](./docs/cli-reference/deploy.md)
- [deploy function](./docs/cli-reference/deploy-function.md)
- [deploy list](./docs/cli-reference/deploy-list.md)
- [invoke](./docs/cli-reference/invoke.md)
- [invoke local](./docs/cli-reference/invoke-local.md)
- [logs](./docs/cli-reference/logs.md)
- [metrics](./docs/cli-reference/metrics.md)
- [info](./docs/cli-reference/info.md)
- [rollback](./docs/cli-reference/rollback.md)
- [rollback function](./docs/cli-reference/rollback-function.md)
- [remove](./docs/cli-reference/remove.md)
- [plugin list](./docs/cli-reference/plugin-list.md)
- [plugin search](./docs/cli-reference/plugin-search.md)
- [plugin install](./docs/cli-reference/plugin-install.md)
- [plugin uninstall](./docs/cli-reference/plugin-uninstall.md)
- [generate event](./docs/cli-reference/generate-event.md)
- [print](./docs/cli-reference/print.md)

## Learn More

- [Configuration Validation](./docs/guides/configuration-validation.md)
- [Resolution of Environment Variables](./docs/guides/environment-variables.md)
- [Deprecations](./docs/guides/deprecations.md)

## Creating Plugins

- [Overview](./docs/guides/plugins/README.md)
- [Creating Plugins](./docs/guides/plugins/creating-plugins.md)
  - [CLI Output](./docs/guides/plugins/cli-output.md)
  - [Custom Commands](./docs/guides/plugins/custom-commands.md)
  - [Custom Variables](./docs/guides/plugins/custom-variables.md)
  - [Extending the Configuration schema](./docs/guides/plugins/custom-configuration.md)
  - [Extending and overriding configuration](./docs/guides/plugins/extending-configuration.md)

## Project status

This repository was created and is maintained by [Bref](https://bref.sh) maintainers and contributors. The main goal is continuity for existing serverless projects, including Bref projects, so they keep working over the long term. No major new feature areas are planned, but community contributions are welcome for maintenance work such as supporting new AWS Lambda runtimes, adapting to AWS changes, fixing bugs, and making small improvements.

## Open-source sponsors

This project is open-source and free to use. However, maintaining it requires time and effort. If you want to support the project, you can become a sponsor on GitHub Sponsors.

<p align="center">
<a href="https://www.voxie.com/"><img src="docs/sponsors/voxie.svg" width="150px" /></a>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
<a href="https://www.flagsmith.com/"><img src="docs/sponsors/flagsmith.png" height="50px" /></a>
</p>

<p align="center">
<a href="https://www.mybuilder.com/"><img src="docs/sponsors/mybuilder.svg" height="40px" /></a>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
<a href="https://optionmetrics.com/"><img src="docs/sponsors/optionmetrics.png" height="50px" /></a>
</p>

## How osls differs from upstream Serverless Framework

- The documentation is focused on the current osls release and AWS usage. Documentation for non-AWS providers has been removed.
- New AWS Lambda runtimes are kept up to date.
- osls is published as an npm package only. There is no standalone binary distribution.
- Internal AWS calls use AWS SDK for JavaScript v3 in osls v4, including support for IAM Identity Center credentials.
- Known inherited dependency vulnerabilities have been fixed.
- Serverless Dashboard, Enterprise, and Console features have been removed. If you rely on those hosted upstream services, use upstream Serverless Framework instead.
- Serverless Components support has been removed because those projects are old and unmaintained.
- The Tencent Cloud integration from the upstream `serverless` CLI has been removed.
- Unused dependencies, broken auto-updating, post-install messages, and automatic use of a local `serverless` installation from `node_modules` have been removed.
