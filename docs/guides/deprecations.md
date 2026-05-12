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

<a name="VARIABLES_RESOLUTION_MODE"><div>&nbsp;</div></a>

## Property `variablesResolutionMode`

Deprecation code: `VARIABLES_RESOLUTION_MODE`

Removal target: osls v5.0.0

In osls v4, `variablesResolutionMode: 20210326` is accepted as a deprecated no-op. The current variables resolver is always used, so you can safely remove this property from your configuration.

Learn more about configuration validation here: ./configuration-validation.md

<a name="PROJECT_DIR"><div>&nbsp;</div></a>

## Property `projectDir`

Deprecation code: `PROJECT_DIR`

Removal target: osls v5.0.0

The `projectDir` option is no longer used and is ignored. Drop it to avoid future validation errors. The `projectDir` property is scheduled for removal from accepted configuration in osls v5.0.0.

Learn more about configuration validation here: ./configuration-validation.md

<a name="AWS_WEBSOCKET_API_USE_PROVIDER_TAGS"><div>&nbsp;</div></a>

## Property `provider.websocket.useProviderTags`

Deprecation code: `AWS_WEBSOCKET_API_USE_PROVIDER_TAGS`

Removal target: osls v5.0.0

`provider.tags` are applied to Websocket Api Gateway by default. The `provider.websocket.useProviderTags` field is deprecated and scheduled for removal.

<a name="AWS_HTTP_API_USE_PROVIDER_TAGS_PROPERTY"><div>&nbsp;</div></a>

## Ineffective property `provider.httpApi.useProviderTags`

Deprecation code: `AWS_HTTP_API_USE_PROVIDER_TAGS_PROPERTY`

Removal target: osls v5.0.0

`provider.tags` are applied to Http Api Gateway by default. The `provider.httpApi.useProviderTags` field is deprecated and scheduled for removal in osls v5.0.0.

<a name="KINESIS_CONSUMER_NAME_CONTAINING_SERVICE"><div>&nbsp;</div></a>

## Kinesis consumer name will be changed to ensure more uniqueness

Deprecation code: `KINESIS_CONSUMER_NAME_CONTAINING_SERVICE`

Removal target: osls v5.0.0

In osls v5.0.0, Kinesis consumer names will include the service and stage to improve uniqueness. This will lead to downtime during re-deployment. Specifically, the naming pattern will change from `${functionName}${streamName}Consumer` to `${functionName}${streamName}${serviceName}${stage}Consumer`.

Adapt to this convention now by setting `provider.kinesis.consumerNamingMode` to `serviceSpecific` in your serverless.yml file.

The consequence for consumer name change is there will be some downtime during deployment between the time the old consumer is deleted and the new consumer is created. While no data is supposed to be lost, there may be a delay in consuming stream data.
