export = AwsLogs;
declare class AwsLogs {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'logs:logs': () => Promise<void>;
    };
    extendedValidate(): void;
    getLogStreams(): Promise<any>;
    showLogs(logStreamNames: any): Promise<void>;
}
