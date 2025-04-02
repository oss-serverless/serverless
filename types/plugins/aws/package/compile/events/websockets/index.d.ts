export = AwsCompileWebsockets;
declare class AwsCompileWebsockets {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<any>;
    };
    validated: any;
}
