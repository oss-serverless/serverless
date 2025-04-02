export = AwsCompileCloudWatchLogEvents;
declare class AwsCompileCloudWatchLogEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileCloudWatchLogEvents(): void;
    longestCommonSuffix(logGroupNames: any): any;
}
