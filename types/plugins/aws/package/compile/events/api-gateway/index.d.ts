export = AwsCompileApigEvents;
declare class AwsCompileApigEvents {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    apiGatewayMethodLogicalIds: any[];
    createRequestValidator: any;
    hooks: {
        'package:compileEvents': () => Promise<any>;
        'after:deploy:deploy': () => Promise<any>;
        'before:remove:remove': () => Promise<any>;
    };
    validated: any;
    state: any;
}
