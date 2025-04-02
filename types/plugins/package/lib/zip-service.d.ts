export function zipService(exclude: any, include: any, zipFileName: any): Promise<any>;
export function excludeDevDependencies(params: any): Promise<any>;
export function zip(params: any): Promise<any>;
/**
 * Create a zip file on disk from an array of filenames of files on disk
 * @param files - an Array of filenames
 * @param zipFiles - the filename to save the zip at
 * @param prefix - a prefix to strip from the file names. use for layers support
 */
export function zipFiles(files: any, zipFileName: any, prefix: any): Promise<any>;
export function getFileContentAndStat(filePath: any): Promise<any>;
export function getFileContent(fullPath: any): any;
