# Packaging Python dependencies

OSLS includes Python requirements packaging for AWS Lambda services. It installs dependencies from `requirements.txt`, uv, Pipenv, or Poetry and adds them to the deployment artifact.

The integration is maintained directly in OSLS and is derived from [`serverless-python-requirements`](https://github.com/serverless/serverless-python-requirements). The standalone plugin is deprecated, so new OSLS services should use the built-in integration.

## Enable the integration

Add `custom.pythonRequirements` to `serverless.yml`. An empty object enables the defaults:

```yaml
provider:
  name: aws
  runtime: python3.13

custom:
  pythonRequirements: {}

functions:
  hello:
    handler: handler.hello
```

Keep application dependencies in `requirements.txt` next to `serverless.yml`:

```text
boto3==1.40.0
requests==2.32.4
```

OSLS installs them automatically during `osls package` and `osls deploy`.

## Migrate an existing service

Remove `serverless-python-requirements` from the `plugins` list and from the service's `package.json`. Keep the existing `custom.pythonRequirements` configuration; its options remain compatible.

Before:

```yaml
plugins:
  - serverless-python-requirements

custom:
  pythonRequirements:
    dockerizePip: non-linux
```

After:

```yaml
custom:
  pythonRequirements:
    dockerizePip: non-linux
```

For a staged migration, an explicitly installed and configured community plugin still takes precedence over OSLS's built-in implementation.

## uv projects

When `uv.lock` is present, OSLS exports locked dependencies automatically before packaging. To use uv for installation too:

```yaml
custom:
  pythonRequirements:
    installer: uv
```

Set `useUv: false` to use a manually maintained `requirements.txt` instead.

## Common options

Build native dependencies in the AWS Lambda build image:

```yaml
custom:
  pythonRequirements:
    dockerizePip: true
```

Reduce artifact size:

```yaml
custom:
  pythonRequirements:
    slim: true
    strip: false
    noDeploy:
      - boto3
      - botocore
```

Put dependencies in a Lambda layer:

```yaml
custom:
  pythonRequirements:
    layer: true

functions:
  hello:
    handler: handler.hello
    layers:
      - Ref: PythonRequirementsLambdaLayer
```

Disable the integration without deleting its configuration:

```yaml
custom:
  pythonRequirements:
    enabled: false
```

The manual maintenance commands remain available:

```bash
osls requirements install
osls requirements clean
osls requirements cleanCache
```

See the [upstream option reference](https://github.com/serverless/serverless-python-requirements#readme) for Docker, caching, per-function requirements, zip mode, vendored libraries, and other compatibility options.
