# Upgrading from osls v3 to v4

osls v4 is a major release with internal upgrades and new capabilities:

- **AWS SDK v3**: osls uses the AWS SDK under the hood to interact with AWS. osls v4 upgrades from the deprecated AWS SDK v2 to v3.
- **IAM Identity Center (AWS SSO) support**: Thanks to the upgrade to the AWS SDK v3, the `osls` CLI now supports AWS IAM Identity Center (aka SSO) credentials.
- **Lambda version pruning**: Opt-in cleanup of old Lambda function and layer versions after each full deploy via `provider.pruneFunctionVersions`.
- **AWS Lambda Durable Functions**: Configure `functions[].durableConfig` and osls publishes a function version, generates a `durable` alias that event targets invoke through, and adds the required IAM permissions.

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

### Layer paths are validated

`layers.<name>.path` values containing newline, carriage return, or NUL characters are now rejected with an `INVALID_LAYER_PATH` error during packaging and Docker-based local invocation. Such paths never worked correctly and could corrupt the Dockerfile that `invoke local --docker` generates. No action is needed for any real layer path.

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

### `logs` and `metrics` time options are parsed strictly

The `--startTime` option of `serverless logs` and the `--startTime` / `--endTime` options of `serverless metrics` are now parsed by a single strict parser:

- Unix epoch values (e.g. `1469694264`) now work in both commands; they were documented but broken (in `logs` they silently produced a wrong time range, in `metrics` they failed). Digits-only values of 9+ characters are parsed as epoch seconds, or as epoch milliseconds when at or above `10^12` (13+ characters).
- Dates and datetimes without an explicit UTC offset are now consistently interpreted as **UTC** in both commands. Previously `metrics` interpreted datetimes (e.g. `2016-07-01T10:00`) in the machine's local time zone.
- Malformed values now fail with an `INVALID_TIME_INPUT` error instead of being silently misparsed. For example, `--startTime 1h30m` previously subtracted 130 _milliseconds_, and ISO week dates (`2013-W06-5`) and ordinal dates (`2013-039`) produced wrong time ranges. Week and ordinal dates are no longer supported.
- Relative values now also accept seconds (e.g. `30s`), and `metrics --endTime` accepts relative values too.

