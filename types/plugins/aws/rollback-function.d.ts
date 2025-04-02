export = AwsRollbackFunction;
declare class AwsRollbackFunction {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'rollback:function:rollback': () => Promise<any>;
    };
    getFunctionToBeRestored(): Promise<any>;
    fetchFunctionCode(func: any): Promise<any>;
    restoreFunction(zipBuffer: any): Promise<any>;
}
