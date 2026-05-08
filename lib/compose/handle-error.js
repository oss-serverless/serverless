'use strict';

const slscVersion = require('../../package').version;
const tokenizeException = require('../utils/tokenize-exception');
const { red, stderrCliColors } = require('./cli/colors');

/**
 * @param {import('./cli/Output')} output
 */
module.exports = (exception, output) => {
  const exceptionTokens = tokenizeException(exception);
  const isUserError = exceptionTokens.isUserError;

  const platform = process.platform;
  const nodeVersion = process.version.replace(/^[v|V]/, '');

  const detailsTextTokens = [
    `Environment: ${platform}, node ${nodeVersion}, compose ${slscVersion}`,
  ];

  output.log(stderrCliColors.gray(detailsTextTokens.join('\n')));
  output.log();

  const shouldShowStackTrace = exceptionTokens.stack && !isUserError;
  if (shouldShowStackTrace) {
    // Only show the stack trace for "programmer" errors (i.e. not user errors)
    output.writeText(`${red('Error:')}\n${exceptionTokens.stack}`);
  } else {
    output.writeText(`${red('Error:')}\n${exceptionTokens.message}`);
    if (exceptionTokens.stack) {
      // Log the stack trace to verbose so that users can always debug further if needed
      output.verbose(exceptionTokens.stack);
    }
  }

  output.log();
  output.log(stderrCliColors.gray('Verbose logs are available in ".serverless/compose.log"'));

  process.exitCode = 1;
};
