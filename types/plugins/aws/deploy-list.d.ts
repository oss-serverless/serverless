export = AwsDeployList;
declare class AwsDeployList {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'before:deploy:list:log': () => any;
        'before:deploy:list:functions:log': () => any;
        'deploy:list:log': () => Promise<void>;
        'deploy:list:functions:log': () => Promise<void>;
    };
    listDeployments(): Promise<void>;
    listFunctions(): Promise<void>;
    getFunctions(): Promise<any[]>;
    getFunctionPaginatedVersions(params: any, totalVersions: any): any;
    getFunctionVersions(funcs: any): Promise<any[]>;
    displayFunctions(funcs: any): void;
}