See [logs](../cli-reference/logs.md) and [metrics](../cli-reference/metrics.md) for the supported formats. As part of this change, osls no longer depends on the [`dayjs`](https://www.npmjs.com/package/dayjs) package; plugins that relied on it being installed alongside osls should declare it in their own dependencies.

### AWS credential resolution changes

osls v3 resolved AWS credentials through AWS SDK v2, which reads `~/.aws/config` only when `AWS_SDK_LOAD_CONFIG` is set (osls never set it). osls v4 resolves credentials with standard AWS SDK v3 semantics, matching the AWS CLI and other modern AWS tools: `~/.aws/config` is **always merged** into same-named profiles from `~/.aws/credentials`. This changes behavior for several profile layouts:

- **Your deploy identity can change.** If a profile has static keys in the credentials file and a same-named section with `role_arn` and `source_profile` in the config file, v3 used the static keys directly; v4 performs AssumeRole and runs under the role, potentially in a **different AWS account**. osls logs a warning when it detects this layout. To keep the previous identity, remove or rename the config-file section, or point osls at a dedicated profile.
- **`mfa_serial` is now honored.** Profiles configured with `mfa_serial` trigger an interactive MFA prompt. In non-interactive environments (such as CI) the prompt fails fast with `MFA_CODE_UNAVAILABLE` instead of waiting for input.
- **`role_arn` with `credential_source = Ec2InstanceMetadata`** now attempts the EC2 instance metadata service as configured. On machines outside EC2 this fails with a timeout, even if the credentials file also contains static keys for that profile.
- **IAM Identity Center (SSO), `credential_process`, and web identity profiles are now supported.** These were ignored or unsupported in v3. The HTTP calls they make honor the same proxy, custom CA, and timeout configuration as all other AWS requests.
- **`AWS_DEFAULT_PROFILE`** pointing at a profile that exists in neither shared file logs a warning and falls back to the SDK default provider chain (environment variables, ECS/EC2 instance credentials). v3 skipped it silently.
- **Credentials resolve once per command** and are shared by all AWS clients, so a deploy triggers at most one MFA prompt, one AssumeRole call, or one `credential_process` invocation. Temporary credentials refresh automatically as they approach expiry.
- **`invoke local`** now materializes the fully resolved credentials (including SSO, assume-role, and `credential_process` profiles) into the invoked function's environment. `AWS_PROFILE` and `AWS_DEFAULT_PROFILE` are removed from that environment when resolved keys are injected, unless you set them explicitly via `provider.environment`.

### AWS request behavior changes

All AWS requests now go through AWS SDK v3, which changes retry, concurrency, timeout, and endpoint behavior:

- **Retries.** v3 layered a general retry loop on top of AWS SDK v2's retries; v4 uses the SDK v3 `standard` retry mode per request, plus targeted framework-level retries where the SDK budget is not enough: sustained throttling during CloudFormation polling and artifact uploads, and transient network failures while reading S3 response bodies. `SLS_AWS_REQUEST_MAX_RETRIES` still works and sets the SDK retry count: total attempts are the value plus one (default: 4 retries, 5 attempts). Setting it to `0` now disables the SDK retries entirely, where v3 still performed SDK-level retries.
- **Error codes.** AWS failures no longer carry v3's uniform `AWS_<SERVICE>_<METHOD>_<CODE>` error codes. Commands now report context-specific codes or, for unhandled AWS service errors, a code synthesized from the AWS error name (for example `AWS_ACCESS_DENIED`). Update CI scripts or tooling that match on error codes in CLI output.
- **Proxy and certificates.** The proxy (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) and custom certificate authority (`ca`, `cafile`) environment variables now apply to all HTTP requests osls makes — including template, plugin registry, layer, and rollback code downloads — where v3 honored them only for AWS calls. See [Running behind a proxy](./credentials.md#running-behind-a-proxy).
- **Concurrency.** v3 funneled all AWS requests through a global queue of 2 concurrent requests; v4 has no global cap, so commands issue more requests in parallel and complete faster. Flow-specific limits such as `SLS_MAX_CONCURRENT_ARTIFACTS_UPLOADS` still apply.
- **Timeouts.** `AWS_CLIENT_TIMEOUT` (milliseconds) is enforced as a socket inactivity timeout and defaults to 120 seconds.
- **S3 checksums.** Uploads send CRC32 flexible checksums instead of `Content-MD5`. If you deploy to an S3-compatible endpoint that rejects them, set `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED`.
- **STS endpoints.** Security Token Service calls now use the regional endpoint (`sts.<region>.amazonaws.com`) instead of the global one, and `AWS_STS_REGIONAL_ENDPOINTS` is ignored. If your network egress rules pin `sts.amazonaws.com`, allow the regional endpoints or set `AWS_ENDPOINT_URL_STS=https://sts.amazonaws.com`.
- **Endpoint overrides are now honored.** `AWS_ENDPOINT_URL`, `AWS_ENDPOINT_URL_<SERVICE>`, and the profile `endpoint_url` setting apply to every AWS call osls makes. This enables LocalStack-style workflows without plugins, but also means a leftover `AWS_ENDPOINT_URL` export in your shell silently redirects real deploys, so check your environment if requests go somewhere unexpected.

### YAML parser external `$ref` resolution is restricted by default (plugin authors)

Plugins that call `serverless.yamlParser.parse(filePath)` to parse additional YAML files now get restricted external `$ref` loading by default. File references are limited to the parsed document's directory, and HTTP references to local, private, link-local, reserved, multicast, metadata, and internal hosts are blocked. Blocked references fail with `YAML_REF_ACCESS_DENIED`.

These options are controlled by the plugin or other code that calls `serverless.yamlParser.parse()`, not by `serverless.yml`. If an end user sees this error, the plugin needs to pass explicit `externalRefs` options, or the project needs to stay on osls v3 until the plugin is updated.

**Before (v3):**

```js
const schema = await this.serverless.yamlParser.parse('schema.yml');
```

**After (v4, trusted input):**

```js
const schema = await this.serverless.yamlParser.parse('schema.yml', {
  externalRefs: {
    file: {
      allowedRoots: null,
    },
    http: {
      allowUnsafeUrls: true,
    },
  },
});
```

The option containers must be objects. `externalRefs: null`, `externalRefs.file: null`, and `externalRefs.http: null` now fail with `YAML_REF_OPTIONS_ERROR`; omit them to use the v4 defaults. `externalRefs.file.allowedRoots: null` remains the explicit unrestricted-file opt-out.

See [Parsing YAML files](./plugins/creating-plugins.md#parsing-yaml-files).

### Plugin custom variables: `configurationVariablesSources` only

Plugins that extend variable resolution via the old `variableResolvers` API will fail with `OLD_VARIABLE_RESOLVER_NOT_SUPPORTED`. Migrate to `configurationVariablesSources`.

See [Custom variables](./plugins/custom-variables.md).

### Plugin CLI options must declare a `type`

Plugin command options must define `type` as `string`, `boolean`, or `multiple`. Options without a `type` cause `INVALID_CLI_OPTIONS_SCHEMA`.

See [Custom commands](./plugins/custom-commands.md#command-options).

### AWS SDK v2 removed (plugin authors)

osls no longer bundles AWS SDK for JavaScript v2. All built-in AWS calls use **AWS SDK v3** (`@aws-sdk/client-*` packages). For most users this is transparent.

Plugin authors are affected if they used the internal v2 surfaces, which are **removed** in v4 (calling them now throws a `ServerlessError` with code `AWS_SDK_V2_SURFACE_REMOVED`):

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

See [AWS plugins](./plugins/creating-plugins.md#aws-plugins) for the full plugin-facing AWS API. The [credential resolution changes](#aws-credential-resolution-changes) above apply to plugin-created clients as well.

### Bundled `open` and `punycode` packages removed (plugin authors)

- The internal `lib/utils/open-browser.js` module is removed, along with the [`open`](https://www.npmjs.com/package/open) package it wrapped. It was unused by osls and never part of the public plugin API. If your plugin deep-required it, depend on `open` directly.
- osls no longer ships the userland [`punycode`](https://www.npmjs.com/package/punycode) package, and no longer aliases `require('punycode')` to it. Code that requires `punycode` now gets the deprecated Node.js builtin, which prints a `DEP0040` deprecation warning on Node.js 22+. If your plugin (or its dependencies) needs punycode, declare the userland package in its dependencies and require it as `punycode/` (with the trailing slash) so it takes precedence over the builtin.

The `@serverless/utils/config` and `@serverless/utils/log` compatibility aliases are unaffected.

## Deprecated in v4 (clean up before v5)

These still work in v4 but emit deprecation warnings. Most were deprecated back in v3, with removal deferred to v5. `provider.websocket.useProviderTags` is the exception, as it became redundant only in v4 once provider tags became the default. All will be removed in v5 except the Kinesis consumer name, which will change rather than being removed.

| Item                                 | Deprecated since | Action                                                                                             |
| ------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| `projectDir`                         | v3               | Remove, ignored                                                                                    |
| `variablesResolutionMode: 20210326`  | v3               | Remove, no-op (`20210219` is rejected in v4)                                                       |
| Top-level provider IAM settings      | v3               | Move under `provider.iam`, see below (still accepted, emits `PROVIDER_IAM_SETTINGS_V3`)            |
| `provider.websocket.useProviderTags` | v4               | Remove, now redundant as provider tags are applied by default                                      |
| `provider.httpApi.useProviderTags`   | v3               | Remove, ineffective since v3 as provider tags are applied by default                               |
| Kinesis consumer naming              | v3               | Set `provider.kinesis.consumerNamingMode: serviceSpecific` now to prepare for the v5 naming change |

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
- `functions[].durableConfig` — AWS Lambda Durable Functions support: osls publishes a function version, generates a `durable` alias that event targets and Lambda Function URLs invoke through, and adds the required durable execution IAM permissions. Invoke durable executions with `serverless invoke --qualifier durable --durable-execution-name <name>`. See [AWS Lambda Durable Functions](./functions.md#aws-lambda-durable-functions).

## Getting help

- [Deprecations](./deprecations.md)
- [Configuration validation](./configuration-validation.md)
- [GitHub issues](https://github.com/oss-serverless/osls/issues/new)

If something in this guide is unclear or missing, open a GitHub pull request, contributions are welcome.
