# Plugins

A plugin is custom JavaScript code that extends osls with new features.

If you or your organization have a specific workflow, install a pre-written plugin or write one to customize osls to your needs.

Since osls is a group of "core" plugins, custom plugins are written exactly the same way as core plugins. Learn more about [creating a custom plugin](creating-plugins.md).

## Authoring plugins

These guides cover how to write your own plugins:

- [Creating custom plugins](creating-plugins.md) — plugin structure, lifecycle hooks, and the `serverless` instance.
- [Custom commands](custom-commands.md) — define new CLI commands, options, and sub-commands.
- [Custom variables](custom-variables.md) — register new `${...}` variable sources.
- [Extending the configuration schema](custom-configuration.md) — validate and add custom `serverless.yml` syntax.
- [Extending and overriding configuration](extending-configuration.md) — programmatically set resolved configuration values.
- [CLI output in plugins](cli-output.md) — log messages, progress, errors, and command output.

> **Security note:** Plugins are JavaScript code that osls loads and executes. Treat configured plugins, local plugin paths, and `plugins.localPath` as trusted code. Do not run osls commands against untrusted projects, templates, or pull requests that configure plugins.

Install only plugins from sources you trust.

## Installing plugins

Plugins are installed per service. They are not applied globally.

To install a plugin, run the following command in a service directory:

```bash
osls plugin install -n example-osls-plugin
```

This command will install the plugin via NPM and register it in `serverless.yml`.

`osls plugin install --name` accepts npm package names, scoped package names, semver ranges, and npm dist-tags. For example, `example-osls-plugin`, `@example/osls-plugin`, `example-osls-plugin@^1.0.0`, and `example-osls-plugin@next` are valid install specs. Literal embedded quotes are not accepted in osls v4; quote the full `--name` value at the shell level if your version range contains spaces.

npm lifecycle scripts are ignored by default during plugin install. If you trust the plugin and need its lifecycle scripts to run, pass `--allow-install-scripts`.

You can also install the plugin manually via NPM:

```bash
npm install --save-dev example-osls-plugin
```

and then register it in `serverless.yml` in the `plugins` section:

```yaml
# serverless.yml file

plugins:
  - example-osls-plugin
```

The `plugins` section accepts bare npm package names and explicit local plugin paths beginning with `./`. Versioned install specs such as `example-osls-plugin@1.2.3` are not accepted in configuration; pin plugin versions in `package.json` instead.

Some plugins require extra configuration. The `custom` section in `serverless.yml` is where you can add extra configuration for plugins (the plugin's documentation will tell you if you need to add anything there):

```yaml
plugins:
  - example-osls-plugin

custom:
  customkey: customvalue
```

Note for plugin authors: read [Extending the configuration](custom-configuration.md) to learn how to enhance `serverless.yml` with configuration validation.

AWS plugin authors should use AWS SDK v3 clients directly and obtain
osls-resolved client configuration with `provider.getAwsSdkV3Config()`.
See [AWS plugins](creating-plugins.md#aws-plugins) for details.

Only helpers documented in the plugin guides are considered supported for
plugin authors. Avoid importing osls internal files under `lib/**`
tree.

## Service local plugin

If you are working on a plugin, or have a plugin that is just designed for one project, it can be loaded from local files:

```yaml
plugins:
  - ./local-directory/example-osls-plugin
```

The path must start with `./` and is relative to the root of your service.
Local plugin paths must stay inside the service directory.

The legacy object form can also set `plugins.localPath` to change where non-relative plugin names are loaded from. Use `plugins.localPath` only with trusted directories.

## Load Order

Keep in mind that the order you define your plugins matters. osls loads all the core plugins, and then the custom plugins in the order you've defined them.

```yaml
# serverless.yml

plugins:
  - plugin1
  - plugin2
```

In this case `plugin1` is loaded before `plugin2`.
