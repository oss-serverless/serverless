#!/usr/bin/env node

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const DIRECT_SERVERLESS_FILE_WHITELIST = new Set([
  'test/unit/lib/classes/cli.test.js',
  'test/unit/lib/classes/config.test.js',
  'test/unit/lib/classes/config-schema-handler/index.test.js',
  'test/unit/lib/classes/plugin-manager.test.js',
  'test/unit/lib/serverless.test.js',
]);

const args = process.argv.slice(2);
const hasArg = (name) => args.includes(name);
const getArgValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

const isJson = hasArg('--json');
const isRatchet = hasArg('--ratchet');
const baseRef = getArgValue('--base-ref') || process.env.TEST_MIGRATION_BASE_REF || null;

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const run = (command, commandArgs) =>
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const listCurrentTestFiles = (directory) => {
  const entries = fs.readdirSync(path.join(repoRoot, directory), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listCurrentTestFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) files.push(entryPath);
  }

  return files;
};

const listFiles = (ref = null) => {
  if (!ref) return listCurrentTestFiles('test/unit').sort();

  const output = run('git', ['ls-tree', '-r', '--name-only', ref, '--', 'test/unit']);
  return output
    .trim()
    .split('\n')
    .filter((file) => file.endsWith('.test.js'))
    .sort();
};

const readFile = (file, ref = null) => {
  if (!ref) return fs.readFileSync(path.join(repoRoot, file), 'utf8');
  return run('git', ['show', `${ref}:${file}`]);
};

const sortSet = (set) => [...set].sort();

