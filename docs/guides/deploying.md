# Deploying to AWS

osls was designed to provision your AWS Lambda Functions, Events and infrastructure Resources safely and quickly. It does this via a couple of methods designed for different types of deployments.

## Deploy All

This is the main method for doing deployments with osls:

```bash
osls deploy
```

Use this method when you have updated your Function, Event or Resource configuration in `serverless.yml` and you want to deploy that change (or multiple changes at the same time) to Amazon Web Services.

**Note:** You can always enforce a deployment using the `--force` option, or specify a different configuration file name with the the `--config` option.

### How It Works

osls translates all syntax in `serverless.yml` to a single AWS CloudFormation template. By depending on CloudFormation for deployments, users of osls get the safety and reliability of CloudFormation.

- An AWS CloudFormation template is created from your `serverless.yml`.
- If a Stack has not yet been created, then it is created with no resources except for an S3 Bucket, which will store zip files of your Function code.
- If you're using locally build ECR images, dedicated ECR repository is created for your service. You also will be logged to that repository via `docker login` if needed.
- The code of your Functions is then packaged into zip files.
- If you're using locally build ECR images, they are built and uploaded to ECR.
- osls fetches the hashes for all files of the previous deployment (if any) and compares them against the hashes of the local files.
- osls terminates the deployment process if all file hashes are the same.
- Zip files of your Functions' code are uploaded to your Code S3 Bucket.
- Any IAM Roles, Functions, Events and Resources are added to the AWS CloudFormation template.
- The CloudFormation Stack is updated with the new CloudFormation template.
- Each deployment publishes a new version for each function in your service.

### Deployment method

Since osls v3, deployments are done using [CloudFormation change sets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html). It is possible to use [CloudFormation direct deployments](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-direct.html) instead.

Direct deployments **are faster** and have no downsides (unless you specifically use the generated change sets). In osls, change sets remain the default deployment method; direct deployments are opt-in.

You are encouraged to enable direct deployments via the `deploymentMethod` option:

```yaml
provider:
  name: aws
  deploymentMethod: direct
```

### Deletion protection

Set `provider.deletionProtection` to have osls manage [CloudFormation termination protection](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-protect-stacks.html) for the service stack:

```yaml
provider:
  name: aws
  deletionProtection: true
```

To protect only some stages, list them:

```yaml
provider:
  name: aws
  deletionProtection:
    stages:
      - prod
```

After every successful `osls deploy`, including deploys that are skipped because nothing changed, osls sets the stack's termination protection to match the configuration: enabled when the value is `true` or the current stage is listed in `stages`, disabled otherwise. With the `stages` form, deploying an unlisted stage therefore actively disables protection on that stage's stack. Third-party termination protection plugins typically only ever enable protection, so check the `stages` list when migrating from one. `osls deploy function` and `osls rollback` never change the setting, and removing `provider.deletionProtection` from `serverless.yml` does not disable protection on an existing stack; it only stops osls from managing it.

While a stack is protected, `osls remove` fails early with `AWS_CLOUDFORMATION_DELETION_PROTECTION_ENABLED`, before any deployment artifacts are deleted, and deleting the stack in the AWS console or CLI is rejected by CloudFormation. To remove the service, set `provider.deletionProtection` to `false` (or drop the stage from `stages`), deploy, then remove. If deploying is not possible, for example because the stack is stuck in a failed state, disable protection directly with `aws cloudformation update-termination-protection --no-enable-termination-protection --stack-name <stack-name>`.

Keep in mind:

- The deploying identity needs `cloudformation:UpdateTerminationProtection` on the stack. `osls remove` uses `cloudformation:DescribeStacks` to check the flag; if that call is denied, osls logs a warning and continues, and CloudFormation still refuses to delete a protected stack.
- Protection is applied after the stack has been created or updated, so a brand-new stack is unprotected until its first deployment completes.
- An invalid value fails the deploy with `INVALID_DELETION_PROTECTION_CONFIG` before anything is uploaded. Configuration validation already rejects most invalid shapes; this also covers `configValidationMode: warn` and `off`.
- `osls deploy --package` uses the value saved by `osls package`; re-run `osls package` after changing it.
- Nested stacks inherit the root stack's setting.
- Termination protection prevents accidents, not malicious deletion: anyone allowed to call `UpdateTerminationProtection` can turn it off, and deploying with `deletionProtection: false` does exactly that.

