export = Package;
declare class Package {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    servicePath: any;
    packagePath: any;
    commands: {
        package: any;
    };
    hooks: {
        initialize: () => void;
        'package:createDeploymentArtifacts': () => Promise<any>;
        'package:function:package': () => Promise<any>;
    };
}
