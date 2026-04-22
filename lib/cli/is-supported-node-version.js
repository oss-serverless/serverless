'use strict';

module.exports = (version) => {
  const major = Number(version.split('.')[0].slice(1));
  const minor = Number(version.split('.')[1]);

  return major > 20 || (major === 20 && minor >= 0);
};
