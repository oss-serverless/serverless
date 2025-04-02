export function checkStackProgress(action: any, cfData: any, stackUrl: any, options: any, { loggedEventIds, stackStatus, stackLatestError, firstEventId, completedResources, }: {
    loggedEventIds?: Set<any>;
    stackStatus?: any;
    stackLatestError?: any;
    firstEventId?: any;
    completedResources?: Set<any>;
}): Promise<any>;
export function monitorStack(action: any, cfData: any, options?: {}): Promise<any>;
