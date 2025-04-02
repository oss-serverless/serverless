export function getFileStats(filepath: any): Promise<import("fs").Stats>;
export function uploadArtifacts(): Promise<void>;
export function uploadCloudFormationFile(): Promise<any>;
export function uploadStateFile(): Promise<any>;
export function getFunctionArtifactFilePaths(): Promise<any>;
export function getLayerArtifactFilePaths(): any;
export function uploadFunctionsAndLayers(): Promise<void>;
export function uploadCustomResources(): Promise<void>;
