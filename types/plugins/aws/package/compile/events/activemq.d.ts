export = AwsCompileActiveMQEvents;
declare class AwsCompileActiveMQEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileActiveMQEvents(): void;
}
