'use strict';

const minimist = require('minimist');
const renderHelp = require('./render-help');
const Context = require('./Context');
const ComponentsService = require('./ComponentsService');
const handleError = require('./handle-error');
const { stderrCliColors } = require('./cli/colors');
const resolveConfigurationVariables = require('./configuration/resolve-variables');
const resolveConfigurationPath = require('./configuration/resolve-path');
const readConfiguration = require('./configuration/read');
const { validateConfiguration } = require('./configuration/validate');
const validateOptions = require('./validate-options');
const initializeNodeLogging = require('./utils/serverless-utils/log-reporters/node');
const validateStage = require('./utils/validate-stage');
const { signals } = require('signal-exit/signals');

let options;
let method;
let componentName;
let context;

process.once('uncaughtException', (error) => {
  // Refactor it to not rely heavily on context because it is only needed for logs
  const usedContext = context || new Context({ root: process.cwd() });
  handleError(error, usedContext.output);
});

signals.forEach((signal) => {
  process.once(signal, () => {
    // If there's another listener (e.g. we're in daemon context or reading stdin input)
    // then let the other listener decide how process will exit
    const isOtherSigintListener = Boolean(process.listenerCount(signal));
    if (isOtherSigintListener) return;
    // Follow recommendation from signal-exit:
    // https://github.com/tapjs/signal-exit/blob/654117d6c9035ff6a805db4d4acf1f0c820fcb21/index.js#L97-L98
    if (process.platform === 'win32' && signal === 'SIGHUP') signal = 'SIGINT';
    process.kill(process.pid, signal);
  });
});

const runComponents = async (argv = process.argv.slice(2)) => {
  const args = minimist(argv, { string: ['stage'] });
  initializeNodeLogging({ argv, env: process.env, stdin: process.stdin, stdout: process.stdout });

  if (args.help || args._[0] === 'help') {
    await renderHelp();
    return;
  }

  method = args._;
  if (!method.length) {
    await renderHelp();
    return;
  }
  method = method.join(':');
  options = args;

  if (options.service) {
    componentName = options.service;
    delete options.service;
  } else if (method.includes(':')) {
    let methods;
    [componentName, ...methods] = method.split(':');
    method = methods.join(':');
  }
  delete options._; // remove the method name if any

  validateOptions(options, method);

  const stage = validateStage(options.stage ?? 'dev');

  const configurationPath = await resolveConfigurationPath(process.cwd());
  const configuration = await readConfiguration(configurationPath);
  validateConfiguration(configuration, configurationPath);

  await resolveConfigurationVariables(configuration, configurationPath, stage);

  const contextConfig = {
    root: process.cwd(),
    verbose: options.verbose,
    stage,
    configuration,
  };

  context = new Context(contextConfig);
  await context.init();

  try {
    const componentsService = new ComponentsService(context, configuration, options);
    await componentsService.init();

    // Additionally, we're raising the listener default limit by 1 for each component - we might revisit it in the future
    if (componentName) {
      process.setMaxListeners(process.getMaxListeners() + 1);
      await componentsService.invokeComponentCommand(componentName, method, options);
    } else {
      const numOfComponents = Object.keys(componentsService.allComponents).length;
      process.setMaxListeners(process.getMaxListeners() + numOfComponents);
      await componentsService.invokeGlobalCommand(method, options);
    }

    context.shutdown();

    // If at least one of the internal commands failed, we want to exit with error code 1
    if (Object.values(context.componentCommandsOutcomes).includes('failure')) {
      context.output.log();
      context.output.log(
        stderrCliColors.gray('Verbose logs are available in ".serverless/compose.log"')
      );
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (e) {
    handleError(e, context.output);
    process.exit(1);
  }
};

module.exports = {
  runComponents,
};
