declare function _exports(exception: any): {
    title: any;
    name: any;
    stack: any;
    message: any;
    isUserError: boolean;
    code: any;
    decoratedMessage: any;
} | {
    title: string;
    message: string;
    isUserError: boolean;
    name?: undefined;
    stack?: undefined;
    code?: undefined;
    decoratedMessage?: undefined;
};
export = _exports;
