export = AwsMetrics;
declare class AwsMetrics {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'metrics:metrics': () => Promise<void>;
    };
    extendedValidate(): void;
    getMetrics(): Promise<any[]>;
    showMetrics(metrics: any): void;
}
