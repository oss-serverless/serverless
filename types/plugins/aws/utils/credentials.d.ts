export function resolveFileProfiles(): Promise<any>;
export function resolveEnvCredentials(): {
    accessKeyId: string;
    secretAccessKey: string;
};
export function saveFileProfiles(profiles: any): Promise<any>;
