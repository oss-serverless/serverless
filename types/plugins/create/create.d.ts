export = Create;
declare class Create {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        create: any;
    };
    hooks: {
        'create:create': () => Promise<any>;
    };
    create(): Promise<any>;
}
