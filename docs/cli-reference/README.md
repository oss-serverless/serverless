# CLI Reference

`osls` (also invokable as `serverless` or `sls`) is the command-line interface for building, deploying, and operating your serverless services on AWS. This page indexes every command, grouped by purpose, with a short description and a link to its full reference. See [Common Options](#common-options) below for the global flags that apply across most commands.

Run any command with `--help` (or `-h`) to print its usage and options, and `osls --help` for the top-level command list.

## Deploy & lifecycle

Commands that build, ship, roll back, and tear down your service.

- [`package`](./package.md) — Package your service into deployment artifacts without deploying.
- [`deploy`](./deploy.md) — Deploy your entire service to AWS via CloudFormation.
- [`deploy function`](./deploy-function.md) — Quickly deploy a single function's code or configuration without a full stack update.
- [`rollback`](./rollback.md) — Roll the service back to a previous deployment.
- [`rollback function`](./rollback-function.md) — Roll a single function back to a previous version.
- [`remove`](./remove.md) — Remove the deployed service and all of its AWS resources.

## Inspect

Commands that show information about a deployed service, invoke functions, and read configuration.

- [`info`](./info.md) — Display information about the deployed service (endpoints, functions, resources).
- [`invoke`](./invoke.md) — Invoke a deployed function and view its result.
- [`invoke local`](./invoke-local.md) — Invoke a function locally on your machine for fast iteration.
- [`logs`](./logs.md) — Output (and optionally tail) the CloudWatch logs of a deployed function.
- [`metrics`](./metrics.md) — Show CloudWatch metrics for the service or a specific function.
- [`print`](./print.md) — Print your compiled and variable-resolved configuration.
- [`deploy list`](./deploy-list.md) — List existing deployments of your service; `deploy list functions` lists deployed functions and their versions.

## Scaffold

Commands that create new services and generate sample data.

- [`create`](./create.md) — Create a new service from a template (local, built-in, or remote URL).
- [`install`](./install.md) — Install a service from a remote Git URL into a new directory.
- [`generate-event`](./generate-event.md) — Generate a sample event payload for local testing (e.g. `aws:apiGateway`, `aws:sns`, `aws:sqs`).

## Plugins

Commands for discovering and managing plugins. (`plugin` is a namespace; always run it with one of the subcommands below.)

- [`plugin list`](./plugin-list.md) — List all available plugins.
- [`plugin search`](./plugin-search.md) — Search for plugins by query.
- [`plugin install`](./plugin-install.md) — Install a plugin and add it to your service.
- [`plugin uninstall`](./plugin-uninstall.md) — Uninstall a plugin and remove it from your service.

## Config & health

Commands for provider credentials and diagnostics.

- [`config credentials`](./config-credentials.md) — Configure a provider profile (e.g. AWS access key and secret) for `osls`.
- [`doctor`](./doctor.md) — Print the status of any deprecations triggered during the last command run. (Run `osls doctor`.)

## Common Options

The following options are available across commands. Their availability depends on the command type: global options work everywhere, service options apply to commands that load `serverless.yml`, and AWS options apply to commands that talk to AWS.

| Option          | Shortcut | Scope            | Description                                                                                             |
| --------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `--config`      | `-c`     | Service commands | Path to the serverless configuration file, if other than `serverless.yml\|.yaml\|.js\|.json`.           |
| `--stage`       | `-s`     | Service commands | Stage of the service to target (e.g. `dev`, `prod`).                                                    |
| `--param`       | _(none)_ | Service commands | Pass custom parameter values for the `param` variable source. Usage: `--param="key=value"`; repeatable. |
| `--region`      | `-r`     | AWS commands     | AWS region of the service.                                                                              |
| `--aws-profile` | _(none)_ | AWS commands     | AWS credentials profile to use for the command.                                                         |
| `--verbose`     | _(none)_ | Global           | Show verbose logs.                                                                                      |
| `--debug`       | _(none)_ | Global           | Namespace of debug logs to expose (use `"*"` to display all).                                           |
| `--help`        | `-h`     | Global           | Show help for the command (or general help when run alone).                                             |
| `--version`     | `-v`     | Global           | Show version info.                                                                                      |

Notes:

- Boolean flags can be negated where supported (e.g. `--no-aws-s3-accelerate` on `deploy`).
- Service-scoped options (`--config`, `--stage`, `--param`) and AWS-scoped options (`--region`, `--aws-profile`) are only meaningful for commands that operate on a service or against AWS; the global options apply to every command.
- Each command page lists its own additional options.
