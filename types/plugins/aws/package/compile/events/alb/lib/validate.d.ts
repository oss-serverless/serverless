export let ALB_LISTENER_REGEXP: RegExp;
export function validate(): {
    events: any[];
    authorizers: {};
};
export function validateConditions(conditions: any, functionName: any): void;
export function validateListenerArn(listenerArn: any, functionName: any): {
    albId: any;
    listenerId: any;
};
export function validatePriorities(albEvents: any): void;
export function validateEventAuthorizers(event: any, authorizers: any, functionName: any): any;
export function validateAlbAuth(auth: any): any;
export function validateAlbHealthCheck(event: any): any;
