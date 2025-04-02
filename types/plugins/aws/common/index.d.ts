export = AwsCommon;
declare class AwsCommon {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    commands: {
        aws: {
            type: string;
            commands: {
                common: {
                    commands: {
                        validate: {
                            lifecycleEvents: string[];
                        };
                        cleanupTempDir: {
                            lifecycleEvents: string[];
                        };
                        moveArtifactsToPackage: {
                            lifecycleEvents: string[];
                        };
                        moveArtifactsToTemp: {
                            lifecycleEvents: string[];
                        };
                    };
                };
            };
        };
    };
    hooks: {
        'aws:common:validate:validate': () => any;
        'aws:common:cleanupTempDir:cleanup': () => any;
        'aws:common:moveArtifactsToPackage:move': () => any;
        'aws:common:moveArtifactsToTemp:move': () => any;
    };
}
