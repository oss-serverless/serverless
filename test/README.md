# How To Run, Organize, And Write Tests

This document describes the expected style for new and updated tests.

Prefer the smallest harness that exercises the behavior under test without hiding important framework interactions.

## Unit tests

Tests use [Mocha](https://mochajs.org/) and can be run with:

```
npm test
```

Use [`runServerless`](./utils/run-serverless.js) when the behavior depends on a fully initialized framework instance, such as command execution, configuration resolution, plugin loading, lifecycle behavior, or final compiled CloudFormation output.

The `runServerless` helper supports `fixture` and `configExt` options for running against copied service fixtures with optional configuration extensions.

Because `runServerless` tests are relatively expensive, keep the number of runs minimal. Prefer one representative service setup that covers the relevant cases, as in the [ALB health check tests](./unit/lib/plugins/aws/package/compile/events/alb/lib/health-check.test.js).

When creating a new test, it is an established practice to name the top-level describe after the path to the file, as shown in [AWS Kafka tests](./unit/lib/plugins/aws/package/compile/events/kafka.test.js).

### Existing Test Examples

- [Run against config passed inline](./unit/lib/plugins/aws/package/lib/generate-core-template.test.js)
- [Run against pre-prepared fixture](./unit/lib/plugins/aws/package/compile/functions.test.js)
  - Fixtures can be [extended](./unit/lib/plugins/aws/package/compile/events/http-api.test.js) in place. Prefer extending an existing fixture, such as `function`, instead of creating a new one when that still keeps the test clear.
  - If needed introduce new test fixtures at [test/fixtures](./fixtures)

Example of test files fully backed by `runServerless`:

- [test/unit/lib/plugins/aws/package/compile/events/http-api.test.js](./unit/lib/plugins/aws/package/compile/events/http-api.test.js)

When adding tests to a file that still has older direct setup, prefer adding a separate `describe` block for the new coverage instead of expanding the older setup style.

Prefer small, focused test refactors that preserve behavior while moving toward the style documented here.

### Test Style Decision Rule

Use `runServerless` when the behavior under test depends on a fully initialized framework instance: command execution, configuration resolution, plugin loading, lifecycle behavior, or final compiled CloudFormation output.

Prefer a small fake or direct collaborator when the subject is a pure helper, formatter, path/fs utility, deterministic template builder, or narrow SDK wrapper.

Direct `new Serverless(...)` is allowed only when constructor or class wiring is the subject, or when a smaller fake would hide the behavior being asserted.

Do not wire fixture-engine wrappers directly in new tests. Use `runServerless({ fixture })` for command/lifecycle tests or [`setupProgrammaticFixture(...)`](./utils/setup-programmatic-fixture.js) for mutable copied services.

For new AWS lifecycle tests, use `awsSdkV3StubMap`. Shared data factories for common deploy stubs live in [`test/utils/aws-stub-maps.js`](./utils/aws-stub-maps.js); tests should still assert the relevant `awsSdkV3Stub.sends` entries.

## Package Integration Tests

Package integration tests live under [test/integration-package](./integration-package) and run in CI with:

```
npm run integration-test-run-package
```
