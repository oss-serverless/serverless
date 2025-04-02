export = safeMoveFile;
/**
 * Allows a file to be moved (renamed) even across filesystem boundaries.
 *
 * If the rename fails because the file is getting renamed across file system boundaries,
 * the file is first copied to the destination file system under a temporary name,
 * and then renamed from there.
 *
 * This is done because rename is atomic but copy is not, and can leave partially copied files.
 *
 * @param {*} oldPath the original file that should be moved
 * @param {*} newPath the path to move the file to
 */
declare function safeMoveFile(oldPath: any, newPath: any): Promise<void>;
