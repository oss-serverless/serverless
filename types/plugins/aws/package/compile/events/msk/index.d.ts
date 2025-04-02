export = AwsCompileMSKEvents;
declare class AwsCompileMSKEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileMSKEvents(): void;
}
