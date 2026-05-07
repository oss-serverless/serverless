'use strict';

const { stdoutColors, stderrColors } = require('../utils/colors');

const createCliPalette = (colors) => ({
  foreground: colors.reset,
  gray: colors.gray,
  red: colors.brandRed,
  warning: colors.warning,
  white: colors.white,
});

const stdoutCliColors = createCliPalette(stdoutColors);
const stderrCliColors = createCliPalette(stderrColors);

module.exports = {
  ...stdoutCliColors,
  stdoutCliColors,
  stderrCliColors,
};
