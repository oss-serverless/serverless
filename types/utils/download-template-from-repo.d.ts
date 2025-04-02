/**
 * @param {string} inputUrl
 * @param {string} [templateName]
 * @param {string} [path]
 * @returns {Promise}
 */
export function downloadTemplateFromRepo(inputUrl: string, templateName?: string, downloadPath: any): Promise<any>;
/**
 * Parse URL and call the appropriate adaptor
 *
 * @param {string} inputUrl
 * @throws {ServerlessError}
 * @returns {Promise}
 */
export function parseRepoURL(inputUrl: string): Promise<any>;
