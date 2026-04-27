'use strict';

async function collectSdkStreamBody(body) {
  if (!body) return body;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);

  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  if (typeof body.transformToString === 'function') {
    return Buffer.from(await body.transformToString());
  }

  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return body;
}

async function normalizeV3Response(serviceName, methodName, response) {
  if (!response || typeof response !== 'object') return response;

  const normalized = { ...response };
  delete normalized.$metadata;

  if (serviceName === 'S3' && methodName === 'getObject' && normalized.Body) {
    normalized.Body = await collectSdkStreamBody(normalized.Body);
  }

  if (serviceName === 'Lambda' && methodName === 'invoke' && normalized.Payload) {
    if (normalized.Payload instanceof Uint8Array && !Buffer.isBuffer(normalized.Payload)) {
      normalized.Payload = Buffer.from(normalized.Payload);
    }
  }

  return normalized;
}

module.exports = {
  collectSdkStreamBody,
  normalizeV3Response,
};
