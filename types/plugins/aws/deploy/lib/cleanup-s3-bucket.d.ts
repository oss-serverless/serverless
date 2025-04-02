export function getObjectsToRemove(): Promise<any>;
export function removeObjects(objectsToRemove: any): Promise<void>;
export function cleanupS3Bucket(): Promise<void>;
export function cleanupArtifactsForEmptyChangeSet(): Promise<void>;
