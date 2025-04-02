export = AwsInvokeLocal;
declare class AwsInvokeLocal {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        'before:invoke:local:loadEnvVars': () => Promise<void>;
        'invoke:local:invoke': () => Promise<any>;
    };
    getRuntime(): any;
    resolveRuntimeWrapperPath(filename: any): Promise<string>;
    validateFile(filePath: any, key: any): Promise<void>;
    extendedValidate(): Promise<void>;
    getCredentialEnvVars(): {
        AWS_ACCESS_KEY_ID: any;
        AWS_SECRET_ACCESS_KEY: any;
        AWS_SESSION_TOKEN: any;
    };
    getConfiguredEnvVars(): {};
    resolveConfiguredEnvVars(configuredEnvVars: any): Promise<any>;
    loadEnvVars(): Promise<void>;
    invokeLocal(): Promise<any>;
    checkDockerDaemonStatus(): Promise<any>;
    checkDockerImage(imageName: any): Promise<boolean>;
    pullDockerImage(): Promise<any>;
    getLayerPaths(): Promise<any[]>;
    getDockerImageName(): string;
    buildDockerImage(layerPaths: any): Promise<string>;
    extractArtifact(): Promise<any>;
    getEnvVarsFromOptions(): {};
    ensurePackage(): Promise<void>;
    invokeLocalDocker(): Promise<string>;
    getDockerArgsFromOptions(): any[];
    invokeLocalPython(runtime: any, handlerPath: any, handlerName: any, event: any, context: any): Promise<any>;
    callJavaBridge(artifactPath: any, className: any, handlerName: any, input: any): Promise<any>;
    invokeLocalJava(runtime: any, className: any, handlerName: any, artifactPath: any, event: any, customContext: any): Promise<any>;
    invokeLocalRuby(runtime: any, handlerPath: any, handlerName: any, event: any, context: any): Promise<any>;
    invokeLocalNodeJs(handlerPath: any, handlerName: any, event: any, customContext: any): Promise<any>;
}
