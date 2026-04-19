'use strict';

const chai = require('chai');
const fsp = require('fs').promises;
const path = require('path');
const fse = require('fs-extra');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const ServerlessError = require('../../../../../lib/serverless-error');
const { getTmpDirPath } = require('../../../../utils/fs');
const runServerless = require('../../../../utils/run-serverless');

chai.use(require('chai-as-promised'));
const { expect } = require('chai');

const fixturesPath = path.resolve(__dirname, '../../../../fixtures/programmatic');

const loadCreate = ({ downloadTemplateFromRepoStub, dirExistsSyncStub } = {}) => {
  const noticeStub = sinon.stub();
  noticeStub.success = sinon.stub();
  const copyDirContentsSyncStub = sinon.stub();
  const renameServiceStub = sinon.stub();

  const Create = proxyquire.noCallThru().load('../../../../../lib/plugins/create/create', {
    '../../utils/download-template-from-repo': {
      downloadTemplateFromRepo: downloadTemplateFromRepoStub || sinon.stub(),
    },
    '../../utils/fs/dir-exists-sync': dirExistsSyncStub || sinon.stub().returns(false),
    '../../utils/fs/copy-dir-contents-sync': copyDirContentsSyncStub,
    '../../utils/rename-service': {
      renameService: renameServiceStub,
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

  return {
    Create,
    copyDirContentsSyncStub,
    noticeSuccessStub: noticeStub.success,
    renameServiceStub,
  };
};

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
      downloadTemplateFromRepoStub = sinon.stub();
      ({ Create, noticeSuccessStub } = loadCreate({ downloadTemplateFromRepoStub }));
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

    it('should preserve ServerlessError details from the download helper', async () => {
      const url = 'https://github.com/johndoe/service-to-be-downloaded';
      const helperError = new ServerlessError(
        'The URL you passed is not valid',
        'INVALID_TEMPLATE_URL'
      );
      downloadTemplateFromRepoStub.rejects(helperError);

      try {
        await createInstance({ 'template-url': url }).create();
      } catch (error) {
        expect(error).to.equal(helperError);
        return;
      }

      throw new Error('Expected create() to reject');
    });

    it('should wrap generic download errors with a clean message', async () => {
      const url = 'https://github.com/johndoe/service-to-be-downloaded';
      downloadTemplateFromRepoStub.rejects(new Error('Download exploded'));

      try {
        await createInstance({ 'template-url': url }).create();
      } catch (error) {
        expect(error).to.have.property('code', 'BOILERPLATE_GENERATION_ERROR');
        expect(error).to.have.property('message', 'Download exploded');
        return;
      }

      throw new Error('Expected create() to reject');
    });
  });

  describe('local template path flow', () => {
    it('should default the target directory to the template folder name', async () => {
      const { Create, copyDirContentsSyncStub, noticeSuccessStub, renameServiceStub } =
        loadCreate();

      await new Create(
        {
          pluginManager: {
            commandRunStartTime: Date.now(),
          },
        },
        {
          'template-path': path.join(fixturesPath, 'aws'),
        }
      ).create();

      expect(copyDirContentsSyncStub.calledOnce).to.equal(true);
      expect(copyDirContentsSyncStub.firstCall.args[0]).to.equal(path.join(fixturesPath, 'aws'));
      expect(copyDirContentsSyncStub.firstCall.args[1]).to.equal(path.join(process.cwd(), 'aws'));
      expect(renameServiceStub.called).to.equal(false);
      expect(noticeSuccessStub.calledOnce).to.equal(true);
      expect(noticeSuccessStub.firstCall.args[0]).to.contain(
        'Project successfully created in "./aws"'
      );
    });

    it('should default the service name to the target directory basename when only --path is provided', async () => {
      const { Create, copyDirContentsSyncStub, noticeSuccessStub, renameServiceStub } =
        loadCreate();
      const targetPath = 'nested/service-directory';
      const expectedServiceDir = path.resolve(process.cwd(), targetPath);

      await new Create(
        {
          pluginManager: {
            commandRunStartTime: Date.now(),
          },
        },
        {
          'template-path': path.join(fixturesPath, 'aws'),
          'path': targetPath,
        }
      ).create();

      expect(copyDirContentsSyncStub.calledOnce).to.equal(true);
      expect(copyDirContentsSyncStub.firstCall.args[0]).to.equal(path.join(fixturesPath, 'aws'));
      expect(copyDirContentsSyncStub.firstCall.args[1]).to.equal(expectedServiceDir);
      expect(
        renameServiceStub.calledOnceWithExactly('service-directory', expectedServiceDir)
      ).to.equal(true);
      expect(noticeSuccessStub.calledOnce).to.equal(true);
      expect(noticeSuccessStub.firstCall.args[0]).to.contain(
        'Project successfully created in "nested/service-directory"'
      );
    });

    it('should report the provided local target path when the directory already exists', async () => {
      const { Create } = loadCreate({
        dirExistsSyncStub: sinon.stub().returns(true),
      });

      try {
        await new Create(
          {
            pluginManager: {
              commandRunStartTime: Date.now(),
            },
          },
          {
            'template-path': path.join(fixturesPath, 'aws'),
            'path': 'nested/service-directory',
          }
        ).create();
      } catch (error) {
        expect(error).to.have.property('code', 'TARGET_FOLDER_ALREADY_EXISTS');
        expect(error).to.have.property(
          'message',
          'A folder named "nested/service-directory" already exists.'
        );
        return;
      }

      throw new Error('Expected create() to reject');
    });
  });
});
