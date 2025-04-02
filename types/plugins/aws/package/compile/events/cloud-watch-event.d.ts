export = AwsCompileCloudWatchEventEvents;
declare class AwsCompileCloudWatchEventEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileCloudWatchEventEvents(): void;
    formatInputTransformer(inputTransformer: any): string;
}
