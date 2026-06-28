# AWS - Rollback Function

Rollback a function service to a specific version.

```bash
osls rollback function --function <name> \
  --function-version <version>
```

**Note:** You can only rollback a function which was previously deployed through `osls deploy`. Functions are not versioned when running `osls deploy function`.

**Note:** This command is not supported for functions configured with `durableConfig` locally or already deployed with durable configuration in AWS. Use `osls deploy` to publish and retarget durable function versions.

## Options

- `--function` or `-f` The name of the function which should be rolled back
- `--function-version` The version to which the function should be rolled back

## Examples

### AWS

At first you want to run `osls deploy list functions` to see all the deployed functions of your service and their corresponding versions.
After picking a function and the version you can run the `osls rollback function` command to rollback the function.

E.g. `osls rollback function -f my-function --function-version 23` rolls back the function `my-function` to the version `23`.
