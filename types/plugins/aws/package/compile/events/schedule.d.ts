export = AwsCompileScheduledEvents;
declare class AwsCompileScheduledEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileScheduledEvents(): void;
    formatInputTransformer(inputTransformer: any): string;
}
