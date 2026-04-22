'use strict';

const path = require('path');
const createZipFile = require('../../../../../lib/utils/fs/create-zip-file');
const { createTmpFile, listZipFiles } = require('../../../../utils/fs');

// Configure chai
const expect = require('chai').expect;

describe('#createZipFile()', () => {
  it('should create a zip file with the source directory content', async () => {
    const toZipFilePath = createTmpFile('foo.json');
    const zipFilePath = createTmpFile('package.zip');

    const srcDirPath = toZipFilePath.split(path.sep).slice(0, -1).join(path.sep);

    return createZipFile(srcDirPath, zipFilePath)
      .then(listZipFiles)
      .then((files) => expect(files).to.deep.equal(['foo.json']));
  });
});
