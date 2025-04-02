export = AwsCompileFunctions;
declare class AwsCompileFunctions {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    packagePath: any;
    provider: any;
    ensureTargetExecutionPermission(destinationsProperty: any): void;
    hooks: {
        initialize: () => void;
        'package:compileFunctions': () => Promise<void>;
    };
    compileRole(newFunction: any, role: any): void;
    downloadPackageArtifact(functionName: any): Promise<void>;
    addFileToHash(filePath: any, hash: any): Promise<void>;
    compileFunction(functionName: any): Promise<void>;
    compileFunctionUrl(functionName: any): void;
    compileFunctionEventInvokeConfig(functionName: any): void;
    getDestinationsArn(destinationsProperty: any): any;
    downloadPackageArtifacts(): Promise<void>;
    compileFunctions(): Promise<any[]>;
    cfLambdaFunctionTemplate(): {
        Type: string;
        Properties: {
            Code: {};
        };
    };
    cfLambdaVersionTemplate(): {
        Type: string;
        DeletionPolicy: string;
        Properties: {
            FunctionName: string;
            CodeSha256: string;
        };
    };
    cfOutputLatestVersionTemplate(): {
        Description: string;
        Value: string;
    };
}
