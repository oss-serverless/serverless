# Upgrading from osls v3 to v4

osls v4 is a major release focused on internal upgrades and cleanup:

- **AWS SDK v3**: osls uses the AWS SDK under the hood to interact with AWS. osls v4 upgrades from the deprecated AWS SDK v2 to v3.
- **IAM Identity Center (AWS SSO) support**: Thanks to the upgrade to the AWS SDK v3, the `osls` CLI now supports AWS IAM Identity Center (aka SSO) credentials.

## osls vs Serverless Framework

This guide is for upgrading the **`osls`** CLI (`npm install osls`), not [Serverless Framework](https://github.com/serverless/serverless). Both projects use "v3" and "v4" version numbers, but they are **different projects**.

**History (osls v3):** osls v3 began as a fork of Serverless Framework v3. The repo was `oss-serverless/serverless` on GitHub and `osls` in npm. For clarity, the GitHub repo has been renamed to `oss-serverless/osls` to match.

**osls v4:** Continues the osls v3 line with its own roadmap and improvements. It is unrelated to Serverless Framework v4.

If you are coming from Serverless Framework v3, you can upgrade to osls v4 directly since osls v3 was based on Serverless Framework v3.

## Install osls v4

If you do not have Serverless Framework installed, install osls globally:

```bash
npm install -g osls@4
```

This makes the `osls`, `sls`, and `serverless` commands available.

If you are migrating from Serverless Framework, remove the upstream `serverless` package first so osls can take over the `serverless` command:

```bash
npm uninstall -g serverless   # remove upstream Serverless Framework, if installed
npm install -g osls@4         # provides the osls, sls, and serverless commands
serverless --version          # now resolves to osls
```

### Removed CLI commands

These commands were deprecated (and broken) in v3 and are removed in v4:

| Removed command | Replacement                                        |
| --------------- | -------------------------------------------------- |
| `sls upgrade`   | `npm install -g osls@4` (or the dist-tag you need) |
| `sls uninstall` | `npm uninstall -g osls`                            |

## Breaking changes

### Configuration validation defaults to `error`

In v4, invalid `serverless.yml` configuration **fails the command by default** (`configValidationMode: error`). In older v3 setups that never set this property, invalid configuration often surfaced only as warnings.

If you need the previous behavior while migrating:

```yaml
configValidationMode: warn
```

See [Configuration validation](./configuration-validation.md).

### Packaging: use `package.patterns` instead of `include` / `exclude`

`package.include` and `package.exclude` are no longer accepted. Use `package.patterns` instead. Prefix patterns with `!` to exclude.

**Before (v3):**

```yaml
package:
  include:
    - src/**
  exclude:
    - node_modules/**
```

**After (v4):**

```yaml
package:
  patterns:
    - src/**
    - '!node_modules/**'
```

The same applies to function- and layer-level `package` blocks. See [Packaging](./packaging.md#patterns).

### `variablesResolutionMode: 20210219` is rejected

The legacy variables resolver mode is no longer supported. Remove `variablesResolutionMode` from your configuration.

If you still have `variablesResolutionMode: 20210326`, it is accepted as a no-op in v4 but deprecated, remove it when convenient.

See [Variables](./variables.md) and [Deprecations](./deprecations.md).

### Serverless Console configuration is rejected

The `console` property in `serverless.yml` (legacy Serverless Dashboard configuration) is no longer accepted. You can safely remove it as `osls` is not compatible with Serverless Console or Dashboard.

### `provider.lambdaHashingVersion` removed

The `provider.lambdaHashingVersion` property and the old `20200924` hashing algorithm are removed. osls v4 always uses the current default hashing algorithm.

Remove `provider.lambdaHashingVersion` from your configuration. If you relied on the old algorithm, expect Lambda version identifiers to change on the next deployment (functions will be updated, not necessarily replaced). The companion deploy flag `--enforce-hash-update` is also removed. Remove it from any deploy scripts or CI, as it now errors as an unknown option.

### EventBridge: native CloudFormation only

The legacy EventBridge custom-resource implementation and `provider.eventBridge.useCloudFormation` are removed. EventBridge events are always provisioned with native CloudFormation resources.

Remove `provider.eventBridge.useCloudFormation` from your configuration.

If you previously relied on the legacy custom-resource path, migrate by:

1. Removing (or commenting out) EventBridge event definitions.
2. Running `serverless deploy` to remove the old resources.
3. Restoring the EventBridge events and deploying again.

See [EventBridge](../events/event-bridge.md).

### Alexa Skill events require a skill ID

The bare `alexaSkill` event (the keyword with no value) is no longer supported. Provide the skill ID either as a string (which is used as the app ID) or via the `appId` key:

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

### AWS SDK v2 removed (plugin authors)

osls no longer bundles AWS SDK for JavaScript v2. All built-in AWS calls use **AWS SDK v3** (`@aws-sdk/client-*` packages). For most users this is transparent.

Plugin authors are affected if they used the internal v2 surfaces, which are **removed** in v4 (calling them now throws):

- `provider.request(service, method, params, options)` — the generic v2 API proxy
- `provider.sdk` — the raw `aws-sdk` v2 module
- `provider.getCredentials()` / `provider.cachedCredentials`

Construct your own SDK v3 client and get osls-resolved client configuration (region, credentials, retry/proxy/CA) via `provider.getAwsSdkV3Config()`:

```js
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const client = new S3Client(await provider.getAwsSdkV3Config());
const result = await client.send(new ListBucketsCommand({}));
```

Declare any `@aws-sdk/client-*` packages your plugin imports in its own dependencies.

## Still deprecated in v4 (removed in 5.0.0)

These items still work in v4 but emit deprecation warnings. Clean them up when you can:

| Item                                 | Action                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `projectDir`                         | Remove, ignored                                                                         |
| `variablesResolutionMode: 20210326`  | Remove, no-op                                                                           |
| Top-level provider IAM settings      | Move under `provider.iam`, see below (still accepted, emits `PROVIDER_IAM_SETTINGS_V3`) |
| `provider.websocket.useProviderTags` | Remove, provider tags are applied by default                                            |
| `provider.httpApi.useProviderTags`   | Remove, provider tags are applied by default                                            |
| Kinesis consumer naming              | Set `provider.kinesis.consumerNamingMode: serviceSpecific` before 5.0.0                 |

### Group IAM settings under `provider.iam`

Top-level provider IAM properties are deprecated (`PROVIDER_IAM_SETTINGS_V3`) and still work in v4 — they emit a warning and are scheduled for removal in osls 5.0.0. Move them under `provider.iam`:

| Deprecated (top-level)             | Preferred (`provider.iam`)              |
| ---------------------------------- | --------------------------------------- |
| `provider.role`                    | `provider.iam.role`                     |
| `provider.rolePermissionsBoundary` | `provider.iam.role.permissionsBoundary` |
| `provider.iamRoleStatements`       | `provider.iam.role.statements`          |
| `provider.iamManagedPolicies`      | `provider.iam.role.managedPolicies`     |
| `provider.cfnRole`                 | `provider.iam.deploymentRole`           |

Use `provider.iam.role.permissionsBoundary`, which matches the CloudFormation property name. `provider.iam.role.permissionBoundary` is accepted as a deprecated alias. See the [IAM guide](./iam.md).

See [Deprecations](./deprecations.md).

## New in v4

- `provider.pruneFunctionVersions` — opt-in cleanup of old Lambda function and layer versions after a full `serverless deploy`, keeping the newest N. Replaces third-party version-pruning plugins. See [Functions](./functions.md).

## Getting help

- [Deprecations](./deprecations.md)
- [Configuration validation](./configuration-validation.md)
- [GitHub issues](https://github.com/oss-serverless/osls/issues/new)

If something in this guide is unclear or missing, open a GitHub pull request, contributions are welcome.
