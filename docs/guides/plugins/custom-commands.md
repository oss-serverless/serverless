# Custom commands

osls plugins can define custom CLI commands.

These commands can then be called by users, for example: `osls my-command`.

```javascript
class MyPlugin {
  constructor() {
    this.commands = {
      'my-command': {
        lifecycleEvents: ['resources', 'functions'],
      },
    };
  }
}

module.exports = MyPlugin;
```

A CLI _Command_ that can be called by a user, e.g. `osls foo`. A Command has no logic, but simply defines the CLI configuration (e.g. command, parameters) and the _Lifecycle Events_ for the command. Every command defines its own lifecycle events.

## Lifecycle events

By default, a command has no logic. Use _lifecycle event hooks_ to add logic when the command runs:

```javascript
class MyPlugin {
  constructor() {
    this.commands = {
      'my-command': {
        lifecycleEvents: ['run'],
      },
    };

    this.hooks = {
      'my-command:run': () => {
        // Do something
      },
    };
  }
}
```

For each event, an additional `before` and `after` event is created:

```js
this.hooks = {
  'before:my-command:run': () => {
    // Before my command runs
  },
  'my-command:run': () => {
    // My command runs
  },
  'after:my-command:run': () => {
    // After
  },
};
```

Note that a command can define multiple events: these will be called sequentially.

## Command options

Commands can have CLI options:

- either passed with a double dash (`--`): `osls my-command --function functionName`.
- or as a shortcut with a single dash (`-`): `osls my-command -f functionName`.

Options can be specified in the command definition. The value of the CLI option can be retrieved via the `options` parameter of the plugin:

```javascript
class MyPlugin {
  constructor(serverless, options) {
    this.options = options;

    this.commands = {
      'my-command': {
        // The 'usage' property is used to display the 'osls --help' output
        usage: 'This is my new custom command!',
        lifecycleEvents: ['run'],
        options: {
          // Define the '--function' option with the '-f' shortcut
          function: {
            usage: 'Specify the function you want to handle (e.g. "--function myFunction")',
            shortcut: 'f',
            required: true,
            type: 'string', // Possible values: 'string', 'boolean', 'multiple'
          },
        },
      },
    };

    this.hooks = {
      'my-command:run': () => this.run(),
    };
  }

  run() {
    console.log('The option was: ', this.options.function);
  }
}
```

If an option is not required, a `default` property can be set in the option definition.

## Nested commands

Commands can define sub-commands via a nested `commands` object. This mirrors how osls core
nests `deploy function` under `deploy`:

```javascript
class MyPlugin {
  constructor() {
    this.commands = {
      'my-command': {
        usage: 'My top-level command',
        lifecycleEvents: ['run'],
        commands: {
          resource: {
            usage: 'My nested sub-command',
            lifecycleEvents: ['run'],
          },
        },
      },
    };

    this.hooks = {
      'my-command:run': () => this.run(),
      'my-command:resource:run': () => this.runResource(),
    };
  }
}
```

The sub-command above is invoked as `osls my-command resource`, and its lifecycle event is
namespaced under the parent: `my-command:resource:run`.

## Spawning other commands

A plugin can run another command's full lifecycle from within a hook via
`serverless.pluginManager.spawn()`:

```javascript
class MyPlugin {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      'my-command:run': async () => {
        // Run the `package` command lifecycle
        await this.serverless.pluginManager.spawn('package');
      },
    };
  }
}
```

The command can be passed as a colon-separated string (`'deploy:function'`) or as an array of
segments (`['deploy', 'function']`).

Pass `{ terminateLifecycleAfterExecution: true }` to stop the current command's remaining
lifecycle events once the spawned command finishes:

```javascript
await this.serverless.pluginManager.spawn('package', {
  terminateLifecycleAfterExecution: true,
});
```

## Command naming

Command names must be unique across all plugins. For example instead of defining a custom `deploy` command, name it `my-company-deploy` instead.

If a plugin defines a command name that conflicts with osls core or another plugin, the CLI will exit with an error.
