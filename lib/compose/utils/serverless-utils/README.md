Curated `@serverless/utils` vendor for compose

This subtree contains the small logging/reporting slice of `@serverless/utils`
that compose still needs at process startup.

It is internal only.
Compose does not alias any `@serverless/utils/*` import paths to this
directory.

Loaded components should use the compose `ComponentContext` API for logging and
progress. If a component wants to use `@serverless/utils/*`, it must declare
that dependency itself.

Included here:

- `log.js`
- `log-reporters/node.js`
- `lib/log/*`
- `lib/log-reporters/node/*`

Explicitly excluded here:

- config helpers
- download helpers
- schema helpers
- inquirer helpers
- compatibility shims and aliases

Source package:

- `@serverless/utils`
- upstream version tracked in `policy.js`

When updating this subtree:

1. Update `policy.js`.
2. Update the structural allowlist test.
3. Add or adjust unit tests for changed behavior.
