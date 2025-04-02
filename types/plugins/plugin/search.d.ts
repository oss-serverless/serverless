export = PluginSearch;
declare class PluginSearch {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    commands: {
        plugin: {
            commands: {
                search: any;
            };
        };
    };
    hooks: {
        'plugin:search:search': () => Promise<void>;
    };
    search(): Promise<void>;
}
