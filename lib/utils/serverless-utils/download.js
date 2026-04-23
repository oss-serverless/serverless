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
const { Agent } = require('undici');
const contentDisposition = require('content-disposition');
const archiveType = require('archive-type');
const decompress = require('decompress');
const filenamify = require('filenamify');
const extName = require('ext-name');

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

const filenameFromPath = (requestUrl) => path.basename(new URL(requestUrl).pathname);

const getExtFromMime = (headers) => {
  const header = headers['content-type'];

  if (!header) {
    return null;
  }

  const exts = extName.mime(header);

  if (exts.length !== 1) {
    return null;
  }

  return exts[0].ext;
};

const getFilename = ({ requestUrl, headers, data, explicitFilename }) => {
  if (explicitFilename) {
    return explicitFilename;
  }

  const header = headers['content-disposition'];

  if (header) {
    const parsed = contentDisposition.parse(header);

    if (parsed.parameters && parsed.parameters.filename) {
      return parsed.parameters.filename;
    }
  }

  let filename = filenameFromPath(requestUrl);

  if (!path.extname(filename)) {
    const archive = archiveType(data);
    const ext = (archive && archive.ext) || getExtFromMime(headers);

    if (ext) {
      filename = `${filename}.${ext}`;
    }
  }

  return filename;
};

const fetchWithRedirects = async (
  requestUrl,
  { headers, dispatcher, signal, maxRedirects = 10, allowedAuthRedirectHostnames = [] } = {}
) => {
  let currentUrl = new URL(requestUrl);
  // Use the platform header parser so redirect auth checks see normalized names and values.
  let currentHeaders = Object.fromEntries(new globalThis.Headers(headers).entries());
  const allowedAuthHostnames = new Set(allowedAuthRedirectHostnames);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      headers: currentHeaders,
      dispatcher,
      signal,
      redirect: 'manual',
    });

    if (!redirectStatusCodes.has(response.status)) {
      return response;
    }

    try {
      if (redirectCount === maxRedirects) {
        throw new Error('Too many redirects');
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Redirect response missing location header: ${response.status}`);
      }

      const nextUrl = new URL(location, currentUrl);
      // Never forward credentials to a different origin unless the redirect target is allowlisted.
      if (
        currentHeaders.authorization &&
        nextUrl.origin !== currentUrl.origin &&
        !allowedAuthHostnames.has(nextUrl.hostname)
      ) {
        currentHeaders = { ...currentHeaders };
        delete currentHeaders.authorization;
      }

      currentUrl = nextUrl;
    } finally {
      // Manual redirects leave the intermediate response open unless we release it ourselves.
      try {
        await response.body?.cancel();
      } catch {
        // Ignore cleanup errors and preserve the primary redirect failure, if any.
      }
    }
  }

  throw new Error('Too many redirects');
};

module.exports = (uri, output, opts) => {
  return (async () => {
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

    const headers = { ...(opts.headers || {}) };
    if (opts.username || opts.password) {
      headers.authorization = `Basic ${Buffer.from(
        `${opts.username || ''}:${opts.password || ''}`
      ).toString('base64')}`;
    }

    const dispatcher =
      opts.https && opts.https.rejectUnauthorized === false
        ? new Agent({ connect: { rejectUnauthorized: false } })
        : undefined;

    const response = await fetchWithRedirects(uri, {
      headers,
      dispatcher,
      signal: typeof opts.timeout === 'number' ? AbortSignal.timeout(opts.timeout) : undefined,
      maxRedirects: opts.maxRedirects,
      allowedAuthRedirectHostnames: opts.allowedAuthRedirectHostnames,
    });

    if (!response.ok) {
      throw new Error(`Unexpected download response: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const data = opts.responseType === 'buffer' ? buffer : buffer.toString(opts.encoding || 'utf8');
    const archive = archiveType(buffer);

    if (!output) {
      return opts.extract && archive ? decompress(buffer, opts) : data;
    }

    if (opts.extract && archive) {
      return decompress(buffer, output, opts);
    }

    const responseHeaders = Object.fromEntries(response.headers);
    const filename = filenamify(
      getFilename({
        requestUrl: response.url,
        headers: responseHeaders,
        data: buffer,
        explicitFilename: opts.filename,
      })
    );
    const outputFilepath = path.join(output, filename);

    await fsp.mkdir(path.dirname(outputFilepath), { recursive: true });
    await fsp.writeFile(outputFilepath, data);

    return data;
  })();
};
