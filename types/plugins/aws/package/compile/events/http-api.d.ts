export = HttpApiEvents;
declare class HttpApiEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        initialize: () => void;
        'package:compileEvents': () => void;
    };
    cfTemplate: any;
    getApiIdConfig(): any;
    compileApi(): void;
    compileLogGroup(): void;
    compileStage(): void;
    compileAuthorizers(): void;
    compileAuthorizerLambdaPermission({ functionName, functionArn, name, functionObject }: {
        functionName: any;
        functionArn: any;
        name: any;
        functionObject: any;
    }): void;
    compileEndpoints(): void;
}
