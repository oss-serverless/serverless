export = AwsInvoke;
declare class AwsInvoke {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'invoke:invoke': () => Promise<void>;
    };
    validateFile(key: any): Promise<any>;
    extendedValidate(): Promise<void>;
    invoke(): Promise<any>;
    log(invocationReply: any): void;
}
