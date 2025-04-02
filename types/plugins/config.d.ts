export = Config;
declare class Config {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        config: any;
    };
    hooks: {
        'config:config': () => Promise<void>;
        'before:config:credentials:config': () => void;
    };
    validate(): void;
    updateConfig(): Promise<void>;
}
