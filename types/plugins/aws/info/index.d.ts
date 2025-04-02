export = AwsInfo;
declare class AwsInfo {
    constructor(serverless: any, options: any);
    serverless: any;
    provider: any;
    options: any;
    commands: {
        aws: {
            type: string;
            commands: {
                info: {
                    lifecycleEvents: string[];
                };
            };
        };
    };
    hooks: {
        'info:info': () => Promise<any>;
        'deploy:deploy': () => Promise<any>;
        'before:aws:info:validate': () => void;
        'aws:info:validate': () => Promise<any>;
        'aws:info:gatherData': () => Promise<void>;
        'aws:info:displayServiceInfo': () => Promise<any>;
        'aws:info:displayApiKeys': () => Promise<any>;
        'aws:info:displayEndpoints': () => Promise<any>;
        'aws:info:displayFunctions': () => Promise<any>;
        'aws:info:displayLayers': () => Promise<any>;
        'aws:info:displayStackOutputs': () => Promise<any>;
        'after:aws:info:gatherData': () => void;
        finalize: () => void;
    };
}
