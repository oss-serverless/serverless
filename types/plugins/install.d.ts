export = Install;
declare class Install {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        install: any;
    };
    hooks: {
        'install:install': () => Promise<void>;
    };
    install(): Promise<void>;
}
