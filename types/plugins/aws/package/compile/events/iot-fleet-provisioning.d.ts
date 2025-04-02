export = AwsCompileIotFleetProvisioningEvents;
declare class AwsCompileIotFleetProvisioningEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<void>;
    };
    compileIotFleetProvisioningEvents(): void;
}
