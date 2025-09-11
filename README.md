**The Serverless Framework** – Build applications on AWS Lambda and other next-gen cloud services, that auto-scale and only charge you when they run. This lowers the total cost of running and operating your apps, enabling you to build more and manage less.

The Serverless Framework is a command-line tool with an easy and approachable YAML syntax to deploy both your code and cloud infrastructure needed to make tons of serverless application use-cases. It's a multi-language framework that supports Node.js, Typescript, Python, Go, Java, and more.

---

This repository is a maintained alternative to [Serverless Framework](https://github.com/serverless/serverless) v3. It exists for those that cannot upgrade to Serverless Framework v4 and is a drop-in replacement for v3.

## Open-source sponsors

<p align="center">
<a href="https://www.voxie.com/"><img src="docs/sponsors/voxie.svg" width="150px" /></a>
&nbsp; &nbsp; &nbsp; &nbsp;
<a href="https://optionmetrics.com/"><img src="docs/sponsors/optionmetrics.png" width="300px" /></a>
&nbsp; &nbsp; &nbsp; &nbsp;
<a href="https://www.mybuilder.com/"><img src="docs/sponsors/mybuilder.svg" width="210px" /></a>
</p>

This project is open-source and free to use. However, maintaining it requires time and effort. If you want to support the project, you can become a sponsor on GitHub Sponsors.

## Installation

```sh
npm remove -g serverless
npm install -g osls

serverless --version
```

The repository has been created and is maintained by [Bref](https://bref.sh) maintainers and contributors. The main goal of this repository is to provide continuity for Bref users, so that these Bref projects keep working for the next 5 years. No major new features are planned. However, community contributions to keep the project running (even for languages other than PHP), like adding support to new runtime versions, adapting to AWS changes, bugfixes, and other small improvements are welcome.

## Changes

This repository contains the following differences with the original Serverless Framework v3:

- [Up-to-date documentation for v3](https://github.com/oss-serverless/serverless/tree/main/docs) (all documentation for non-AWS providers has been removed).
- Up-to-date support for new AWS Lambda runtimes.
- There is no standalone binary version, the package is only available via NPM.
- Fixed vulnerabilities in dependencies:
  - [micromatch](https://github.com/serverless/serverless/issues/12482)
  - [braces](https://github.com/serverless/serverless/issues/12481)
  - [tar](https://github.com/serverless/serverless/issues/12422)
- Lighter and faster CLI
  - Serverless Dashboard/Enterprise features are removed (because there is no guarantee to keep them working with v3), if you are using them you should upgrade to v4.
  - Serverless Components support have been removed: these are old and unmaintained projects, it's very unlikely you are using them. That improves the boot time of the CLI.
  - Serverless' integration for Tencent Cloud (China version of the `serverless` CLI) has been removed.
  - Removed unused dependencies.
  - Removed auto-updating (because it's not working anymore).
  - Removed automatic use of local `serverless` installation (in `node_modules`): this avoids surprises running the local `serverless` version instead of this fork.
  - Removed post-install messages.
- Fixed a node warning ("The `punycode` module is deprecated").

## Get Started

- [Setup](https://github.com/oss-serverless/serverless/tree/main/docs/getting-started.md)
- [Concepts](https://github.com/oss-serverless/serverless/tree/main/docs/guides/intro.md)
- [AWS Credentials](https://github.com/oss-serverless/serverless/tree/main/docs/guides/credentials.md)

## Usage

- [Deploying](https://github.com/oss-serverless/serverless/tree/main/docs/guides/deploying.md)
- [Packaging](https://github.com/oss-serverless/serverless/tree/main/docs/guides/packaging.md)
- [Testing](https://github.com/oss-serverless/serverless/tree/main/docs/guides/testing.md)
- [Services](https://github.com/oss-serverless/serverless/tree/main/docs/guides/services.md)
- [Functions](https://github.com/oss-serverless/serverless/tree/main/docs/guides/functions.md)
- [Layers](https://github.com/oss-serverless/serverless/tree/main/docs/guides/layers.md)
- [IAM Function Permissions](https://github.com/oss-serverless/serverless/tree/main/docs/guides/iam.md)
- [Parameters](https://github.com/oss-serverless/serverless/tree/main/docs/guides/parameters.md)
- [Variables](https://github.com/oss-serverless/serverless/tree/main/docs/guides/variables.md)
- [Resources](https://github.com/oss-serverless/serverless/tree/main/docs/guides/resources.md)
- [Composing services](https://github.com/oss-serverless/serverless/tree/main/docs/guides/compose.md)
- [Workflow Tips](https://github.com/oss-serverless/serverless/tree/main/docs/guides/workflow.md)
- [Serverless.yml Reference](https://github.com/oss-serverless/serverless/tree/main/docs/guides/serverless.yml.md)

# Function events

- [Overview](https://github.com/oss-serverless/serverless/tree/main/docs/guides/events.md)
- [HTTP (API Gateway v2)](https://github.com/oss-serverless/serverless/tree/main/docs/events/http-api.md)
- [REST (API Gateway v1)](https://github.com/oss-serverless/serverless/tree/main/docs/events/apigateway.md)
- [ActiveMQ](https://github.com/oss-serverless/serverless/tree/main/docs/events/activemq.md)
- [Application Load Balancer](https://github.com/oss-serverless/serverless/tree/main/docs/events/alb.md)
- [Alexa Skill](https://github.com/oss-serverless/serverless/tree/main/docs/events/alexa-skill.md)
- [Alexa Smart Home](https://github.com/oss-serverless/serverless/tree/main/docs/events/alexa-smart-home.md)
- [CloudWatch Event](https://github.com/oss-serverless/serverless/tree/main/docs/events/cloudwatch-event.md)
- [CloudWatch Log](https://github.com/oss-serverless/serverless/tree/main/docs/events/cloudwatch-log.md)
- [CloudFront](https://github.com/oss-serverless/serverless/tree/main/docs/events/cloudfront.md)
- [Cognito User Pool](https://github.com/oss-serverless/serverless/tree/main/docs/events/cognito-user-pool.md)
- [EventBridge Event](https://github.com/oss-serverless/serverless/tree/main/docs/events/event-bridge.md)
- [IoT](https://github.com/oss-serverless/serverless/tree/main/docs/events/iot.md)
- [IoT Fleet Provisioning](https://github.com/oss-serverless/serverless/tree/main/docs/events/iot-fleet-provisioning.md)
- [Kafka](https://github.com/oss-serverless/serverless/tree/main/docs/events/kafka.md)
- [Kinesis & DynamoDB](https://github.com/oss-serverless/serverless/tree/main/docs/events/streams.md)
- [MSK](https://github.com/oss-serverless/serverless/tree/main/docs/events/msk.md)
- [RabbitMQ](https://github.com/oss-serverless/serverless/tree/main/docs/events/rabbitmq.md)
- [S3](https://github.com/oss-serverless/serverless/tree/main/docs/events/s3.md)
- [Schedule](https://github.com/oss-serverless/serverless/tree/main/docs/events/schedule.md)
- [SNS](https://github.com/oss-serverless/serverless/tree/main/docs/events/sns.md)
- [SQS](https://github.com/oss-serverless/serverless/tree/main/docs/events/sqs.md)
- [Websocket](https://github.com/oss-serverless/serverless/tree/main/docs/events/websocket.md)

## CLI Reference

- [Overview](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference)
- [config credentials](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/config-credentials.md)
- [create](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/create.md)
- [install](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/install.md)
- [package](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/package.md)
- [deploy](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/deploy.md)
- [deploy function](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/deploy-function.md)
- [deploy list](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/deploy-list.md)
- [invoke](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/invoke.md)
- [invoke local](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/invoke-local.md)
- [logs](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/logs.md)
- [metrics](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/metrics.md)
- [info](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/info.md)
- [rollback](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/rollback.md)
- [rollback function](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/rollback-function.md)
- [remove](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/remove.md)
- [plugin list](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/plugin-list.md)
- [plugin search](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/plugin-search.md)
- [plugin install](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/plugin-install.md)
- [plugin uninstall](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/plugin-uninstall.md)
- [generate event](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/generate-event.md)
- [print](https://github.com/oss-serverless/serverless/tree/main/docs/cli-reference/print.md)

## Learn More

- [Upgrading to v3](https://github.com/oss-serverless/serverless/tree/main/docs/guides/upgrading-v3.md)
- [Configuration Validation](https://github.com/oss-serverless/serverless/tree/main/docs/guides/configuration-validation.md)
- [Resolution of Environment Variables](https://github.com/oss-serverless/serverless/tree/main/docs/guides/environment-variables.md)
- [Deprecations](https://github.com/oss-serverless/serverless/tree/main/docs/guides/deprecations.md)

## Creating Plugins

- [Overview](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/README.md)
- [Creating Plugins](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/creating-plugins.md)
  - [CLI Output](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/cli-output.md)
  - [Custom Commands](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/custom-commands.md)
  - [Custom Variables](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/custom-variables.md)
  - [Extending the Configuration schema](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/custom-configuration.md)
  - [Extending and overriding configuration](https://github.com/oss-serverless/serverless/tree/main/docs/guides/plugins/extending-configuration.md)
