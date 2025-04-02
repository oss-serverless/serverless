declare function _exports(code: any, message: any, { serviceConfig }?: {}): void;
declare namespace _exports {
    export { triggeredDeprecations };
    export let defaultMode: "warn:summary";
    export function printSummary(): Promise<void>;
}
export = _exports;
declare const triggeredDeprecations: Set<any>;
