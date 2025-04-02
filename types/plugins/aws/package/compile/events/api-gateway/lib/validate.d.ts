export function validate(): {
    events: any[];
    corsPreflight: {};
};
export function getHttp(event: any): any;
export function getHttpPath(http: any): any;
export function getHttpMethod(http: any): any;
export function getAuthorizer(http: any): {
    type: any;
    name: any;
    arn: any;
    managedExternally: any;
    authorizerId: any;
    logicalId: any;
    resultTtlInSeconds: number;
    identitySource: any;
    identityValidationExpression: any;
    claims: any;
    scopes: any;
};
export function getCors(http: any): {
    origin: string;
    methods: string[];
    headers: string[];
    allowCredentials: boolean;
};
export function getIntegration(http: any): any;
export function getConnectionType(http: any): any;
export function getRequest(http: any): any;
export function getRequestParameters(httpRequest: any): {};
export function getRequestPassThrough(http: any): any;
export function getResponse(http: any): any;
export function getLambdaName(arn: any): any;
