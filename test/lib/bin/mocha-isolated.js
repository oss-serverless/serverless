#!/usr/bin/env node

'use strict';

require('essentials');

const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2), {
  boolean: [
    'bail',
    'help',
    'pass-through-aws-creds',
    'recursive',
    'skip-fs-cleanup-check',
    'version',
  ],
  string: ['require'],
  alias: { 'help': 'h', 'version': 'v', 'max-workers': 'w', 'bail': 'b' },
  unknown: (arg) => {
    if (arg[0] !== '-') return;
    process.stdout.write(chalk.red.bold(`Unrecognized option ${arg}\n\n`));
    process.exit(1);
  },
});

const usage = `Usage: mocha-isolated [<options>...] [<spec>...]

Runs tests with mocha, each test is run in individual Node.js process

Options:

  --help,                   -h  Show this message
  --version,                -v  Print the version and exit

  --bail,                   -b  Bail gently after first approached test fail
  --pass-through-aws-creds      Pass through AWS env credentials
  --max-workers             -w  Maximum allowed number of workers for concurrent run
  --recursive                   Look for tests in subdirectories
  --skip-fs-cleanup-check       Do not check on modified files (allows parallel runs)
  --require                     Mocha's "require" option (passed through to Mocha)
`;

if (argv.help) {
  process.stdout.write(usage);
  return;
}

if (argv.version) {
  process.stdout.write(`${require('../package').version}\n`);
  return;
}

const spawn = require('child-process-ext/spawn');
const pLimit = require('p-limit');
const mochaCollectFiles = require('mocha/lib/cli/collect-files');
const resolveEnv = require('../resolve-env');
const resolveAwsEnv = require('../resolve-aws-env');

const filePatterns = argv._;
if (!filePatterns.length) filePatterns.push('!(node_modules)/**/*.test.js', '*.test.js');

const resolveGitStatus = () =>
  spawn('git', ['status', '--porcelain']).then(
    ({ stdoutBuffer }) => String(stdoutBuffer),
    (error) => {
      process.stdout.write(error.stdBuffer);
      throw error;
    }
  );

const initialGitStatusDeferred = !argv['skip-fs-cleanup-check'] ? resolveGitStatus() : null;

const initialSetupDeferred = !argv['skip-fs-cleanup-check']
  ? initialGitStatusDeferred
  : Promise.resolve();

const cwdPathLength = process.cwd().length + 1;
const collectResult = mochaCollectFiles({
  ignore: [],
  extension: ['js'],
  file: [],
  recursive: argv.recursive,
  spec: filePatterns,
});
// Mocha 11+ returns {files: [], unmatchedFiles: []}, earlier versions return array directly
const filesList = collectResult.files || collectResult;
const paths = filesList.map((filename) => filename.slice(cwdPathLength));

if (!paths.length) {
  process.stdout.write(chalk.red.bold('No test files matched\n\n'));
  process.exit(1);
}

const processesCount = (() => {
  if (!argv['skip-fs-cleanup-check']) return 1;
  const forced = Number(argv.w);
  if (forced > 0) return Math.min(forced, paths.length);
  return Math.min(Math.max(require('os').cpus().length - 1, 1), paths.length);
})();

const isMultiProcessRun = processesCount > 1;

const { ongoingPaths, cliFooter } = (() => {
  if (!isMultiProcessRun) return {};
  return { ongoingPaths: new Set(), cliFooter: require('cli-progress-footer')() };
})();

const failed = [];
process.on('exit', () => {
  if (!failed.length) return;
  process.stdout.write('\n');
  for (const testPath of failed) process.stdout.write(chalk.red.bold(`${testPath} failed\n`));
});

let shouldAbort = false;
let pendingCount = paths.length;
const ongoingProcesses = new Set();
const run = (path) => {
  --pendingCount;
  if (shouldAbort) return null;

  const env = argv['pass-through-aws-creds'] ? resolveAwsEnv() : resolveEnv();
  env.FORCE_COLOR = '1';
  const mochaArgs = [];
  if (argv.require) mochaArgs.push('--require', argv.require);
  const testPromise = spawn('node', [require.resolve('mocha/bin/_mocha'), ...mochaArgs, path], {
    stdio: isMultiProcessRun ? null : 'inherit',
    env,
  });

  if (isMultiProcessRun) {
    ongoingPaths.add(path);
    cliFooter.updateProgress(Array.from(ongoingPaths));
    ongoingProcesses.add(testPromise);
  }

  const onFinally = (() => {
    if (isMultiProcessRun) {
      return ({ stdBuffer }) => {
        ongoingProcesses.delete(testPromise);
        ongoingPaths.delete(path);
        cliFooter.updateProgress(Array.from(ongoingPaths));
        if (!pendingCount && !ongoingProcesses.size) return Promise.resolve();
        process.stdout.write(stdBuffer);
        if (!pendingCount && ongoingProcesses.size === 1) {
          cliFooter.updateProgress();
          const lastProcess = ongoingProcesses[Symbol.iterator]().next().value;
          process.stdout.write(lastProcess.stdBuffer);
          lastProcess.std.pipe(process.stdout);
        }
        return Promise.resolve();
      };
    }
    if (argv['skip-fs-cleanup-check']) return () => Promise.resolve();
    return () =>
      Promise.all([initialGitStatusDeferred, resolveGitStatus()]).then(
        ([initialStatus, currentStatus]) => {
          if (initialStatus !== currentStatus) {
            process.stdout.write(
              chalk.red.bold(`${path} didn't clean created temporary files\n\n`)
            );
            failed.push(path);
            process.exitCode = 1;
            shouldAbort = true;
          }
        }
      );
  })();

  return testPromise.then(onFinally, (error) =>
    onFinally(error).then(() => {
      failed.push(path);
      process.stdout.write(`${chalk.red.bold(error.message)}\n\n`);
      process.stdout.write(`${chalk.red.bold(`${path} failed`)}\n\n`);
      process.exitCode = 1;
      if (argv.bail) shouldAbort = true;
    })
  );
};

const limit = pLimit(processesCount);
initialSetupDeferred.then(() => Promise.all(paths.map((path) => limit(() => run(path)))));
