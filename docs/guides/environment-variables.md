# Loading .env files

> **Looking for runtime environment variables?** This page only covers loading local `.env` files for use during osls commands — it does **not** set environment variables on your deployed Lambda functions. To configure variables in the function runtime, see [Environment Variables in the Functions guide](./functions.md#environment-variables). To reference machine environment variables inside `serverless.yml`, see the [`${env:}` source in the Variables guide](./variables.md#referencing-environment-variables).

To automatically load environment variables from `.env` files (with the help of the [dotenv](https://www.npmjs.com/package/dotenv) package), set `useDotenv: true` in `serverless.yml`:

```yaml
useDotenv: true
```

With that option enabled, `.env` files will also be excluded from the package in order to avoid uploading sensitive data as a part of a package by mistake.

## Support for `.env` files

osls loads `.env.{stage}` from the service directory when present; otherwise it falls back to `.env`. If stage is not explicitly defined, it defaults to `dev`. Invalid stage names are rejected before `.env.{stage}` is read.

osls loads `.env` files quietly by default. Avoid `DOTENV_CONFIG_DEBUG=true` or `DOTENV_CONFIG_QUIET=false` when using machine-readable commands such as `osls print`, or when using osls compose, because those dotenv options can write runtime loading messages to stdout.

### Variable expansion

It is possible to define environment variables as a combination of existing ones:

```env
BASE_URL=my.api.com
PROTOCOL=https

URL=$PROTOCOL/$BASE_URL
```

> This is supported through [dotenv-expand](https://github.com/motdotla/dotenv-expand)

### Differences against `serverless-dotenv-plugin`

There are a few differences between above functionality and [serverless-dotenv-plugin](https://github.com/colynb/serverless-dotenv-plugin):

- osls only loads environment variables locally and does not pass them to your function's environment
- osls loads variables from only one `.env` file (if stage-specific `.env` is found, default `.env` is not loaded)
- osls does not support `.env.local`, `.env.{stage}.local`, and `.env.development` files in a similar way to the plugin
- osls does not use `NODE_ENV` variable and `--env` flag when determining stage
