export = AwsCompileS3Events;
declare class AwsCompileS3Events {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'package:compileEvents': () => Promise<any>;
    };
    newS3Buckets(): void;
    existingS3Buckets(): Promise<void>;
}
