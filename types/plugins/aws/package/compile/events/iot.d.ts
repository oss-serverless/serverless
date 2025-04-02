export = AwsCompileIoTEvents;
declare class AwsCompileIoTEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileIoTEvents(): void;
}
