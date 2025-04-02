export = Print;
declare class Print {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    cache: {};
    commands: {
        print: any;
    };
    hooks: {
        'print:print': any;
    };
    print(): Promise<void>;
}
