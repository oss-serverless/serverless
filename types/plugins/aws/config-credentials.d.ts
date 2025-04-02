export = AwsConfigCredentials;
declare class AwsConfigCredentials {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        config: {
            commands: {
                credentials: any;
            };
        };
    };
    hooks: {
        'config:credentials:config': () => Promise<any>;
    };
    configureCredentials(): Promise<any>;
}
