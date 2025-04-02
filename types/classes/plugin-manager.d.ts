export = PluginManager;
declare class PluginManager {
    constructor(serverless: any);
    serverless: any;
    cliOptions: {};
    cliCommands: any[];
    pluginIndependentCommands: Set<string>;
    plugins: any[];
    externalPlugins: Set<any>;
    localPluginsPaths: any[];
    commands: {};
    aliases: {};
    hooks: {};
    deprecatedEvents: {};
    setCliOptions(options: any): void;
    setCliCommands(commands: any): void;
    addPlugin(Plugin: any): any;
    loadAllPlugins(servicePlugins: any): Promise<any[]>;
    requireServicePlugin(serviceDir: any, pluginPath: any, legacyLocalPluginsPath: any): Promise<any>;
    resolveServicePlugins(servicePlugs: any): Promise<any[]>;
    getLocalPluginsPathPatterns(): string[];
    parsePluginsObject(servicePlugs: any): {
        modules: any;
        localPath: string;
    };
    createCommandAlias(alias: any, command: any): void;
    loadCommand(pluginName: any, details: any, key: any, isEntryPoint: any): any;
    loadCommands(pluginInstance: any): void;
    loadHooks(pluginInstance: any): void;
    getCommands(): {};
    getAliasCommandTarget(aliasArray: any): any;
    /**
     * Retrieve the command specified by a command list. The method can be configured
     * to include entrypoint commands (which are invisible to the CLI and can only
     * be used by plugins).
     * @param commandsArray {Array<String>} Commands
     * @param allowEntryPoints {undefined|boolean} Allow entrypoint commands to be returned
     * @returns {Object} Command
     */
    getCommand(commandsArray: Array<string>, allowEntryPoints: undefined | boolean): any;
    getPlugins(): any[];
    getLifecycleEventsData(command: any): {
        lifecycleEventsData: {
            command: any;
            lifecycleEventSubName: any;
            lifecycleEventName: string;
            hooksData: {
                before: any;
                at: any;
                after: any;
            };
        }[];
        hooksLength: number;
    };
    runHooks(hookName: any, hooks: any): Promise<void>;
    invoke(commandsArray: any, allowEntryPoints: any): Promise<void>;
    /**
     * Invokes the given command and starts the command's lifecycle.
     * This method can be called by plugins directly to spawn a separate sub lifecycle.
     */
    spawn(commandsArray: any, options: any): Promise<void>;
    /**
     * Called by the CLI to start a public command.
     */
    run(commandsArray: any): Promise<void>;
    commandRunStartTime: number;
    /**
     * Check if the command is valid. Internally this function will only find
     * CLI accessible commands (command.type !== 'entrypoint')
     */
    validateCommand(commandsArray: any): void;
    /**
     * If the command has no use when operated in a working directory with no serverless
     * configuration file, throw an error
     */
    validateServerlessConfigDependency(command: any): void;
    convertShortcutsIntoOptions(command: any): void;
    assignDefaultOptions(command: any): void;
    asyncPluginInit(): Promise<any[]>;
}
