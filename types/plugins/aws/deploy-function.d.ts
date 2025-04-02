export = AwsDeployFunction;
declare class AwsDeployFunction {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    packagePath: any;
    provider: any;
    shouldEnsureFunctionState: boolean;
    hooks: {
        initialize: () => void;
        'before:deploy:function:initialize': () => any;
        'deploy:function:initialize': () => Promise<void>;
        'before:deploy:function:packageFunction': () => any;
        'deploy:function:packageFunction': () => Promise<any>;
        'before:deploy:function:deploy': () => any;
        'deploy:function:deploy': () => Promise<void>;
    };
    checkIfFunctionExists(): Promise<void>;
    checkIfFunctionChangesBetweenImageAndHandler(): void;
    normalizeArnRole(role: any): Promise<any>;
    ensureFunctionState(): Promise<void>;
    callUpdateFunctionConfiguration(params: any): Promise<void>;
    updateFunctionConfiguration(): Promise<void>;
    deployFunction(): Promise<void>;
}
