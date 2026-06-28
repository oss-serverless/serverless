# CI/CD

This guide covers running osls in continuous integration and deployment pipelines: supplying AWS credentials non-interactively, splitting the build from the deploy with `osls package` and `osls deploy --package`, and handling the `.serverless` artifacts safely.

CI runners are headless, so everything must work without prompts or a browser. osls is well suited to this: `osls deploy` is the recommended deployment method for CI/CD because it goes through CloudFormation, and the package/deploy split lets you build once and ship the exact same artifacts.

## Providing AWS credentials non-interactively

osls resolves AWS credentials through the standard AWS SDK chain, so any mechanism the SDK understands works in CI without an interactive `osls config credentials` step. Pick the option that matches your CI provider.

### Static access keys via environment variables

The simplest approach is to export an access key and secret as environment variables. osls and the AWS SDK pick them up automatically:

```bash
export AWS_ACCESS_KEY_ID=<your-key-here>
export AWS_SECRET_ACCESS_KEY=<your-secret-key-here>
osls deploy --stage prod --region eu-central-1
```

Store these as masked/secret variables in your CI provider; never commit them to the repository or print them in logs. If you also need a session token (for temporary credentials), set `AWS_SESSION_TOKEN` as well.

### OIDC / web identity tokens (no long-lived secrets)

Many CI providers (for example GitHub Actions) and AWS EKS can mint a short-lived OpenID Connect token that osls exchanges for AWS credentials, avoiding stored long-lived keys entirely. To use web identity token authentication, the `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN` environment variables must be set:

```bash
export AWS_ROLE_ARN=arn:aws:iam::123456789012:role/ci-deploy-role
export AWS_WEB_IDENTITY_TOKEN_FILE=/path/to/oidc/token
osls deploy --stage prod --region eu-central-1
```

On AWS EKS these are set automatically when you associate an IAM role with the pod's service account. On GitHub Actions, the standard `aws-actions/configure-aws-credentials` action configures the same variables for you after the workflow requests an OIDC token. Prefer this method over static keys where your CI provider supports it.

### Assuming a role

You can have osls assume another IAM role for the deployment (and all other CLI commands) by configuring role assumption in the AWS shared config file. Point the SDK at that config with `AWS_PROFILE` (and `AWS_CONFIG_FILE` if it is not in the default location), then run osls as usual. See the AWS guide on [assuming a role with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html) and the [AWS Credentials guide](./credentials.md#assuming-a-role-when-deploying) for details.

Note that `serverless.yml`'s `provider.iam.deploymentRole` is a different mechanism: it only changes the role CloudFormation assumes to create resources, not the role osls itself uses for its AWS API calls. For CI, prefer assuming the role at the credentials layer (above) so every interaction runs under the intended identity.

## Splitting build from deploy: `package` then `deploy --package`

For consistent, auditable pipelines, build the deployment artifacts in one step and deploy them in a later step. This guarantees that what you tested is exactly what you ship.

First, package the service into a directory. By default `osls package` writes artifacts to the service's `.serverless` directory; use `--package` to choose an explicit output directory:

```bash
osls package --package ./artifacts --stage prod --region eu-central-1
```

Then deploy that pre-built directory, which skips the packaging step entirely:

```bash
osls deploy --package ./artifacts --stage prod --region eu-central-1
```

When you pass `--package` to `osls deploy`, the deploy process bypasses packaging and uses the existing artifacts to create or update the CloudFormation stack.

**Note:** The `--stage` and `--region` must match between the `package` and `deploy` invocations. The package step bakes the resolved stage and region into the artifacts (including the generated CloudFormation template and `serverless-state.json`), so deploying a package built for one stage/region to another will not retarget it. Pass the same values (or rely on the same `serverless.yml` defaults) in both steps.

A typical two-stage pipeline:

```bash
# Build stage: produce artifacts once, save ./artifacts for the next stage
osls package --package ./artifacts --stage prod --region eu-central-1

# Deploy stage: ship the exact artifacts that were built and tested
osls deploy --package ./artifacts --stage prod --region eu-central-1
```

## Handling artifacts and secrets

The packaging step writes a `.serverless` directory (or your `--package` target) that contains the resolved service configuration. Crucially, `serverless-state.json` includes resolved variable values such as provider and function environment variables and decrypted `${ssm:...}` SecureString values. Treat these artifacts as potentially secret-bearing:

- Keep the `.serverless` directory (and any custom `--package` output) out of version control.
- Do not publish the package directory as a public or long-retained CI artifact. If you pass it between pipeline stages, use a private, short-lived artifact store.
- Treat verbose and debug logs of osls runs as potentially secret-bearing as well.

For the full picture of how resolved secrets flow into command output and artifacts — and how to avoid baking secrets into the configuration in the first place — see the [Security model guide](./security.md).
