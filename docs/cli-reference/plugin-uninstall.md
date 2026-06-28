# AWS - Plugin Uninstall

Uninstall an osls plugin and remove it from the services `plugins` array.

```bash
osls plugin uninstall --name pluginName
```

## Options

- `--name` or `-n` The plugins name. **Required**.

The name must be a bare npm package name, such as `example-osls-plugin` or `@example/osls-plugin`. Versioned package specs such as `example-osls-plugin@1.2.3` are not accepted by `plugin uninstall`.

## Examples

### Remove the `example-osls-plugin` plugin

```bash
osls plugin uninstall --name example-osls-plugin
```

---

[← All Commands](./README.md) · [Docs Home](../README.md)