const analyze = (ref = null) => {
  const files = listFiles(ref);
  const runServerless = new Set();
  const direct = new Set();
  const proxyquire = new Set();
  const fixtureWrapper = new Set();
  const awsRequest = new Set();
  const awsSdkV3 = new Set();
  const awsProviderSetup = new Set();
  const awsPluginConstruction = new Set();
  const coreClassConstruction = new Set();
  const initCalls = new Set();

  for (const file of files) {
    const content = readFile(file, ref);
    const has = (pattern) => pattern.test(content);

    if (has(/\brunServerless\b|run-serverless/)) runServerless.add(file);
    if (has(/\bnew\s+Serverless\s*\(/)) direct.add(file);
    if (has(/\bproxyquire\b|require\(['"]proxyquire['"]\)/)) proxyquire.add(file);
    if (
      has(
        /require\([^\n)]*fixtures\/programmatic['"]\)|\b(?:fixtures|fixturesEngine|programmaticFixturesEngine)\.setup\s*\(/
      )
    ) {
      fixtureWrapper.add(file);
    }
    if (has(/\bawsRequestStubMap\b/)) awsRequest.add(file);
    if (has(/\bawsSdkV3StubMap\b/)) awsSdkV3.add(file);
    if (has(/\bnew\s+AwsProvider\s*\(|\.setProvider\(['"]aws['"]\s*,/)) {
      awsProviderSetup.add(file);
    }
    if (has(/\bnew\s+Aws[A-Z][A-Za-z0-9_]*\s*\(/)) awsPluginConstruction.add(file);
    if (has(/\bnew\s+(CLI|Config|PluginManager)\s*\(/)) coreClassConstruction.add(file);
    if (has(/\.init\s*\(/)) initCalls.add(file);
  }

  const mixed = files.filter((file) => runServerless.has(file) && direct.has(file));
  const directOnly = files.filter((file) => direct.has(file) && !runServerless.has(file));
  const approvedDirectOnly = directOnly.filter((file) =>
    DIRECT_SERVERLESS_FILE_WHITELIST.has(file)
  );
  const unapprovedDirectOnly = directOnly.filter(
    (file) => !DIRECT_SERVERLESS_FILE_WHITELIST.has(file)
  );

  return {
    ref,
    files,
    direct: sortSet(direct),
    proxyquire: sortSet(proxyquire),
    fixtureWrapper: sortSet(fixtureWrapper),
    awsRequest: sortSet(awsRequest),
    awsSdkV3: sortSet(awsSdkV3),
    awsProviderSetup: sortSet(awsProviderSetup),
    awsPluginConstruction: sortSet(awsPluginConstruction),
    coreClassConstruction: sortSet(coreClassConstruction),
    initCalls: sortSet(initCalls),
    mixed,
    directOnly,
    approvedDirectOnly,
    unapprovedDirectOnly,
    directServerlessWhitelist: sortSet(DIRECT_SERVERLESS_FILE_WHITELIST),
    counts: {
      unitTestFiles: files.length,
      runServerlessFiles: runServerless.size,
      directNewServerlessFiles: direct.size,
      mixedFiles: mixed.length,
      directOnlyFiles: directOnly.length,
      approvedDirectOnlyFiles: approvedDirectOnly.length,
      unapprovedDirectOnlyFiles: unapprovedDirectOnly.length,
      proxyquireFiles: proxyquire.size,
      directFixtureFiles: fixtureWrapper.size,
      awsRequestStubMapFiles: awsRequest.size,
      awsSdkV3StubMapFiles: awsSdkV3.size,
      awsProviderSetupFiles: awsProviderSetup.size,
      awsPluginConstructionFiles: awsPluginConstruction.size,
      coreClassConstructionFiles: coreClassConstruction.size,
      initCallFiles: initCalls.size,
    },
  };
};

const getAddedFiles = (currentFiles, baseFiles) => {
  const baseSet = new Set(baseFiles);
  return currentFiles.filter((file) => !baseSet.has(file));
};

const createRatchetResult = (current, base) => {
  const checks = [
    {
      name: 'unapprovedDirectOnly',
      label: 'unapproved direct-only files',
      current: current.unapprovedDirectOnly,
      base: base.unapprovedDirectOnly,
    },
    {
      name: 'fixtureWrapper',
      label: 'direct fixture wrapper files',
      current: current.fixtureWrapper,
      base: base.fixtureWrapper,
    },
    {
      name: 'awsRequest',
      label: 'awsRequestStubMap files',
      current: current.awsRequest,
      base: base.awsRequest,
    },
  ];

  const failures = [];
  for (const check of checks) {
    const added = getAddedFiles(check.current, check.base);
    if (check.current.length <= check.base.length && !added.length) continue;
    failures.push({
      name: check.name,
      label: check.label,
      baseCount: check.base.length,
      currentCount: check.current.length,
      added,
    });
  }

  return {
    baseRef,
    ok: failures.length === 0,
    failures,
  };
};

const printFileList = (title, files, decorate = (file) => file) => {
  console.log(title);
  if (!files.length) {
    console.log('- none');
    return;
  }
  for (const file of files) console.log(`- ${decorate(file)}`);
};

const printHuman = ({ current, base, ratchet }) => {
  console.log('Test migration inventory');
  console.log('');
  for (const [name, count] of Object.entries(current.counts)) {
    console.log(`${name}: ${count}`);
  }
  console.log('');
  printFileList('Direct-only files:', current.directOnly, (file) => {
    if (DIRECT_SERVERLESS_FILE_WHITELIST.has(file)) return `${file} [whitelisted]`;
    return file;
  });
  console.log('');
  printFileList('Direct fixture wrapper files:', current.fixtureWrapper);
  console.log('');
  printFileList('awsRequestStubMap files:', current.awsRequest);

  if (!ratchet) return;

  console.log('');
  console.log(`Ratchet base: ${base.ref}`);
  if (ratchet.ok) {
    console.log('Ratchet result: passed');
    return;
  }

  console.log('Ratchet result: failed');
  for (const failure of ratchet.failures) {
    console.log(
      `- ${failure.label}: ${failure.baseCount} -> ${failure.currentCount}` +
        (failure.added.length ? `; added ${failure.added.join(', ')}` : '')
    );
  }
};

const main = () => {
  if (isRatchet && !baseRef) {
    console.error('Missing --base-ref for --ratchet mode');
    process.exitCode = 2;
    return;
  }

  const current = analyze();
  let base = null;
  let ratchet = null;

  if (isRatchet) {
    base = analyze(baseRef);
    ratchet = createRatchetResult(current, base);
  }

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          cwd: toPosixPath(repoRoot),
          current,
          base,
          ratchet,
        },
        null,
        2
      )
    );
  } else {
    printHuman({ current, base, ratchet });
  }

  if (ratchet && !ratchet.ok) process.exitCode = 1;
};

main();
