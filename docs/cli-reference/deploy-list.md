# AWS - Deploy List

The `osls deploy list [functions]` command will list information about your deployments.

You can either see all available deployments in your S3 deployment bucket by running `osls deploy list` or you can see the deployed functions by running `osls deploy list functions`.

The displayed information is useful when rolling back a deployment or function via `osls rollback`.

## Options

- `--stage` or `-s` The stage in your service that you want to deploy to.
- `--region` or `-r` The region in that stage that you want to deploy to.

## Examples

### List existing deploys

```bash
osls deploy list
```

### List deployed functions and their versions

```bash
osls deploy list functions
```
