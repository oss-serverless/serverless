export = Config;
declare class Config {
    constructor(serverless: any, config: any);
    serverless: any;
    serverlessPath: string;
    update(config: any): any;
    set servicePath(value: any);
    get servicePath(): any;
}
