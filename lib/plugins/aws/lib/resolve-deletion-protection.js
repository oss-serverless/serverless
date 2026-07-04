'use strict';

module.exports = (provider, stage) => {
  const deletionProtection = provider.deletionProtection;

  if (deletionProtection == null) return undefined;
  if (typeof deletionProtection === 'boolean') return deletionProtection;

  return deletionProtection.stages.includes(stage);
};
