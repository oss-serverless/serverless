export = AwsCompileSQSEvents;
declare class AwsCompileSQSEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileSQSEvents(): void;
}
