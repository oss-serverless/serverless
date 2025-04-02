export = Deploy;
declare class Deploy {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        deploy: any;
    };
    hooks: {
        'before:deploy:deploy': () => Promise<void>;
        'after:deploy:deploy': () => Promise<boolean>;
    };
}
