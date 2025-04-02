export = ServerlessError;
declare class ServerlessError extends Error {
    constructor(message: any, code: any, options?: {});
    code: any;
    decoratedMessage: any;
}
