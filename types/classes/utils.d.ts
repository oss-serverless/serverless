export = Utils;
declare class Utils {
    constructor(serverless: any);
    serverless: any;
    getVersion(): any;
    dirExistsSync(dirPath: any): any;
    getTmpDirPath(): string;
    fileExistsSync(filePath: any): any;
    writeFileDir(filePath: any): void;
    writeFileSync(filePath: any, contents: any, cycles: any): void;
    writeFile(filePath: any, contents: any, cycles: any): Promise<any>;
    appendFileSync(filePath: any, conts: any): Promise<any>;
    readFileSync(filePath: any): any;
    readFile(filePath: any): Promise<any>;
    walkDirSync(dirPath: any): any[];
    copyDirContentsSync(srcDir: any, destDir: any): void;
    generateShortId(length: any): string;
    isEventUsed(functions: any, eventName: any): boolean;
}
