# AWS - Create

Creates a new service from a remote or local template.

**Create a service in a new folder from a remote template:**

```bash
serverless create \
  --template-url https://github.com/serverless/examples/tree/v3/... \
  --path myService
```

**Create a service in a new folder using a local template:**

```bash
serverless create \
  --template-path path/to/my/template/folder \
  --path myService
```

## Options

- `--template-url` or `-u` A remotely hosted template URL. Supports plain Git URLs plus GitHub, GitHub Enterprise, GitLab, Bitbucket, and Bitbucket Server. **Required if --template-path is not present**.
- `--template-path` The local path of your template. **Required if --template-url is not present**.
- `--path` or `-p` The path where the service should be created.
- `--name` or `-n` The name of the service in `serverless.yml`. If `--path` is omitted, Serverless also uses this as the target directory name.

## Provided lifecycle events

- `create:create`

## Examples

### Creating a named service in a new directory from a remote template

```bash
serverless create \
  --template-url https://github.com/serverless/examples/tree/v3/... \
  --path my-new-service \
  --name my-new-service
```

This example will download the template into the `my-new-service` directory. This directory will be created if not present. Serverless will not overwrite an existing target directory when `--path` is used.

Additionally Serverless will rename the service according to the name you provide. If `--path` is omitted, Serverless uses `--name` as the target directory. If `--name` is omitted, the service name defaults to the target directory's final path segment.

### Creating a new service using a local template

```bash
serverless create \
  --template-path path/to/my/template/folder \
  --path path/to/my/service \
  --name my-new-service
```

This will copy the `path/to/my/template/folder` folder into `path/to/my/service`. If `--name` is provided, the copied template's service name will be renamed to `my-new-service`. If `--name` is omitted, the service name defaults to the target directory's final path segment.

If neither `--path` nor `--name` is provided, Serverless will create a new directory named after the local template folder and preserve the template's existing service name.
