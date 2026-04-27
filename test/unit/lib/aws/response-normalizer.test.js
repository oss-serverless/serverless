'use strict';

const { Readable } = require('stream');
const chai = require('chai');

const { expect } = chai;

describe('test/unit/lib/aws/response-normalizer.test.js', () => {
  const { normalizeV3Response } = require('../../../../lib/aws/response-normalizer');

  it('converts S3 getObject readable bodies to buffers', async () => {
    const response = await normalizeV3Response('S3', 'getObject', {
      Body: Readable.from(['hello']),
      $metadata: { requestId: 'request-id' },
    });

    expect(Buffer.isBuffer(response.Body)).to.equal(true);
    expect(String(response.Body)).to.equal('hello');
    expect(response).to.not.have.property('$metadata');
  });

  it('converts S3 getObject transformToByteArray bodies to buffers', async () => {
    const response = await normalizeV3Response('S3', 'getObject', {
      Body: { transformToByteArray: async () => Uint8Array.from(Buffer.from('hello')) },
    });

    expect(Buffer.isBuffer(response.Body)).to.equal(true);
    expect(String(response.Body)).to.equal('hello');
  });

  it('converts Lambda invoke Uint8Array payloads to buffers', async () => {
    const response = await normalizeV3Response('Lambda', 'invoke', {
      Payload: Uint8Array.from(Buffer.from('{"ok":true}')),
      StatusCode: 200,
      $metadata: { requestId: 'request-id' },
    });

    expect(Buffer.isBuffer(response.Payload)).to.equal(true);
    expect(String(response.Payload)).to.equal('{"ok":true}');
    expect(response).to.deep.equal({ Payload: response.Payload, StatusCode: 200 });
  });
});
