'use strict';

const fs = require('node:fs');
const path = require('node:path');
const fastGlob = require('fast-glob');

const toArray = (patterns) => {
  return Array.isArray(patterns) ? patterns : [patterns];
};

const isDynamicPattern = (pattern) => /[*?{}()[\]]/.test(pattern);

const maybeExpandDirectoryPattern = (pattern, cwd) => {
  if (isDynamicPattern(pattern)) {
    return pattern;
  }

  const absolutePattern = path.resolve(cwd || process.cwd(), pattern);
  try {
    if (fs.statSync(absolutePattern).isDirectory()) {
      const normalizedPattern = pattern.replace(/\\/g, '/').replace(/\/$/, '');
      return `${normalizedPattern}/**/*`;
    }
  } catch {
    // Ignore missing paths and let fast-glob handle them.
  }

  return pattern;
};

const expandPattern = (pattern, cwd, expandDirectories) => {
  if (!expandDirectories) {
    return pattern;
  }

  if (pattern.startsWith('!')) {
    return `!${maybeExpandDirectoryPattern(pattern.slice(1), cwd)}`;
  }

  return maybeExpandDirectoryPattern(pattern, cwd);
};

const normalizeOptions = (options = {}) => {
  const globOptions = { ...options };
  const expandDirectories =
    globOptions.expandDirectories !== undefined ? globOptions.expandDirectories : true;

  delete globOptions.expandDirectories;
  delete globOptions.nosort;

  if (globOptions.follow !== undefined) {
    globOptions.followSymbolicLinks = globOptions.follow;
    delete globOptions.follow;
  }

  if (globOptions.nodir !== undefined) {
    globOptions.onlyFiles = globOptions.nodir;
    delete globOptions.nodir;
  }

  if (globOptions.silent !== undefined) {
    globOptions.suppressErrors = globOptions.silent;
    delete globOptions.silent;
  }

  return { expandDirectories, globOptions };
};

const buildTasks = (patterns, globOptions) => {
  const tasks = [];
  const leadingIgnore = [];

  for (const pattern of patterns) {
    if (!pattern.startsWith('!')) {
      break;
    }

    leadingIgnore.push(pattern.slice(1));
  }

  for (let index = 0; index < patterns.length; index += 1) {
    const pattern = patterns[index];
    if (pattern.startsWith('!')) {
      continue;
    }

    const ignore = patterns
      .slice(index)
      .filter((value) => value.startsWith('!'))
      .map((value) => value.slice(1));

    tasks.push({
      pattern,
      options: {
        ...globOptions,
        ignore: [...(globOptions.ignore || []), ...(tasks.length ? [] : leadingIgnore), ...ignore],
      },
    });
  }

  return tasks;
};

const collectResults = async (tasks) => {
  const seen = new Set();
  const results = [];

  for (const task of tasks) {
    for (const entry of await fastGlob(task.pattern, task.options)) {
      if (seen.has(entry)) {
        continue;
      }

      seen.add(entry);
      results.push(entry);
    }
  }

  return results;
};

const collectResultsSync = (tasks) => {
  const seen = new Set();
  const results = [];

  for (const task of tasks) {
    for (const entry of fastGlob.sync(task.pattern, task.options)) {
      if (seen.has(entry)) {
        continue;
      }

      seen.add(entry);
      results.push(entry);
    }
  }

  return results;
};

const glob = async (patterns, options = {}) => {
  const normalizedPatterns = toArray(patterns);
  const { expandDirectories, globOptions } = normalizeOptions(options);
  const expandedPatterns = normalizedPatterns.map((pattern) =>
    expandPattern(pattern, globOptions.cwd, expandDirectories)
  );

  return collectResults(buildTasks(expandedPatterns, globOptions));
};

glob.sync = (patterns, options = {}) => {
  const normalizedPatterns = toArray(patterns);
  const { expandDirectories, globOptions } = normalizeOptions(options);
  const expandedPatterns = normalizedPatterns.map((pattern) =>
    expandPattern(pattern, globOptions.cwd, expandDirectories)
  );

  return collectResultsSync(buildTasks(expandedPatterns, globOptions));
};

module.exports = glob;
