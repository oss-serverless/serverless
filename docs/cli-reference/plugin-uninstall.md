# Plugin Uninstall

Uninstall an osls plugin and remove it from the services `plugins` array.

```bash
serverless plugin uninstall --name pluginName
```

## Options

- `--name` or `-n` The plugins name. **Required**.

The name must be a bare npm package name, such as `serverless-webpack` or `@scope/serverless-plugin`. Versioned package specs such as `serverless-webpack@1.2.3` are not accepted by `plugin uninstall`.

## Provided lifecycle events

- `plugin:uninstall:uninstall`

## Examples

### Remove the `serverless-webpack` plugin

```bash
serverless plugin uninstall --name serverless-webpack
```
