export = AwsCompileKafkaEvents;
declare class AwsCompileKafkaEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileKafkaEvents(): void;
}
