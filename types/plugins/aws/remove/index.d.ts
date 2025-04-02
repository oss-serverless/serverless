export = AwsRemove;
declare class AwsRemove {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        initialize: () => Promise<void>;
        'remove:remove': () => Promise<void>;
        finalize: () => Promise<void>;
    };
}
