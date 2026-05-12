# osls Deprecations

## How to disable a specific deprecation

To disable a deprecation, use the `SLS_DEPRECATION_DISABLE=CODE` environment variable. You can disable multiple deprecations via `SLS_DEPRECATION_DISABLE=CODE1,CODE2` or disable them all via `SLS_DEPRECATION_DISABLE=*`.

Alternatively, you can set `disabledDeprecations` in `serverless.yml`:

```yml
service: myService
disabledDeprecations:
  - CODE_1 # To disable specific deprecation with code "CODE_1"
  - '*' # To disable all deprecation messages
```

## Notification mode

By default, deprecations are logged after the command finalizes with a warning summary.

This notification mode can be changed via the `SLS_DEPRECATION_NOTIFICATION_MODE=error` environment variable or via `serverless.yml`:

```yaml
deprecationNotificationMode: error
```

The `error` mode turns all deprecations into strict errors, the `warn` mode displays deprecations as they're discovered.

Note:

- The `serverless.yml` setting is ineffective for deprecations reported before the configuration is read.
- `SLS_DEPRECATION_DISABLE` and `disabledDeprecations` remain respected, and no errors will be thrown for mentioned deprecation codes.

<a name="STANDALONE_UPGRADE_COMMAND_DEPRECATED"><div>&nbsp;</div></a>

## Command `sls upgrade`

Deprecation code: `STANDALONE_UPGRADE_COMMAND_DEPRECATED`

Removal target: osls v4.0.0

The standalone `sls upgrade` command no longer updates osls and is scheduled for removal in osls v4.0.0. Use npm to upgrade osls instead:

```sh
npm install -g osls@latest
```

<a name="CONSOLE_CONFIGURATION"><div>&nbsp;</div></a>

## Property `console`

Deprecation code: `CONSOLE_CONFIGURATION`

Removal target: osls v4.0.0

Starting with v3.24.0, osls no longer recognizes inner `console` configuration. All Serverless Console related configuration is expected to be maintained at https://console.serverless.com. The `console` property is scheduled for removal from accepted configuration in osls v4.0.0.

Learn more about configuration validation here: ./configuration-validation.md

<a name="VARIABLES_RESOLUTION_MODE"><div>&nbsp;</div></a>

## Property `variablesResolutionMode`

Deprecation code: `VARIABLES_RESOLUTION_MODE`

Removal targets: `20210219` mode in osls v4.0.0; property in osls v5.0.0

Starting with v3.0.0, `variablesResolutionMode` is no longer effective because the new variables resolver is used by default. Drop it to avoid future validation errors.

The old `variablesResolutionMode: 20210219` mode is scheduled to be rejected in osls v4.0.0. The `variablesResolutionMode` property itself, including the no-op `20210326` value, is scheduled for removal from accepted configuration in osls v5.0.0.

Learn more about configuration validation here: ./configuration-validation.md

<a name="PROJECT_DIR"><div>&nbsp;</div></a>

## Property `projectDir`

Deprecation code: `PROJECT_DIR`

Removal target: osls v5.0.0

The `projectDir` option is no longer used and is ignored. Drop it to avoid future validation errors. The `projectDir` property is scheduled for removal from accepted configuration in osls v5.0.0.

Learn more about configuration validation here: ./configuration-validation.md

<a name="CLI_OPTIONS_SCHEMA_V3"><div>&nbsp;</div></a>

## CLI Options extensions, `type` requirement

Deprecation code: `CLI_OPTIONS_SCHEMA_V3`

Removal target: osls v4.0.0

Internal handling of CLI arguments was improved with type awareness for options. Now each option definition is expected have `type` defined in its settings.

