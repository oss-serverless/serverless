# Plugin Install

Install an osls plugin and add it to the service's `plugins` array. By default, the latest version is installed.
If you want a specific version, semver range, or npm dist-tag, specify `<pluginname>@<version>` as the name option.

**Note:** You might want to change the order of the plugin in the services `plugins` array.

```bash
serverless plugin install --name pluginName
```

## Options

- `--name` or `-n` The plugins name. **Required**.
- `--allow-install-scripts` Allow npm lifecycle scripts while installing the plugin. By default, plugin install passes `--ignore-scripts` to npm.

The plugin name must be an npm package name, such as `example-osls-plugin` or `@example/osls-plugin`. Versioned install specs may use semver ranges or dist-tags, such as `example-osls-plugin@3.0.0-rc.2`, `example-osls-plugin@^1.0.0 || 2`, or `@example/osls-plugin@next`.

Literal embedded quotes are not accepted in osls v4. Quote the whole `--name` value at the shell level when the version range contains spaces or shell metacharacters:

```bash
serverless plugin install --name 'example-osls-plugin@^1.0.0 || 2'
```

Package aliases, git URLs, HTTP URLs, file paths, workspace specs, and tarball paths are not accepted by `plugin install`.

## Provided lifecycle events

- `plugin:install:install`

## Examples

### Install the `example-osls-plugin` plugin

```bash
serverless plugin install --name example-osls-plugin
```

### Install a specific version

```bash
serverless plugin install --name example-osls-plugin@3.0.0-rc.2
```

### Allow npm lifecycle scripts

```bash
serverless plugin install --name example-osls-plugin --allow-install-scripts
```
