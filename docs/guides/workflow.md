# Workflow Tips

Quick recommendations and tips for various processes.

### Development Workflow

1. Write your functions
2. Use `serverless deploy` only when you've made changes to `serverless.yml` and in CI/CD systems. For more information on setting up CI/CD for your serverless app, read [this article](https://serverless.com/blog/ci-cd-workflow-serverless-apps-with-circleci).
3. Use `serverless deploy function -f myFunction` to rapidly deploy changes when you are working on a specific AWS Lambda Function.
4. Use `serverless invoke -f myFunction -l` to test your AWS Lambda Functions on AWS.
5. Open up a separate tab in your console and stream logs in there via `serverless logs -f myFunction -t`.
6. Write tests to run locally.

### Using stages

- At the very least, use a `dev` and `production` stage.
- Use different AWS accounts for stages.
- In larger teams, each member should use a separate AWS account and their own stage for development.

### Larger Projects

- Break your application/project into multiple services.
- Model your services around Data Models or Workflows.
- Keep the Functions and Resources in your services to a minimum.

## Cheat Sheet

A handy list of commands to use when developing with osls.

##### Create A Service:

Creates a new Service

```bash
serverless create -p [TARGET DIRECTORY] --template-url [TEMPLATE URL]
```

##### Install A Service

This is a convenience method to install a pre-made service locally by downloading the GitHub repository and unzipping it.

```bash
serverless install -u [GITHUB URL OF SERVICE]
```

##### Deploy All

Use this when you have made changes to your Functions, Events or Resources in `serverless.yml` or you simply want to deploy all changes within your Service at the same time.

```bash
serverless deploy -s [STAGE NAME] -r [REGION NAME] -v
```

##### Deploy Function

Use this to quickly overwrite your AWS Lambda code on AWS, allowing you to develop faster.

```bash
serverless deploy function -f [FUNCTION NAME] -s [STAGE NAME] -r [REGION NAME]
```

##### Invoke Function

Invokes an AWS Lambda Function on AWS and returns logs.

```bash
serverless invoke -f [FUNCTION NAME] \
  -s [STAGE NAME] \
  -r [REGION NAME] \
  -l
```

##### Streaming Logs

Open up a separate tab in your console and stream all logs for a specific Function using this command.

```bash
serverless logs -f [FUNCTION NAME] -s [STAGE NAME] -r [REGION NAME]
```
