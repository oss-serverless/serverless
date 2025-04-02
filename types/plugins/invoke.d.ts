export = Invoke;
declare class Invoke {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        invoke: any;
    };
    hooks: {
        initialize: () => void;
        'invoke:local:loadEnvVars': () => Promise<void>;
        'after:invoke:invoke': () => Promise<void>;
        'after:invoke:local:invoke': () => Promise<void>;
    };
    trackInvoke(): void;
    trackInvokeLocal(): void;
    /**
     * Set environment variables for "invoke local" that are provider independent.
     */
    loadEnvVarsForLocal(): void;
}
