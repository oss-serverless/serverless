export = CLI;
declare class CLI {
    constructor(serverless: any);
    serverless: any;
    loadedPlugins: any[];
    loadedCommands: {};
    setLoadedPlugins(plugins: any): void;
    setLoadedCommands(commands: any): void;
    displayHelp(): boolean;
    printDot(): void;
    log(message: any, entity: any, opts: any): void;
    consoleLog(message: any): void;
}
