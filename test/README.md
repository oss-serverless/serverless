# How to run, organize and write tests?

As framework deals with significant technical debt baggage many of currently configured tests do not
resemble practice we want to follow in newly introduced tests.

Please follow this document as the only guideline, it also provides links to tests that serve as a good example to replicate

## Unit tests

Tests are configured with [Mocha](https://mochajs.org/) test framework, and can be run with following command

```
npm test
```

All new tests should be configured with help of [runServerless](./utils/run-serverless.js) util - it's the only way to test functionality against completely initialized `serverless` instance, and it's the only scenario that reflects real world usage.

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

## Package integration tests

Package integration tests live under [test/integration-package](./integration-package) and run in CI with:

```
npm run integration-test-run-package
```
