'use strict';

const { version } = require('../../package.json');
const Output = require('./cli/Output');
const colors = require('./cli/colors');

const commands = [
  {
    command: 'deploy',
    description: 'Deploy all services',
  },
  {
    command: 'remove',
    description: 'Remove all services',
  },
  {
    command: 'info',
    description: 'Display information about deployed services',
  },
  {
    command: 'logs',
    description: 'Output the logs for all services',
    options: {
      tail: 'Tail the log in real time',
    },
  },
  {
    command: 'outputs',
    description: 'Display outputs of deployed services',
  },
  {
    command: 'refresh-outputs',
    description: 'Refresh the outputs for all services',
  },
];

function formatLine(commandOrOption, description) {
  const indentFillLength = 25;
  const spacing = ' '.repeat(indentFillLength - commandOrOption.length);
  return `${commandOrOption} ${spacing} ${colors.gray(description)}`;
}

module.exports = async () => {
  const output = new Output(false);
  output.writeText(`Serverless Framework Compose v${version}`);
  output.writeText();
  output.writeText(colors.gray('Usage'));
  output.writeText('serverless <command> <options>');
  output.writeText();
  output.writeText(colors.gray('Service-specific commands'));
  output.writeText('serverless <command> <options> --service=<service-name>');
  output.writeText(colors.gray('or the shortcut:'));
  output.writeText('serverless <service-name>:<command> <options>');
  output.writeText();
  output.writeText(colors.gray('Examples'));
  output.writeText('serverless deploy function --service=service-a --function=handler');
  output.writeText('serverless service-a:invoke:local --function=handler');
  output.writeText();
  output.writeText(colors.gray('Global options'));
  output.writeText(formatLine('--verbose', 'Enable verbose logs'));
  output.writeText(formatLine('--stage', 'Stage of the service'));
  output.writeText(
    formatLine(
      '--max-concurrency',
      'Specify the maximum number of concurrently running service commands'
    )
  );
  output.writeText();
  output.writeText(colors.gray('Commands'));

  for (const command of commands) {
    output.writeText(formatLine(command.command, command.description));
    Object.entries(command.options || {}).forEach(([key, desc]) => {
      output.writeText(formatLine(`  --${key}`, desc));
    });
  }
  output.writeText();
};
