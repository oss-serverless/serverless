'use strict';

const sinon = require('sinon');

const validatedTypes = new Set(['input', 'password']);

module.exports = (inquirer, config) => {
  const resolveAnswer = (promptConfig) => {
    return new Promise((resolve) => {
      const configType = promptConfig.type || 'input';
      const questions = config[configType];
      if (!questions) throw new Error(`Unexpected config type: ${configType}`);
      let answer = questions[promptConfig.name];
      if (answer == null) throw new Error(`Unexpected config name: ${promptConfig.name}`);
      if (configType === 'list') {
        if (
          !promptConfig.choices.some((choice) => {
            if (typeof choice === 'string') return choice === answer;
            if (choice.name === answer || choice.value === answer) {
              answer = choice.value;
              return true;
            }
            return false;
          })
        ) {
          throw new Error(`Unsupported list result: ${answer}`);
        }
      }

      resolve(
        new Promise((resolveValidation) => {
          if (!validatedTypes.has(promptConfig.type)) return resolveValidation(true);
          if (!promptConfig.validate) return resolveValidation(true);
          return resolveValidation(promptConfig.validate(answer));
        }).then((validationResult) => {
          if (validationResult !== true) {
            throw Object.assign(new Error(validationResult), { code: 'INVALID_ANSWER' });
          }
          return { [promptConfig.name]: answer };
        })
      );
    });
  };

  if (inquirer.prompt.restore) inquirer.prompt.restore();
  if (inquirer.createPromptModule.restore) inquirer.createPromptModule.restore();

  sinon.stub(inquirer, 'prompt').callsFake((promptConfig) => {
    if (!Array.isArray(promptConfig)) return resolveAnswer(promptConfig);
    const result = {};
    return promptConfig.reduce(
      (previusPromptDeferred, nextPromptConfig) =>
        previusPromptDeferred.then((answer) => {
          Object.assign(result, answer);
          return resolveAnswer(nextPromptConfig);
        }),
      Promise.resolve({})
    );
  });

  sinon.stub(inquirer, 'createPromptModule').callsFake(() => inquirer.prompt);
  return inquirer;
};
