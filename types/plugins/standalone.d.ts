export = Standalone;
declare class Standalone {
    constructor(serverless: any, cliOptions: any);
    serverless: any;
    cliOptions: any;
    commands: {
        upgrade: any;
        uninstall: any;
    };
    hooks: {
        'upgrade:upgrade': () => Promise<void>;
        'uninstall:uninstall': () => Promise<void>;
    };
    upgrade(): Promise<void>;
    uninstall(): Promise<void>;
}
