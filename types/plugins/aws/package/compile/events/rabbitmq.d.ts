export = AwsCompileRabbitMQEvents;
declare class AwsCompileRabbitMQEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileRabbitMQEvents(): void;
}
