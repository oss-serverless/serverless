# How to run, organize and write tests?

As framework deals with significant technical debt baggage many of currently configured tests do not
resemble practice we want to follow in newly introduced tests.

Please follow this document as the only guideline, it also provides links to tests that serve as a good example to replicate

## Unit tests

Tests are configured with [Mocha](https://mochajs.org/) test framework, and can be run with following command

```
npm test
```

New tests that need a completely initialized `serverless` instance should use the [runServerless](./utils/run-serverless.js) util. It is the preferred way to test behavior that reflects real world command, lifecycle, plugin-loading, and compiled-template usage.

The `runServerless` util (inlined from @serverless/test) is configured at `./utils/run-serverless.js` and supports two additional options (`fixture` and `configExt`), which provides out of a box setup to run _Serverless_ instance against prepared fixture with eventually extended service configuration

As `runServerless` tests are expensive, it's good to ensure a _minimal_ count of `runServerless` runs to test given scope of problems. Ideally with one service example we should cover most of the test cases we can (good example of such approach is [ALB health check tests](./unit/lib/plugins/aws/package/compile/events/alb/lib/health-check.test.js))

When creating a new test, it is an established practice to name the top-level describe after the path to the file, as shown in [AWS Kafka tests](./unit/lib/plugins/aws/package/compile/events/kafka.test.js).

### Existing test examples:

- [Run against config passed inline](./unit/lib/plugins/aws/package/lib/generate-core-template.test.js)
- [Run against pre-prepared fixture](./unit/lib/plugins/aws/package/compile/functions.test.js)
  - Fixtures can be [extended](./unit/lib/plugins/aws/package/compile/events/http-api.test.js) on spot. Whenever possible it's better to extend existing fixture (e.g. basic `function`) instead of creating new one (check [ALB health check tests](./unit/lib/plugins/aws/package/compile/events/alb/lib/health-check.test.js) for good example on such approach)
  - If needed introduce new test fixtures at [test/fixtures](./fixtures)

Example of test files fully backed by `runServerless`:

- [test/unit/lib/plugins/aws/package/compile/events/http-api.test.js](./unit/lib/plugins/aws/package/compile/events/http-api.test.js)

If we're about to add new tests to an existing test file with tests written old way, then best is to create another `describe` block for new tests at the bottom (as it's done [here](./unit/lib/plugins/aws/package/compile/functions.test.js))

_Note: PR's which rewrite existing tests into new method are very welcome! (but, ideally each PR should cover single test file rewrite)_

### Test style decision rule

Use `runServerless` when the behavior under test depends on a fully initialized framework instance: command execution, configuration resolution, plugin loading, lifecycle behavior, or final compiled CloudFormation output.

Prefer a small fake or direct collaborator when the subject is a pure helper, formatter, path/fs utility, deterministic template builder, or narrow SDK wrapper.

Direct `new Serverless(...)` is allowed only when constructor/class wiring is the subject, or when a smaller fake would hide the behavior being asserted. Label remaining direct construction as `constructor-under-test`, `pure-unit-fake-not-possible`, or `temporary-migration-seam`.

Do not import `test/fixtures/programmatic/index.js` directly in new tests. Use `runServerless({ fixture })` for command/lifecycle tests or [`setupProgrammaticFixture(...)`](./utils/setup-programmatic-fixture.js) for mutable copied services.

Run `node scripts/test-migration-inventory.js` when reviewing migration work. Use `node scripts/test-migration-inventory.js --json` for automation and `node scripts/test-migration-inventory.js --ratchet --base-ref <ref>` to reject new unapproved direct construction, direct fixture wrapper files, or `awsRequestStubMap` files.

For new AWS lifecycle tests, prefer `awsSdkV3StubMap` over `awsRequestStubMap`. Shared data factories for common deploy stubs live in [`test/utils/aws-stub-maps.js`](./utils/aws-stub-maps.js); tests should still assert the relevant `awsSdkV3Stub.sends` entries.

## Package integration tests

Package integration tests live under [test/integration-package](./integration-package) and run in CI with:

```
npm run integration-test-run-package
```
