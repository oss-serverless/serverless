'use strict';

module.exports = async (modPath) => {
  try {
    const mod = require(modPath);
    return mod && mod.default ? mod.default : mod;
  } catch (error) {
    if (error.code === 'ERR_REQUIRE_ESM') {
      return (await import(`file://${modPath}`)).default;
    }
    throw error;
  }
};
