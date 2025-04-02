export = AwsCompileLayers;
declare class AwsCompileLayers {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    packagePath: any;
    provider: any;
    hooks: {
        'package:compileLayers': () => Promise<void>;
    };
    compileLayer(layerName: any): Promise<any>;
    compareWithLastLayer(layerName: any): Promise<any>;
    compileLayers(): Promise<void>;
    cfLambdaLayerTemplate(): {
        Type: string;
        Properties: {
            Content: {
                S3Bucket: {
                    Ref: string;
                };
                S3Key: string;
            };
            LayerName: string;
        };
    };
    cfLambdaLayerPermissionTemplate(): {
        Type: string;
        Properties: {
            Action: string;
            LayerVersionArn: string;
            Principal: string;
        };
    };
    cfOutputLayerTemplate(): {
        Description: string;
        Value: string;
    };
    cfOutputLayerHashTemplate(): {
        Description: string;
        Value: string;
    };
    cfOutputLayerS3KeyTemplate(): {
        Description: string;
        Value: string;
    };
}
