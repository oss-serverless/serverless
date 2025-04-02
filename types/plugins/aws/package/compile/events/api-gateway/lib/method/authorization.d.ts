export function getMethodAuthorization(http: any): {
    Properties: {
        AuthorizationType: any;
        AuthorizerId: any;
    };
} | {
    Properties: {
        AuthorizationType: string;
    };
};
