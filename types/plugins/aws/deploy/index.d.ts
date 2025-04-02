export = AwsDeploy;
declare class AwsDeploy {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    servicePath: any;
    packagePath: any;
    getFileStats: any;
    commands: {
        aws: {
            type: string;
            commands: {
                deploy: {
                    commands: {
                        deploy: {
                            lifecycleEvents: string[];
                        };
                        finalize: {
                            lifecycleEvents: string[];
                        };
                    };
                };
            };
        };
    };
    hooks: {
        initialize: () => void;
        'before:deploy:deploy': () => Promise<any>;
        'deploy:deploy': () => Promise<any>;
        'deploy:finalize': () => Promise<any>;
        'before:aws:deploy:deploy:createStack': () => any;
        'aws:deploy:deploy:createStack': () => Promise<any>;
        'aws:deploy:deploy:checkForChanges': () => Promise<void>;
        'before:aws:deploy:deploy:uploadArtifacts': () => void;
        'aws:deploy:deploy:uploadArtifacts': () => Promise<void>;
        'aws:deploy:deploy:validateTemplate': () => Promise<void>;
        'before:aws:deploy:deploy:updateStack': () => void;
        'aws:deploy:deploy:updateStack': () => Promise<void>;
        'after:deploy:deploy': () => any;
        'aws:deploy:finalize:cleanup': () => Promise<void>;
        error: () => Promise<void>;
        finalize: () => Promise<void>;
    };
}
