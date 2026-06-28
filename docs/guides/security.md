# Security model

## Configuration is code

A `serverless.yml` file is not inert data. Loading a service configuration can execute arbitrary code on the machine running osls:

- The `plugins` property loads the listed npm packages into the osls process.
- The `${file(./script.js)}` variable source executes the referenced JavaScript file.

osls therefore does not, and cannot, defend against a malicious service configuration. Treat `serverless.yml`, every file it references, and every plugin it lists with the same care as the rest of your codebase: review third-party plugins like any other dependency, and do not run configurations from untrusted sources.

## Resolved secrets in command output and artifacts

Variable sources such as `${ssm:...}` and `${env:...}` resolve to plain strings before commands run. Those resolved values appear in places you may not expect:

- `osls print` outputs the fully resolved configuration, including decrypted SSM SecureString values. Do not pipe it into logs that are retained or shared.
- The packaging step writes `.serverless/serverless-state.json`, which contains the resolved service configuration, including provider and function environment values. Keep the `.serverless` directory out of version control and out of uploaded CI artifacts.
- Verbose and debug output may include resolved values. Treat retained CI logs of osls runs as potentially secret-bearing.

Where possible, prefer passing secrets to functions at runtime (for example, reading from SSM or Secrets Manager inside the function) over resolving them into the configuration at deploy time.

## See also

- [Reference Variables using the SSM Parameter Store](./variables.md#reference-variables-using-the-ssm-parameter-store) and [AWS Secrets Manager](./variables.md#reference-variables-using-aws-secrets-manager) — resolving secrets from AWS at deploy time.
- [Secrets using environment variables and KMS](./functions.md#secrets-using-environment-variables-and-kms) — encrypting secrets stored in function environment variables.
