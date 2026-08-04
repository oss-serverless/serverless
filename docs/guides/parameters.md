# Parameters

Parameters can be defined in `serverless.yml` or passed via CLI with `--param="<key>=<value>"` flags. They can be used for example to:

- adapt the configuration based on the stage
- store secrets securely
- share configuration values between team members

## CLI parameters

Parameters can be passed directly via CLI `--param` flag, following the pattern `--param="<key>=<value>"`:

```bash
osls deploy --param="domain=myapp.com" --param="key=value"
```

Parameters can then be used via the `${param:XXX}` variables:

```yaml
provider:
  environment:
    APP_DOMAIN: ${param:domain}
    KEY: ${param:key}
```

## Stage parameters

Parameters can be defined **for each stage** in `serverless.yml` under the `params` key:

```yaml
params:
  prod:
    domain: myapp.com
  dev:
    domain: preview.myapp.com
```

Use the `default` key to define parameters that apply to all stages by default:

```yaml
params:
  default:
    domain: ${sls:stage}.preview.myapp.com
  prod:
    domain: myapp.com
  dev:
    domain: preview.myapp.com
```

Parameters can then be used via the `${param:XXX}` variables:

```yaml
provider:
  environment:
    APP_DOMAIN: ${param:domain}
```

The variable will be resolved based on the current stage.

## Inheritance and overriding

Here is the priority used to resolve a `${param:XXX}` variable:

- First, look in params passed with `--param` CLI flag
- If not found, then look in `params.<stage>` in `serverless.yml`
- If not found, then look in `params.default` in `serverless.yml`
- If not found, throw an error, or use the fallback value if one was provided: `${param:XXX, 'default value'}`

This is especially useful in development when deploying to ephemeral stages (e.g. "feature-x"). The stage might not have any parameter, therefore it will default to the parameters set on the service. However, in other stages, like "prod", or "staging", you may override the service-level parameters with stage-level parameters to use values unique to that stage.

## Resolution of other stages

Variables set in `params.<stage>` sections that do not concern the current stage are not resolved. For example when deploying to `dev`, a `${ssm:/prod/secret}` variable set in `params.prod` is not fetched from SSM, and errors it may raise (missing permissions, missing environment variable, unknown variable source…) do not fail the command.

Such variables are still resolved when they are explicitly referenced, e.g. with `${self:params.prod.domain}`.

There are a few exceptions:

- Params under `params.default` are always resolved, as they apply to every stage.
- When a whole section is defined with a single variable (e.g. `params: ${file(./params.yml)}` or `params.prod: ${file(./prod-params.yml)}`), that variable itself is still resolved: the configuration schema requires these sections to be objects. Values nested in the result are however only resolved for the current stage.
- Variable syntax errors are reported for all stages: a malformed variable in `params.prod` still fails the command when deploying to `dev`.

One consequence is that `serverless print` displays these values unresolved, as they appear in `serverless.yml`:

```yaml
params:
  dev:
    domain: dev.myapp.com
  prod:
    domain: ${ssm:/myapp/prod/domain} # left as-is when deploying to "dev"
```

## See also

- [Referencing parameters](./variables.md#referencing-parameters) in the Variables guide for more on the `${param:XXX}` source.
- [Common Options](../cli-reference/README.md#common-options) in the CLI Reference for the `--param` flag.
