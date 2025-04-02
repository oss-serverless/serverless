export = awsRequest;
/** Execute request to AWS service
 * @param {Object|string} [service] - Description of the service to call
 * @prop [service.name] - Name of the service to call, support subclasses
 * @prop [service.params] - Parameters to apply when creating the service and doing the request
 * @prop [service.params.credentials] - AWS Credentials to use
 * @prop [service.params.useCache ] - Wether to reuse result of the same request cached locally
 * @prop [service.params.region] - Region in which the call should be made (default to us-east-1)
 * @prop [service.params.isS3TransferAccelerationEnabled] - Use s3 acceleration when available for the request
 * @param {String} method - Method to call
 * @param {Array} args - Argument for the method call
 */
declare function awsRequest(service?: any | string, method: string, ...args: any[]): Promise<any>;
declare namespace awsRequest {
    let memoized: any;
}
