export = AwsCompileCognitoUserPoolEvents;
declare class AwsCompileCognitoUserPoolEvents {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<any>;
        'after:package:finalize': () => Promise<void>;
    };
    newCognitoUserPools(): void;
    existingCognitoUserPools(): Promise<void>;
    checkKmsArn(kmsKeyId: any, poolKmsIdMap: any, currentPoolName: any): void;
    findUserPoolsAndFunctions(): {
        cognitoUserPoolTriggerFunctions: any[];
        userPools: any[];
    };
    generateTemplateForPool(poolName: any, currentPoolTriggerFunctions: any): {
        [x: number]: {
            Type: string;
            Properties: {
                UserPoolName: any;
                LambdaConfig: any;
            };
            DependsOn: any;
        };
    };
    mergeWithCustomResources(): void;
}
