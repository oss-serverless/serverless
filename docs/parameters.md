# Parameters

Parameters can be defined in `serverless.yml` or passed via CLI with `--param="<key>=<value>"` flags. They can be used for example to:

- adapt the configuration based on the stage
- store secrets securely
- share configuration values between team members

## CLI parameters

Parameters can be passed directly via CLI `--param` flag, following the pattern `--param="<key>=<value>"`:

```
serverless deploy --param="domain=myapp.com" --param="key=value"
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
