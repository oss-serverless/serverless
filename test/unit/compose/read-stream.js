'use strict';

/**
 * @param {NodeJS.WritableStream} stream
 * @return {Promise<string>}
 */
async function readStream(stream) {
  stream.end();
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

module.exports = readStream;
