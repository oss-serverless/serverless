// This module is mostly adapted from https://github.com/kevva/download repository

// License of the original module - https://github.com/kevva/download/blob/master/license

// MIT License

// Copyright (c) Kevin Mårtensson <kevinmartensson@gmail.com> (github.com/kevva)

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

const fsp = require('fs').promises;
const path = require('path');
const { URL } = require('url');
const contentDisposition = require('content-disposition');
const archiveType = require('archive-type');
const decompress = require('decompress');
const filenamify = require('filenamify');
const getStream = require('get-stream');
const got = require('got');
const makeDir = require('make-dir');
const pEvent = require('p-event');
const FileType = require('file-type');
const extName = require('ext-name');

const filenameFromPath = (res) => path.basename(new URL(res.requestUrl).pathname);

const getExtFromMime = (res) => {
  const header = res.headers['content-type'];

  if (!header) {
    return null;
  }

  const exts = extName.mime(header);

  if (exts.length !== 1) {
    return null;
  }

  return exts[0].ext;
};

const getFilename = async (res, data) => {
  const header = res.headers['content-disposition'];

  if (header) {
    const parsed = contentDisposition.parse(header);

    if (parsed.parameters && parsed.parameters.filename) {
      return parsed.parameters.filename;
    }
  }

  let filename = filenameFromPath(res);

  if (!path.extname(filename)) {
    const ext = ((await FileType.fromBuffer(data)) || {}).ext || getExtFromMime(res);

    if (ext) {
      filename = `${filename}.${ext}`;
    }
  }

  return filename;
};

module.exports = (uri, output, opts) => {
  if (typeof output === 'object') {
    opts = output;
    output = null;
  }

  opts = Object.assign(
    {
      https: {
        rejectUnauthorized: process.env.npm_config_strict_ssl !== 'false',
      },
      responseType: 'buffer',
    },
    opts
  );

  const stream = got.stream(uri, opts);

  const promise = pEvent(stream, 'response')
    .then((res) => {
      const encoding = opts.responseType === 'buffer' ? 'buffer' : opts.encoding;
      return Promise.all([getStream(stream, { encoding }), res]);
    })
    .then(async (result) => {
      const [data, res] = result;

      if (!output) {
        return opts.extract && archiveType(data) ? decompress(data, opts) : data;
      }

      const filename = opts.filename || filenamify(await getFilename(res, data));
      const outputFilepath = path.join(output, filename);

      if (opts.extract && archiveType(data)) {
        return decompress(data, path.dirname(outputFilepath), opts);
      }

      return makeDir(path.dirname(outputFilepath))
        .then(() => fsp.writeFile(outputFilepath, data))
        .then(() => data);
    });

  stream.then = promise.then.bind(promise);
  stream.catch = promise.catch.bind(promise);

  return stream;
};
