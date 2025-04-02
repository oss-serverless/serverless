export function compileCors(): void;
export function generateCorsMethodResponses(preflightHeaders: any): {
    StatusCode: string;
    ResponseParameters: {};
    ResponseModels: {};
}[];
export function generateCorsIntegrationResponses(preflightHeaders: any, origins: any): {
    StatusCode: string;
    ResponseParameters: any;
    ResponseTemplates: {
        'application/json': string;
    };
}[];
export function regexifyWildcards(orig: any): any;
export function generateCorsResponseTemplate(origins: any): string;
