export = AwsCompileStreamEvents;
declare class AwsCompileStreamEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        initialize: () => void;
        'package:compileEvents': () => Promise<void>;
    };
    compileStreamEvents(): void;
}
