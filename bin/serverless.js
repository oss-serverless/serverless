#!/usr/bin/env node

// WARNING: Do not use syntax not supported by old Node.js versions (v4 lowest)
// It's to ensure that users running those versions, see properly the error message
// (as constructed below) instead of the syntax error

'use strict';

// `EvalError` is used to not pollute global namespace but still have the value accessible globally
// Can already be set, if we're in context of local fallback
const isMainModule = !EvalError.$serverlessCommandStartTime;
if (isMainModule) EvalError.$serverlessCommandStartTime = process.hrtime();

const nodeVersionMajor = Number(process.version.split('.')[0].slice(1));
const nodeVersionMinor = Number(process.version.split('.')[1]);
const minimumSupportedVersionMajor = 14;
const minimumSupportedVersionMinor = 0;

if (
  nodeVersionMajor < minimumSupportedVersionMajor ||
  (nodeVersionMajor === minimumSupportedVersionMajor &&
    nodeVersionMinor < minimumSupportedVersionMinor)
) {
  const serverlessVersion = Number(require('../package.json').version.split('.')[0]);
  process.stderr.write(
    `\x1b[91mError: Serverless Framework v${serverlessVersion} does not support ` +
      `Node.js ${process.version}. Please upgrade Node.js to the latest ` +
      `LTS version (v${minimumSupportedVersionMajor}.${minimumSupportedVersionMinor}.0 is a minimum supported version)\x1b[39m\n`
  );
  process.exit(1);
}

if (isMainModule) {
  if (require('../lib/utils/is-standalone-executable')) {
    require('../lib/utils/standalone-patch');
  }
}

require('../lib/cli/triage')().then((cliName) => {
  switch (cliName) {
    case 'serverless':
      require('../scripts/serverless');
      return;
    case '@serverless/compose':
      require('../lib/cli/run-compose')().catch((error) => {
        // Expose eventual resolution error as regular crash, and not unhandled rejection
        process.nextTick(() => {
          throw error;
        });
      });
      return;
    default:
      throw new Error(`Unrecognized CLI name "${cliName}"`);
  }
});
