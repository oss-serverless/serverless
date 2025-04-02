export = AwsCompileEventBridgeEvents;
declare class AwsCompileEventBridgeEvents {
    constructor(serverless: any, options: any);
    serverless: any;
    options: any;
    provider: any;
    hooks: {
        initialize: () => void;
        'package:compileEvents': () => Promise<void>;
    };
    compileEventBridgeEvents(): Promise<void>;
    compileWithCustomResource({ eventBusName, EventBus, compiledCloudFormationTemplate, functionName, RuleName, State, Input, InputPath, InputTransformer, Pattern, Schedule, FunctionName, idx, hasEventBusesIamRoleStatement, }: {
        eventBusName: any;
        EventBus: any;
        compiledCloudFormationTemplate: any;
        functionName: any;
        RuleName: any;
        State: any;
        Input: any;
        InputPath: any;
        InputTransformer: any;
        Pattern: any;
        Schedule: any;
        FunctionName: any;
        idx: any;
        hasEventBusesIamRoleStatement: any;
    }): {
        iamRoleStatements: {
            Effect: string;
            Resource: {
                'Fn::Join': (string | (string | {
                    Ref: string;
                })[])[];
            };
            Action: string[];
        }[];
        hasEventBusesIamRoleStatement: any;
    };
    compileWithCloudFormation({ eventBusName: _eventBusName, Description, EventBus, compiledCloudFormationTemplate, functionName, RuleName, State, Input, InputPath, InputTransformer, Pattern, Schedule, FunctionName, RetryPolicy, DeadLetterConfig, idx, }: {
        eventBusName: any;
        Description: any;
        EventBus: any;
        compiledCloudFormationTemplate: any;
        functionName: any;
        RuleName: any;
        State: any;
        Input: any;
        InputPath: any;
        InputTransformer: any;
        Pattern: any;
        Schedule: any;
        FunctionName: any;
        RetryPolicy: any;
        DeadLetterConfig: any;
        idx: any;
    }): void;
    _addCustomResourceToService({ iamRoleStatements: _iamRoleStatements }: {
        iamRoleStatements: any;
    }): Promise<void>;
    configureTarget({ target, Input, InputPath, InputTransformer, RetryPolicy, DeadLetterConfig }: {
        target: any;
        Input: any;
        InputPath: any;
        InputTransformer: any;
        RetryPolicy: any;
        DeadLetterConfig: any;
    }): any;
}