### Tips

- Use this in your CI/CD systems, as it is the safest method of deployment.
- You can print the progress during the deployment if you use `verbose` mode, like this:
  ```bash
  osls deploy --verbose
  ```
- This method uses the AWS CloudFormation Stack Update method. CloudFormation is slow, so this method is slower. If you want to develop more quickly, use the `osls deploy function` command (described below)

- This method defaults to `dev` stage and `us-east-1` region. You can change the default stage and region in your `serverless.yml` file by setting the `stage` and `region` properties inside a `provider` object as the following example shows:

  ```yaml
  # serverless.yml

  service: service-name
  provider:
    name: aws
    stage: beta
    region: us-west-2
  ```

- You can also deploy to different stages and regions by passing in flags to the command:

  ```bash
  osls deploy --stage production --region eu-central-1
  ```

- You can specify your own S3 bucket which should be used to store all the deployment artifacts.
  The `deploymentBucket` config which is nested under `provider` lets you e.g. set the `name` or the `serverSideEncryption` method for this bucket. If you don't provide your own bucket, osls
  will create a bucket which uses default AES256 encryption.

- You can limit how many previous deployment artifacts are retained in the deployment bucket by setting `maxPreviousDeploymentArtifacts` under `deploymentBucket` config to an integer. Older artifacts beyond that count are pruned after each deployment, which also bounds how far back `osls rollback` can go.

- You can specify your own S3 prefix which should be used to store all the deployment artifacts.
  The `deploymentPrefix` config which is nested under `provider` lets you set the prefix under which the deployment artifacts will be stored. If not specified, defaults to `serverless`.

- You can make uploading to S3 faster by adding `--aws-s3-accelerate`

- You can disable creation of default S3 bucket policy by setting `skipPolicySetup` under `deploymentBucket` config. It only applies to deployment bucket that is automatically created
  by osls.

- You can enable versioning for the deployment bucket by setting `versioning` under `deploymentBucket` config to `true`.

Check out the [deploy command docs](../cli-reference/deploy.md) for all details and options.

## Deploying to multiple regions

A single service is deployed to one region per command run. To deploy the same service to several regions, run `osls deploy` once per region, overriding the region each time with the `--region` flag:

```bash
osls deploy --region us-east-1
osls deploy --region eu-central-1
```

Each region gets its own independent CloudFormation stack, so the deployments do not interfere with one another. In CI/CD you can loop over a list of regions, or run the per-region deploys in parallel. To orchestrate several distinct services (each potentially in a different region), see [Composing services](./compose.md).

## Deploy Function

This deployment method does not touch your AWS CloudFormation Stack. Instead, it simply overwrites the zip file of the current function on AWS. This method is much faster, since it does not rely on CloudFormation.

```bash
osls deploy function --function myFunction
```

- **Note:** You can always enforce a deployment using the `--force` option.
- **Note:** You can use `--update-config` to change only Lambda configuration without deploying code.

### How It Works

- The CLI packages up the targeted AWS Lambda Function into a zip file.
- The CLI fetches the hash of the already uploaded function .zip file and compares it to the local .zip file hash.
- The CLI terminates if both hashes are the same.
- That zip file is uploaded to your S3 bucket using the same name as the previous function, which the CloudFormation stack is pointing to.

### Tips

- Use this when you are developing and want to test on AWS because it's much faster.
- During development, people will often run this command several times, as opposed to `osls deploy` which is only run when larger infrastructure provisioning is required.

Check out the [deploy command docs](../cli-reference/deploy.md) for all details and options.

## Deploying a package

This deployment option takes a deployment directory that has already been created with `osls package` and deploys it to the cloud provider. This allows you to easily integrate CI / CD workflows with osls.

```bash
osls deploy --package path-to-package
```

### How It Works

- The argument to the `--package` flag is a directory that has been previously packaged by osls (with `osls package`).
- The deploy process bypasses the package step and uses the existing package to deploy and update CloudFormation stacks.