Possible values are `string`, `boolean` and `multiple`. Check [Defining options](./plugins#defining-options) documentation for more info.

If you rely on a plugin which does not set types (yet) please report the issue at its issue tracker.

Starting with osls v4.0.0, option extensions that do not have `type` defined will be communicated with a thrown error.

<a name="PROVIDER_IAM_SETTINGS_V3"><div>&nbsp;</div></a>

## Grouping IAM settings under `provider.iam`

Deprecation code: `PROVIDER_IAM_SETTINGS_V3`

Removal target: osls v4.0.0

All IAM-related settings of _provider_ including `iamRoleStatements`, `iamManagedPolicies`, `role` and `cfnRole` are also now supported at `iam` property. Refer to the [IAM Guide](./iam.md).

- `provider.role` -> `provider.iam.role`
- `provider.rolePermissionsBoundary` -> `provider.iam.role.permissionsBoundary`
- `provider.iamRoleStatements` -> `provider.iam.role.statements`
- `provider.iamManagedPolicies` -> `provider.iam.role.managedPolicies`
- `provider.cfnRole` -> `provider.iam.deploymentRole`

In addition `iam.role.permissionBoundary` can also be set at `iam.role.permissionsBoundary` (which matches CloudFormation property name).

Starting with osls v4.0.0, the old settings will no longer be supported.

<a name="CONFIG_VALIDATION_MODE_DEFAULT_V3"><div>&nbsp;</div></a>

## `configValidationMode: error` will be new default

Deprecation code: `CONFIG_VALIDATION_MODE_DEFAULT_V3`

Removal target: osls v4.0.0

Starting with osls v4.0.0, configuration errors are thrown by default. This is changing from the previous default, `configValidationMode: warn`.

Learn more about configuration validation here: ./configuration-validation.md

<a name="PACKAGE_PATTERNS"><div>&nbsp;</div></a>

## New way to define packaging patterns

Deprecation code: `PACKAGE_PATTERNS`

Removal target: osls v4.0.0

Support for `package.include` and `package.exclude` is scheduled for removal in osls v4.0.0. Instead please use `package.patterns` with which both _include_ and _exclude_ (prefixed with `!`) rules can be configured.

Check [Packaging Patterns](./packaging.md#patterns) documentation for more info.

<a name="AWS_WEBSOCKET_API_USE_PROVIDER_TAGS"><div>&nbsp;</div></a>

## Property `provider.websocket.useProviderTags`

Deprecation code: `AWS_WEBSOCKET_API_USE_PROVIDER_TAGS`

Behavior change target: osls v4.0.0; field removal target: osls v5.0.0

Starting with osls v4.0.0, `provider.tags` will be applied to Websocket Api Gateway by default.
Set `provider.websocket.useProviderTags` to `true` in v3 to adapt to the new behavior now. Starting with osls v4.0.0, this field will be deprecated and scheduled for removal in osls v5.0.0.

<a name="LAMBDA_HASHING_VERSION_PROPERTY"><div>&nbsp;</div></a>

## Property `provider.lambdaHashingVersion`

Deprecation code: `LAMBDA_HASHING_VERSION_PROPERTY`

Removal target: osls v4.0.0

Lambda version hashes were improved with a better algorithm (that fixed determinism issues). It is used by default starting with v3.0.0.

If you previously opted-in to use the new algorithm by setting `provider.lambdaHashingVersion: 20201221`, you can safely remove that property from your configuration in v3. The `provider.lambdaHashingVersion` property and old `20200924` hashing path are scheduled for removal in osls v4.0.0.

<a name="AWS_EVENT_BRIDGE_CUSTOM_RESOURCE_LEGACY_OPT_IN"><div>&nbsp;</div></a>

## AWS EventBridge lambda event triggers based on Custom Resources

Deprecation code: `AWS_EVENT_BRIDGE_CUSTOM_RESOURCE_LEGACY_OPT_IN`

Removal target: osls v4.0.0

Support for provisioning AWS EventBridge resources without native CloudFormation resources is deprecated and will no longer be maintained. The custom resource path and `provider.eventBridge.useCloudFormation` compatibility setting are scheduled for removal in osls v4.0.0.

If you want to upgrade to native CloudFormation, remove `provider.eventBridge.useCloudFormation` from your configuration. If you are currently using `provider.eventBridge.useCloudFormation` set to `true` to enable native CloudFormation, you can safely remove this setting from your configuration.

Note that to migrate away from the legacy behavior, you will need to remove (or comment) EventBridge triggers, deploy, re-add them and re-deploy in order to migrate from the legacy behavior.

<a name="AWS_HTTP_API_USE_PROVIDER_TAGS_PROPERTY"><div>&nbsp;</div></a>

## Ineffective property `provider.httpApi.useProviderTags`

Deprecation code: `AWS_HTTP_API_USE_PROVIDER_TAGS_PROPERTY`

Removal target: osls v5.0.0

Starting with v3.0.0, property `provider.httpApi.useProviderTags` is no longer effective as provider tags are applied to Http Api Gateway by default. You can safely remove this property from your configuration. The property is scheduled for removal in osls v5.0.0.

<a name="NEW_VARIABLES_RESOLVER"><div>&nbsp;</div></a>

## New variables resolver

Deprecation code: `NEW_VARIABLES_RESOLVER`

Removal target: osls v4.0.0

A more robust and powerful variable resolver engine was introduced (disabled by default) in Serverless Framework v2. It is used by default in v3.

It supports the same variables with the same syntax. The main impacts are:

- Some edge cases (ambiguous configuration) now throw errors
- A very small share of unmaintained plugins haven't been updated to support the new engine

You can prepare the upgrade from v2 to v3 by enabling the new engine:

```yaml
# serverless.yml
service: myapp
variablesResolutionMode: 20210326
```

In v3, the `variablesResolutionMode` option can be removed as the new engine becomes the default.

Plugins that extend variables resolution must use `configurationVariablesSources`. The old `variableResolvers` extension path is scheduled for removal in osls v4.0.0.

<a name="KINESIS_CONSUMER_NAME_CONTAINING_SERVICE"><div>&nbsp;</div></a>

## Kinesis consumer name will be changed to ensure more uniqueness

Deprecation code: `KINESIS_CONSUMER_NAME_CONTAINING_SERVICE`

Removal target: osls v5.0.0

Starting with osls v5.0.0, Kinesis consumer name will be changed. This will lead to downtime during re-deployment. Specifically, the naming pattern will be changed from `${functionName}${streamName}Consumer` to `${functionName}${streamName}${serviceName}${stage}Consumer`.

Adapt to this convention now by setting `provider.kinesis.consumerNamingMode` to `serviceSpecific` in your serverless.yml file.

The consequence for consumer name change is there will be some downtime during deployment between the time the old consumer is deleted and the new consumer is created. While no data is supposed to be lost, there may be a delay in consuming stream data.

<a name="ALEXA_SKILL_EVENT_WITHOUT_APP_ID"><div>&nbsp;</div></a>

## Support for `alexaSkill` event without `appId` is to be removed

Deprecation code: `ALEXA_SKILL_EVENT_WITHOUT_APP_ID`

Removal target: osls v4.0.0

Starting with osls v4.0.0, support for the bare `alexaSkill` event form without `appId` provided will be removed. Use `alexaSkill: <appId>` or the object form with `appId` instead.
