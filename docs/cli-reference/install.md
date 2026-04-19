# AWS - Install

Installs a service from a remote Git URL into a new directory in the current working directory.

```bash
serverless install --url https://github.com/some/service
```

## Options

- `--url` or `-u` The services Git URL (can be a plain Git or a Code Hosting Platform URL). **Required**.
- `--name` or `-n` Name for the service. Also used as the target directory name.

## Provided lifecycle events

- `install:install`

## Supported Remote Sources

- Plain Git URLs
- GitHub
- GitHub Enterprise
- GitLab
- Bitbucket
- Bitbucket Server

## Examples

### Installing a service from a remote URL

```bash
serverless install --url https://github.com/pmuens/serverless-crud
```

This example downloads the `serverless-crud` service from the remote repository, creates a new directory named `serverless-crud` in the current working directory, and unzips the files into it.

### Installing a service from a remote URL with a new service name

```bash
serverless install --url https://github.com/pmuens/serverless-crud --name my-crud
```

This example downloads the `serverless-crud` service from the remote repository, creates a new directory named `my-crud` in the current working directory, and renames the service to `my-crud` if `serverless.yml` exists in the service root.

### Installing a service from a repository subdirectory URL

```bash
serverless install --url https://github.com/serverless/examples/tree/master/aws-node-rest-api-with-dynamodb
```

This example downloads the `aws-node-rest-api-with-dynamodb` service from a repository subdirectory.
