export = AwsRollback;
declare class AwsRollback {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'before:rollback:initialize': () => Promise<any>;
        'rollback:rollback': () => Promise<void>;
    };
    setStackToUpdate(): Promise<void>;
}
