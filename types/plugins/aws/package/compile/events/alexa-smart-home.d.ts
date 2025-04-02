export = AwsCompileAlexaSmartHomeEvents;
declare class AwsCompileAlexaSmartHomeEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileAlexaSmartHomeEvents(): void;
}
