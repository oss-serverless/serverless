export = PluginList;
declare class PluginList {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        plugin: {
            commands: {
                list: any;
            };
        };
    };
    hooks: {
        'plugin:list:list': () => Promise<void>;
    };
    list(): Promise<void>;
}
