export = AwsPackage;
declare class AwsPackage {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    servicePath: any;
    packagePath: any;
    provider: any;
    commands: {
        aws: {
            type: string;
            commands: {
                package: {
                    commands: {
                        finalize: {
                            lifecycleEvents: string[];
                        };
                    };
                };
            };
        };
    };
    hooks: {
        initialize: () => void;
        'before:package:cleanup': () => any;
        /**
         * Outer lifecycle hooks
         */
        'package:cleanup': () => Promise<void>;
        'package:initialize': () => Promise<any>;
        'package:setupProviderConfiguration': () => any;
        'before:package:compileFunctions': () => Promise<any>;
        'before:package:compileLayers': () => Promise<any>;
        'package:finalize': () => Promise<any>;
        /**
         * Inner lifecycle hooks
         */
        'aws:package:finalize:addExportNameForOutputs': () => void;
        'aws:package:finalize:mergeCustomProviderResources': () => Promise<any>;
        'aws:package:finalize:stripNullPropsFromTemplateResources': () => any;
        'aws:package:finalize:saveServiceState': () => Promise<any>;
        finalize: () => void;
    };
}
