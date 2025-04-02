export = AwsCompileSNSEvents;
declare class AwsCompileSNSEvents {
    constructor(serverless: any, options: any);
    serverless: any;
    provider: any;
    options: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileSNSEvents(): void;
}
