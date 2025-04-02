export = AwsCompileCloudFrontEvents;
declare class AwsCompileCloudFrontEvents {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    lambdaEdgeLimits: {
        'origin-request': {
            maxTimeout: number;
            maxMemorySize: number;
        };
        'origin-response': {
            maxTimeout: number;
            maxMemorySize: number;
        };
        'viewer-request': {
            maxTimeout: number;
            maxMemorySize: number;
        };
        'viewer-response': {
            maxTimeout: number;
            maxMemorySize: number;
        };
        default: {
            maxTimeout: number;
            maxMemorySize: number;
        };
    };
    cachePolicies: Set<any>;
    hooks: {
        'package:initialize': () => Promise<void>;
        'before:package:compileFunctions': () => Promise<void>;
        'package:compileEvents': () => void;
        'before:remove:remove': () => Promise<void>;
    };
    logRemoveReminder(): void;
    validate(): void;
    prepareFunctions(): void;
    compileCloudFrontCachePolicies(): void;
    compileCloudFrontEvents(): void;
    cloudFrontDistributionLogicalId: any;
    cloudFrontDistributionDomainNameLogicalId: any;
}
