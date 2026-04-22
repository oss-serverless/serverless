'use strict';

const readline = require('node:readline/promises');

const parseConfirm = (value, defaultValue = true) => {
  const answer = String(value || '')
    .trim()
    .toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === 'y' || answer === 'yes';
};

const promptOne = async ({ message, type, name, default: defaultValue = true }) => {
  if (type !== 'confirm') {
    throw new Error(`Unsupported prompt type: ${type}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`? ${message} (${defaultValue ? 'Y/n' : 'y/N'}) `);
    return { [name]: parseConfirm(answer, defaultValue) };
  } finally {
    rl.close();
  }
};

const prompt = async (questionConfig) => {
  const questions = Array.isArray(questionConfig) ? questionConfig : [questionConfig];
  const answers = {};

  for (const question of questions) {
    Object.assign(answers, await promptOne(question));
  }

  return answers;
};

module.exports = {
  prompt,
  createPromptModule() {
    return prompt;
  },
};
