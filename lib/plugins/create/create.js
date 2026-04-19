'use strict';

const path = require('path');
const untildify = require('untildify');

const ServerlessError = require('../../serverless-error');
const cliCommandsSchema = require('../../cli/commands-schema');
const download = require('../../utils/download-template-from-repo');
const renameService = require('../../utils/rename-service').renameService;
const copyDirContentsSync = require('../../utils/fs/copy-dir-contents-sync');
const dirExistsSync = require('../../utils/fs/dir-exists-sync');
const { progress, log, style } = require('@serverless/utils/log');

const mainProgress = progress.get('main');

class Create {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      create: {
        ...cliCommandsSchema.get('create'),
      },
    };

    this.hooks = {
      'create:create': async () => this.create(),
    };
  }

  async create() {
    if ('template-url' in this.options) {
      // We only show progress in case of setup from `template-url` as setting up from local files is fast
      mainProgress.notice('Setting up new project', { isMainEvent: true });
      try {
        const serviceName = await download.downloadTemplateFromRepo(
          this.options['template-url'],
          this.options.name,
          this.options.path
        );
        const targetDirectory = this.options.path || `./${this.options.name || serviceName}`;

        log.notice();
        log.notice.success(
          `Project successfully created in "${targetDirectory}" ${style.aside(
            `(${Math.floor(
              (Date.now() - this.serverless.pluginManager.commandRunStartTime) / 1000
            )}s)`
          )}`
        );
      } catch (err) {
        throw new ServerlessError(err, 'BOILERPLATE_GENERATION_ERROR');
      }
    } else if ('template-path' in this.options) {
      // Copying template from a local directory
      const serviceDir = this.options.path
        ? path.resolve(process.cwd(), untildify(this.options.path))
        : path.join(process.cwd(), this.options.name);
      if (dirExistsSync(serviceDir)) {
        const errorMessage = `A folder named "${serviceDir}" already exists.`;
        throw new ServerlessError(errorMessage, 'TARGET_FOLDER_ALREADY_EXISTS');
      }
      copyDirContentsSync(untildify(this.options['template-path']), serviceDir, {
        noLinks: true,
      });
      if (this.options.name) {
        renameService(this.options.name, serviceDir);
      }
      log.notice();
      log.notice.success(
        `Project successfully created in "${this.options.path || `./${this.options.name}`}"`
      );
    } else {
      const errorMessage = [
        'You must either pass a URL (--template-url) ',
        'or a local path (--template-path).',
      ].join('');
      throw new ServerlessError(errorMessage, 'MISSING_TEMPLATE_CLI_PARAM');
    }
  }
}

module.exports = Create;
