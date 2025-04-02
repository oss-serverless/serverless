export function checkForChanges(): Promise<any>;
export function getMostRecentObjects(): Promise<any>;
export function getFunctionsEarliestLastModifiedDate(): Promise<any>;
export function getObjectMetadata(objects: any): Promise<any[]>;
export function checkIfDeploymentIsNecessary(objects: any, funcLastModifiedDate: any): Promise<void>;
/**
 * @description Cloudwatch imposes a hard limit of 2 subscription filter per log group.
 * If we change a cloudwatchLog event entry to add a subscription filter to a log group
 * that already had two before, it will throw an error because CloudFormation firstly
 * tries to create and replace the new subscription filter (therefore hitting the limit)
 * before deleting the old one. This precompile process aims to delete existent
 * subscription filters of functions that a new filter was provided, by checking the
 * current ARN with the new one that will be generated.
 * See: https://github.com/serverless/serverless/issues/3447
 */
export function checkLogGroupSubscriptionFilterResourceLimitExceeded(): Promise<void>;
export function fixLogGroupSubscriptionFilters(params: any): Promise<false | any[]>;
export function getLogicalIdFromFilterName(filterName: any): any;
export function isInternalSubscriptionFilter(stackName: any, logicalResourceId: any, physicalResourceId: any): Promise<boolean>;
