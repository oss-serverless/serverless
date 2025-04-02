export function getMethodIntegration(http: any, { lambdaLogicalId, lambdaAliasName }: {
    lambdaLogicalId: any;
    lambdaAliasName: any;
}): {
    Properties: {
        Integration: {
            IntegrationHttpMethod: string;
            Type: any;
            TimeoutInMillis: any;
        };
    };
};
export function getIntegrationResponses(http: any): any[];
export function getIntegrationRequestTemplates(http: any, useDefaults: any): {};
export function getIntegrationRequestParameters(http: any): {
    'integration.request.header.X-Amz-Invocation-Type': string;
};
export let DEFAULT_JSON_REQUEST_TEMPLATE: string;
export let DEFAULT_FORM_URL_ENCODED_REQUEST_TEMPLATE: string;
