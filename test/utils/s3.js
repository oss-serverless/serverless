'use strict';

const awsRequest = require('../lib/aws-request');

// Support for both AWS SDK v2 and v3
const getS3Client = () => {
  if (process.env.SLS_AWS_SDK_V3 === '1') {
    // AWS SDK v3
    const { S3Client } = require('@aws-sdk/client-s3');
    const {
      CreateBucketCommand,
      PutObjectCommand,
      DeleteObjectCommand,
      ListObjectsCommand,
      DeleteObjectsCommand,
      DeleteBucketCommand,
    } = require('@aws-sdk/client-s3');

    const client = new S3Client({ region: 'us-east-1' });

    return {
      createBucket: (params) => client.send(new CreateBucketCommand(params)),
      putObject: (params) => client.send(new PutObjectCommand(params)),
      deleteObject: (params) => client.send(new DeleteObjectCommand(params)),
      listObjects: (params) => client.send(new ListObjectsCommand(params)),
      deleteObjects: (params) => client.send(new DeleteObjectsCommand(params)),
      deleteBucket: (params) => client.send(new DeleteBucketCommand(params)),
    };
  }
  // AWS SDK v2
  const S3Service = require('aws-sdk').S3;
  return {
    createBucket: (params) => awsRequest(S3Service, 'createBucket', params),
    putObject: (params) => awsRequest(S3Service, 'putObject', params),
    deleteObject: (params) => awsRequest(S3Service, 'deleteObject', params),
    listObjects: (params) => awsRequest(S3Service, 'listObjects', params),
    deleteObjects: (params) => awsRequest(S3Service, 'deleteObjects', params),
    deleteBucket: (params) => awsRequest(S3Service, 'deleteBucket', params),
  };
};

const s3 = getS3Client();

async function createBucket(bucket) {
  return s3.createBucket({ Bucket: bucket });
}

async function createAndRemoveInBucket(bucket, opts = {}) {
  const prefix = opts.prefix || '';
  const suffix = opts.suffix || '';
  const fileName = opts.fileName || 'object';

  const params = {
    Bucket: bucket,
    Key: `${prefix}${fileName}${suffix}`,
    Body: 'hello world',
  };

  return s3.putObject(params).then(() => {
    delete params.Body;
    return s3.deleteObject(params);
  });
}

async function emptyBucket(bucket) {
  return s3.listObjects({ Bucket: bucket }).then((data) => {
    const items = data.Contents;
    const numItems = items.length;
    if (numItems) {
      const keys = items.map((item) => Object.assign({}, { Key: item.Key }));
      return s3.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: keys,
        },
      });
    }
    return null;
  });
}

async function deleteBucket(bucket) {
  return emptyBucket(bucket).then(() => s3.deleteBucket({ Bucket: bucket }));
}

module.exports = {
  createBucket,
  createAndRemoveInBucket,
  emptyBucket,
  deleteBucket,
};
