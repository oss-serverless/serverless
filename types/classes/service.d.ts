export = Service;
declare class Service {
    constructor(serverless: any, data: any);
    serverless: any;
    service: any;
    serviceObject: {
        name: any;
    };
    provider: {
        stage: string;
    };
    custom: {};
    plugins: any[];
    pluginsData: {};
    functions: {};
    resources: {};
    package: {};
    configValidationMode: string;
    disabledDeprecations: any[];
    load(rawOptions: any): Promise<void>;
    loadServiceFileParam(): this;
    serviceFilename: any;
    initialServerlessConfig: any;
    deprecationNotificationMode: any;
    app: any;
    org: any;
    layers: any;
    outputs: any;
    reloadServiceFileParam(): void;
    setFunctionNames(rawOptions: any): void;
    mergeArrays(): void;
    validate(): Promise<this>;
    update(data: any): any;
    getServiceName(): any;
    getServiceObject(): {
        name: any;
    };
    getAllFunctions(): string[];
    getAllLayers(): string[];
    getAllFunctionsNames(): any[];
    getFunction(functionName: any): any;
    getLayer(layerName: any): any;
    getEventInFunction(eventName: any, functionName: any): any;
    getAllEventsInFunction(functionName: any): any;
    publish(dataParam: any): void;
}
