'use strict';

const isYamlPath = (filePath) => filePath.endsWith('.yml') || filePath.endsWith('.yaml');

module.exports = isYamlPath;
