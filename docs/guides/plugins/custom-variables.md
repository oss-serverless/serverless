# Custom variables

Plugins can register custom variables sources, for example `${foo:some-variable}`.

Custom sources can be registered via `configurationVariablesSources` as an object with a `resolve` function:

```javascript
'use strict';

class MyPlugin {
  constructor() {
    this.configurationVariablesSources = {
      foo: {
        async resolve({ address }) {
          // `address` contains the name of the variable to resolve:
          // In `${foo:some-variable}`, address will contain `some-variable`.

          // Resolver is expected to return an object with the value in the `value` property:
          return {
            //
            value: `Resolving variable ${address}`,
          };
        },
      },
    };
  }
}

module.exports = MyPlugin;
```

The variable source defined above (registered via a plugin) can be used as follows:

```yaml
service: test
# ...

custom:
  value1: ${foo:bar}

plugins:
  - ./my-plugin
```

The configuration will be resolved into the following:

```yaml
service: test
# ...

custom:
  value1: Resolving variable bar

plugins:
  - ./my-plugin
```

## Variable parameters

Variable sources can support advanced use cases via parameters:

```yaml
service: test
# ...

custom:
  value1: ${foo(one, two):bar}
```

Parameters can be retrieved in the `params` argument:

```javascript
class MyPlugin {
  constructor() {
    this.configurationVariablesSources = {
      foo: {
        async resolve({ address, params }) {
          return {
            // In the example below, ${foo(one, two):bar} will
            // resolve to "one,two"
            value: (params || []).join(','),
          };
        },
      },
    };
  }
}
```

## Resolving variables, configuration values and options

It is possible to retrieve other variables, configuration values and CLI options in the variable resolver:

```javascript
class MyPlugin {
  constructor() {
    this.configurationVariablesSources = {
      foo: {
        async resolve({ resolveVariable, resolveConfigurationProperty, options }) {
          // `options` is CLI options
          // `resolveVariable` resolves other variables (for example here: `${sls:stage}`)
          const stage = await resolveVariable('sls:stage');
          // To retrieve a configuration value from serverless.yml, use
          // `resolveConfigurationProperty` with the property path as an array of keys:
          const region = await resolveConfigurationProperty(['provider', 'region']);

          return {
            value: `The stage is ${stage} in ${region}`,
          };
        },
      },
    };
  }
}
```

### Resolver arguments

The object passed to `resolve()` exposes the following members:

- `address` — the variable address. In `${foo:some-variable}`, `address` is `some-variable`.
- `params` — the variable parameters (see [Variable parameters](#variable-parameters)).
- `options` — the CLI options passed to the command.
- `resolveVariable(variableString)` — resolves a single variable expression (for example
  `await resolveVariable('sls:stage')`) and returns its value.
- `resolveConfigurationProperty(pathKeys)` — resolves a configuration value from
  `serverless.yml` by property path, passed as an array of keys (for example
  `await resolveConfigurationProperty(['provider', 'region'])`). Prefer this over the
  `resolveVariable('self:...')` workaround.
- `resolveVariablesInString(stringValue)` — resolves all variables embedded in an arbitrary
  string and returns the interpolated result.
- `serviceDir` — the absolute path of the service directory (where `serverless.yml` lives).
  `servicePath` is a deprecated alias of `serviceDir` and will be removed in a future major
  version; use `serviceDir` instead.
- `isSourceFulfilled` — `true` when the source was already fully resolved in a previous pass.
