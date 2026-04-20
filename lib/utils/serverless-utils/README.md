Curated `@serverless/utils` vendor

This directory contains a curated subset of upstream `@serverless/utils`.

It is not a full mirror, and presence in this subtree does not make a module
part of the public plugin API.

Included here:

- generic runtime helpers used by osls
- CLI logging/output infrastructure
- generic config/schema/download helpers
- a small generic inquirer companion helper

Explicitly excluded here:

- auth/account/backend API helpers
- notification and analytics helpers
- Serverless Console/dev-mode helpers
- telemetry and prompt-history helpers
- duplicate abstractions already implemented in osls

Source of truth:

- `./policy.js`

Notes:

- `config.js` is a locally owned fork. It intentionally keeps the synchronous
  `get('frameworkId')` and `get('meta.created_at')` lookups that Bref v2/v3 use
  for best-effort telemetry if a future compatibility shim routes
  `@serverless/utils/config` here.
- Runtime compatibility aliases are intentionally narrow. Today osls only maps
  `@serverless/utils/config` and `@serverless/utils/log` (plus their `.js`
  variants) to this vendored subtree.

When updating this subtree:

1. Update `policy.js`.
2. Update the structural allowlist test.
3. Add or adjust unit tests for changed behavior.
4. Record the upstream version if it changes.
