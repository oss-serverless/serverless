# Upgrading from osls v3 to v4

osls 4.x is a major release focused on **modernizing the CLI**: a leaner dependency tree, AWS SDK for JavaScript v3 across the board, and stricter configuration validation.

This guide covers what's new, how to install 4.x, and the breaking changes to plan for when you upgrade from 3.x.

## What's in osls v4

- **AWS SDK v3**: osls uses the AWS SDK under the hood to interact with AWS. v4 upgrades from the deprecated AWS SDK v2 to v3.
- **IAM Identity Center (AWS SSO) support**: Thanks to the upgrade to the AWS SDK v3, the `osls` CLI now supports AWS IAM Identity Center (formerly AWS SSO) credentials.
- **Leaner dependencies**: the AWS SDK is upgraded and multiple dependencies are removed to minimize supply chain risks.

Several 3.x options and commands were deprecated for a long time; 4.x removes them in favor of these foundations. The [breaking changes](#breaking-changes) section is your migration checklist.

## osls vs Serverless Framework

This guide is for upgrading the **`osls`** CLI (`npm install osls`), not [Serverless Framework](https://github.com/serverless/serverless). Both projects use "v3" and "v4" version numbers, but they are **different projects**.

**History (osls 3.x):** osls 3.x began as a fork of Serverless Framework v3. The repo was `oss-serverless/serverless` on GitHub and `osls` in npm. For clarity, the GitHub repo has been renamed to `oss-serverless/osls` to match.

**osls 4.x:** Continues the osls 3.x line with its own roadmap and improvements. It is unrelated to Serverless Framework v4.

If you are coming from Serverless Framework v3, you can upgrade to osls 4.x directly since osls 3.x was based on Serverless Framework v3.

## Install osls 4.x

osls is distributed on npm only (there is no standalone binary).

```bash
npm install -g osls@4
```

Verify the installed version:

```bash
serverless --version
```

### Removed CLI commands

These commands were deprecated (and broken) in 3.x and are removed in 4.x:

| Removed command | Replacement                                        |
|-----------------|----------------------------------------------------|
| `sls upgrade`   | `npm install -g osls@4` (or the dist-tag you need) |
| `sls uninstall` | `npm uninstall -g osls`                            |

## Breaking changes

### Configuration validation defaults to `error`

In 4.x, invalid `serverless.yml` configuration **fails the command by default** (`configValidationMode: error`). In older 3.x setups that never set this property, invalid configuration often surfaced only as warnings.

If you need the previous behavior while migrating:

```yaml
configValidationMode: warn
```

See [Configuration validation](./configuration-validation.md).

### IAM settings must use `provider.iam`

Top-level provider IAM properties were deprecated in 3.x and are **removed** in 4.x. Move them under `provider.iam`:

| 3.x (removed)                      | 4.x                                     |
|------------------------------------|-----------------------------------------|
| `provider.role`                    | `provider.iam.role`                     |
| `provider.rolePermissionsBoundary` | `provider.iam.role.permissionsBoundary` |
| `provider.iamRoleStatements`       | `provider.iam.role.statements`          |
| `provider.iamManagedPolicies`      | `provider.iam.role.managedPolicies`     |
| `provider.cfnRole`                 | `provider.iam.deploymentRole`           |

`provider.iam.role.permissionsBoundary` is also accepted (CloudFormation naming).

See the [IAM guide](./iam.md).

### Packaging: use `package.patterns` instead of `include` / `exclude`

`package.include` and `package.exclude` are no longer accepted. Use `package.patterns` instead. Prefix patterns with `!` to exclude.

**Before (3.x):**

```yaml
package:
  include:
    - src/**
  exclude:
    - node_modules/**
```

**After (4.x):**

```yaml
package:
  patterns:
    - src/**
    - '!node_modules/**'
```

The same applies to function- and layer-level `package` blocks. See [Packaging](./packaging.md#patterns).

### `variablesResolutionMode: 20210219` is rejected

The legacy variables resolver mode is no longer supported. Remove `variablesResolutionMode` from your configuration.

If you still have `variablesResolutionMode: 20210326`, it is accepted as a no-op in 4.x but deprecated, remove it when convenient.

See [Variables](./variables.md) and [Deprecations](./deprecations.md).

### Serverless Console configuration is rejected

The `console` property in `serverless.yml` (legacy Serverless Dashboard configuration) is no longer accepted. You can safely remove it as `osls` is not compatible with Serverless Console or Dashboard.

### `provider.lambdaHashingVersion` removed

The `provider.lambdaHashingVersion` property and the old `20200924` hashing algorithm are removed. osls 4.x always uses the current default hashing algorithm.

Remove `provider.lambdaHashingVersion` from your configuration. If you relied on the old algorithm, expect Lambda version identifiers to change on the next deployment (functions will be updated, not necessarily replaced).

### EventBridge: native CloudFormation only

The legacy EventBridge custom-resource implementation and `provider.eventBridge.useCloudFormation` are removed. EventBridge events are always provisioned with native CloudFormation resources.

Remove `provider.eventBridge.useCloudFormation` from your configuration.

If you previously relied on the legacy custom-resource path, migrate by:

1. Removing (or commenting out) EventBridge event definitions.
2. Running `sls deploy` to remove the old resources.
3. Restoring the EventBridge events and deploying again.

See [EventBridge](../events/event-bridge.md).

### Alexa Skill events require an application ID

The bare `alexaSkill` event form without an `appId` is no longer supported. Use one of:

```yaml
events:
  - alexaSkill: amzn1.ask.skill.xx-xx-xx-xx
```

```yaml
events:
  - alexaSkill:
      appId: amzn1.ask.skill.xx-xx-xx-xx
```

See [Alexa Skill](../events/alexa-skill.md).

### Plugin custom variables: `configurationVariablesSources` only

Plugins that extend variable resolution via the old `variableResolvers` API will fail with `OLD_VARIABLE_RESOLVER_NOT_SUPPORTED`. Migrate to `configurationVariablesSources`.

See [Custom variables](./plugins/custom-variables.md).

### Plugin CLI options must declare a `type`

Plugin command options must define `type` as `string`, `boolean`, or `multiple`. Options without a `type` cause `INVALID_CLI_OPTIONS_SCHEMA`.

See [Custom commands](./plugins/custom-commands.md#command-options).

### AWS SDK v2 removed from osls

osls no longer bundles AWS SDK for JavaScript v2. All built-in AWS calls use **AWS SDK v3** (`@aws-sdk/client-*` packages).

For most users this is transparent. **Plugin authors** that imported `aws-sdk` from osls internals or assumed v2 behavior must migrate their plugins to AWS SDK v3.

### Internal AWS client changes (plugin authors)

If your plugin uses osls AWS client helpers, verify behavior against 4.x: request/response shapes follow SDK v3 conventions (for example command input objects and async clients).

## Still deprecated in 4.x (removed in 5.0.0)

These items still work in 4.x but emit deprecation warnings. Clean them up when you can:

| Item                                 | Action                                                                  |
|--------------------------------------|-------------------------------------------------------------------------|
| `projectDir`                         | Remove, ignored                                                         |
| `variablesResolutionMode: 20210326`  | Remove, no-op                                                           |
| `provider.websocket.useProviderTags` | Remove, provider tags are applied by default                            |
| `provider.httpApi.useProviderTags`   | Remove, provider tags are applied by default                            |
| Kinesis consumer naming              | Set `provider.kinesis.consumerNamingMode: serviceSpecific` before 5.0.0 |

See [Deprecations](./deprecations.md).

## Getting help

- [Deprecations](./deprecations.md)
- [Configuration validation](./configuration-validation.md)
- [GitHub issues](https://github.com/oss-serverless/osls/issues/new)

If something in this guide is unclear or missing, open a GitHub pull request, contributions are welcome.
