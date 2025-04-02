export = Plugin;
declare class Plugin {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        plugin: {
            type: string;
        };
    };
}
