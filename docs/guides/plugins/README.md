# Plugins

A plugin is custom JavaScript code that extends Serverless with new features.

If you or your organization have a specific workflow, install a pre-written plugin or write one to customize Serverless to your needs.

Since osls is a group of "core" plugins, custom plugins are written exactly the same way as core plugins. Learn more about [creating a custom plugin](creating-plugins.md).

> **Security note:** Plugins are JavaScript code that osls loads and executes. Treat configured plugins, local plugin paths, and `plugins.localPath` as trusted code. Do not run osls commands against untrusted projects, templates, or pull requests that configure plugins.

Install only plugins from sources you trust.

## Installing plugins

Plugins are installed per service. They are not applied globally.

To install a plugin, run the following command in a service directory:

```
serverless plugin install -n custom-serverless-plugin
```

This command will install the plugin via NPM and register it in `serverless.yml`.

You can also install the plugin manually via NPM:

```
npm install --save-dev custom-serverless-plugin
```

and then register it in `serverless.yml` in the `plugins` section:

```yml
# serverless.yml file

plugins:
  - custom-serverless-plugin
```

Some plugins require extra configuration. The `custom` section in `serverless.yml` is where you can add extra configuration for plugins (the plugin's documentation will tell you if you need to add anything there):

```yml
plugins:
  - custom-serverless-plugin

custom:
  customkey: customvalue
```

Note for plugin authors: read [Extending the configuration](custom-configuration.md) to learn how to enhance `serverless.yml` with configuration validation.

AWS plugin authors should use AWS SDK v3 clients directly and obtain
osls-resolved client configuration with `provider.getAwsSdkV3Config()`.
See [AWS SDK v3 clients](creating-plugins.md#aws-sdk-v3-clients) for details.

Only helpers documented in the plugin guides are considered supported for
plugin authors. Avoid importing osls internal files under `lib/**`
tree.

## Service local plugin

If you are working on a plugin, or have a plugin that is just designed for one project, it can be loaded from local files:

```yml
plugins:
  - ./local-directory/custom-serverless-plugin
```

The path must start with `./` and is relative to the root of your service.

The legacy object form can also set `plugins.localPath` to change where non-relative plugin names are loaded from. Use `plugins.localPath` only with trusted directories.

## Load Order

Keep in mind that the order you define your plugins matters. osls loads all the core plugins, and then the custom plugins in the order you've defined them.

```yml
# serverless.yml

plugins:
  - plugin1
  - plugin2
```

In this case `plugin1` is loaded before `plugin2`.
