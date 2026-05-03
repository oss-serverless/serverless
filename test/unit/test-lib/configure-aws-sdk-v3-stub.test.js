'use strict';

const { expect } = require('chai');
const configureAwsSdkV3Stub = require('../../lib/configure-aws-sdk-v3-stub');

describe('test/unit/test-lib/configure-aws-sdk-v3-stub.test.js', () => {
  it('stubs client commands and records send context', async () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub({
      S3: {
        headBucket: { BucketRegion: 'us-east-1' },
      },
    });
    const { S3Client, HeadBucketCommand } = awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-s3'];

    const client = new S3Client({ region: 'us-east-1' });
    const result = await client.send(new HeadBucketCommand({ Bucket: 'bucket' }));

    expect(result).to.deep.equal({ BucketRegion: 'us-east-1' });
    expect(awsSdkV3Stub.clients).to.have.length(1);
    expect(awsSdkV3Stub.clients[0]).to.include({ service: 'S3', client });
    expect(awsSdkV3Stub.sends).to.have.length(1);
    expect(awsSdkV3Stub.sends[0]).to.include({
      service: 'S3',
      method: 'headBucket',
      commandName: 'HeadBucketCommand',
      client,
    });
    expect(awsSdkV3Stub.sends[0].input).to.deep.equal({ Bucket: 'bucket' });
  });

  it('routes paginator pages through client send with continuation tokens', async () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub({
      S3: {
        listObjectsV2: [
          { Contents: [{ Key: 'first' }], NextContinuationToken: 'next-page' },
          { Contents: [{ Key: 'second' }] },
        ],
      },
    });
    const { S3Client, ListObjectsV2Command, paginateListObjectsV2 } =
      awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-s3'];
    const client = new S3Client({ region: 'us-east-1' });

    const pages = [];
    for await (const page of paginateListObjectsV2(
      { client },
      { Bucket: 'bucket', Prefix: 'prefix' }
    )) {
      pages.push(page);
    }

    expect(pages).to.deep.equal([
      { Contents: [{ Key: 'first' }], NextContinuationToken: 'next-page' },
      { Contents: [{ Key: 'second' }] },
    ]);
    expect(awsSdkV3Stub.sends).to.have.length(2);
    expect(awsSdkV3Stub.sends[0].command).to.be.instanceOf(ListObjectsV2Command);
    expect(awsSdkV3Stub.sends[0].input).to.deep.equal({
      Bucket: 'bucket',
      Prefix: 'prefix',
    });
    expect(awsSdkV3Stub.sends[1].input).to.deep.equal({
      Bucket: 'bucket',
      Prefix: 'prefix',
      ContinuationToken: 'next-page',
    });
  });

  it('supports SDK v3 clients used during variable resolution', async () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub({
      CloudFormation: { describeStacks: { Stacks: [] } },
      S3: { getObject: { Body: 'body' } },
      SSM: { getParameter: { Parameter: { Type: 'String', Value: 'value' } } },
      STS: { getCallerIdentity: { Account: '123456789012' } },
    });
    const { CloudFormationClient, DescribeStacksCommand } =
      awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-cloudformation'];
    const { S3Client, GetObjectCommand } = awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-s3'];
    const { SSMClient, GetParameterCommand } = awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-ssm'];
    const { STSClient, GetCallerIdentityCommand } =
      awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-sts'];
    const credentials = async () => ({ accessKeyId: 'key', secretAccessKey: 'secret' });

    await new CloudFormationClient({ credentials }).send(
      new DescribeStacksCommand({ StackName: 'stack' })
    );
    await new S3Client({ credentials }).send(
      new GetObjectCommand({ Bucket: 'bucket', Key: 'key' })
    );
    await new SSMClient({ credentials }).send(new GetParameterCommand({ Name: 'param' }));
    await new STSClient({ credentials }).send(new GetCallerIdentityCommand({}));

    expect(awsSdkV3Stub.sends.map(({ service, method }) => `${service}.${method}`)).to.deep.equal([
      'CloudFormation.describeStacks',
      'S3.getObject',
      'SSM.getParameter',
      'STS.getCallerIdentity',
    ]);
    expect(awsSdkV3Stub.clients.map(({ config }) => config.credentials)).to.deep.equal([
      credentials,
      credentials,
      credentials,
      credentials,
    ]);
  });

  it('throws a clear error for missing method stubs', async () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub({ S3: {} });
    const { S3Client, HeadBucketCommand } = awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-s3'];
    const client = new S3Client({});

    await expect(client.send(new HeadBucketCommand({ Bucket: 'bucket' }))).to.be.rejectedWith(
      'Missing AWS SDK v3 stub configuration for S3.headBucket'
    );
  });

  it('requires paginator config to include a client send function', async () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub({
      S3: { listObjectsV2: { Contents: [] } },
    });
    const { paginateListObjectsV2 } = awsSdkV3Stub.modulesCacheStub['@aws-sdk/client-s3'];

    await expect(
      (async () => {
        for await (const ignored of paginateListObjectsV2({}, { Bucket: 'bucket' })) {
          void ignored;
        }
      })()
    ).to.be.rejectedWith(
      'AWS SDK v3 stub paginator paginateListObjectsV2 requires config.client.send'
    );
  });

  it('rejects unsupported explicit services', () => {
    expect(() => configureAwsSdkV3Stub({ Unsupported: { read: {} } })).to.throw(
      'Unsupported AWS SDK v3 stub service Unsupported'
    );
  });

  it('ignores unsupported services and methods in fallback mode', () => {
    const awsSdkV3Stub = configureAwsSdkV3Stub(
      {
        Unsupported: { read: {} },
        Lambda: { invoke: {} },
      },
      { ignoreUnsupportedServices: true }
    );

    expect(awsSdkV3Stub.modulesCacheStub).to.deep.equal({});
  });
});
