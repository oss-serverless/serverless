'use strict';

const chai = require('chai');
const fsp = require('fs').promises;
const path = require('path');
const fse = require('fs-extra');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { getTmpDirPath } = require('../../../../utils/fs');
const runServerless = require('../../../../utils/run-serverless');

chai.use(require('chai-as-promised'));
const { expect } = require('chai');

const fixturesPath = path.resolve(__dirname, '../../../../fixtures/programmatic');

describe('test/unit/lib/plugins/create/create.test.js', () => {
  it('should generate scaffolding for local template in provided path and rename service', async () => {
    const tmpDir = getTmpDirPath();
    await runServerless({
      noService: true,
      command: 'create',
      options: {
        'template-path': path.join(fixturesPath, 'aws'),
        'path': tmpDir,
        'name': 'new-service-name',
      },
    });
    const dirContent = await fsp.readdir(tmpDir);
    expect(dirContent).to.include('serverless.yml');

    const serverlessYmlfileContent = (
      await fsp.readFile(path.join(tmpDir, 'serverless.yml'))
    ).toString();
    expect(serverlessYmlfileContent).to.include('service: new-service-name');
  });

  it('should error out when trying to create project in already existing directory (other than current working dir)', async () => {
    const tmpDir = getTmpDirPath();
    await fse.ensureDir(tmpDir);
    await expect(
      runServerless({
        noService: true,
        command: 'create',
        options: {
          'template-path': path.join(fixturesPath, 'aws'),
          'path': tmpDir,
        },
      })
    ).to.eventually.be.rejected.and.have.property('code', 'TARGET_FOLDER_ALREADY_EXISTS');
  });

  it('should error out when no template source is provided', async () => {
    await expect(
      runServerless({
        noService: true,
        command: 'create',
        options: {},
      })
    ).to.eventually.be.rejected.and.have.property('code', 'MISSING_TEMPLATE_CLI_PARAM');
  });

  describe('remote template URL flow', () => {
    let Create;
    let downloadTemplateFromRepoStub;
    let noticeSuccessStub;

    const createInstance = (options) =>
      new Create(
        {
          pluginManager: {
            commandRunStartTime: Date.now(),
          },
        },
        options
      );

    beforeEach(() => {
      const noticeStub = sinon.stub();
      noticeSuccessStub = sinon.stub();
      noticeStub.success = noticeSuccessStub;
      downloadTemplateFromRepoStub = sinon.stub();

      Create = proxyquire.noCallThru().load('../../../../../lib/plugins/create/create', {
        '../../utils/download-template-from-repo': {
          downloadTemplateFromRepo: downloadTemplateFromRepoStub,
        },
        '@serverless/utils/log': {
          progress: {
            get: () => ({ notice: sinon.stub() }),
          },
          log: {
            notice: noticeStub,
          },
          style: {
            aside: () => '',
          },
        },
      });
    });

    it('should report the name-based target directory when --name is provided without --path', async () => {
      const url = 'https://github.com/johndoe/service-to-be-downloaded';
      downloadTemplateFromRepoStub.resolves('service-to-be-downloaded');

      await createInstance({ 'template-url': url, 'name': 'new-service-name' }).create();

      expect(
        downloadTemplateFromRepoStub.calledOnceWithExactly(url, 'new-service-name', undefined)
      ).to.equal(true);
      expect(noticeSuccessStub.calledOnce).to.equal(true);
      expect(noticeSuccessStub.firstCall.args[0]).to.contain(
        'Project successfully created in "./new-service-name"'
      );
    });

    it('should report the provided target path when both --path and --name are set', async () => {
      const url = 'https://github.com/johndoe/service-to-be-downloaded';
      downloadTemplateFromRepoStub.resolves('service-to-be-downloaded');

      await createInstance({
        'template-url': url,
        'path': 'nested/service-directory',
        'name': 'new-service-name',
      }).create();

      expect(
        downloadTemplateFromRepoStub.calledOnceWithExactly(
          url,
          'new-service-name',
          'nested/service-directory'
        )
      ).to.equal(true);
      expect(noticeSuccessStub.calledOnce).to.equal(true);
      expect(noticeSuccessStub.firstCall.args[0]).to.contain(
        'Project successfully created in "nested/service-directory"'
      );
    });
  });
});
