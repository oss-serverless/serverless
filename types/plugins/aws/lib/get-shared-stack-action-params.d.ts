export function getSharedStackActionParams({ templateUrl, templateBody }: {
    templateUrl: any;
    templateBody: any;
}): {
    StackName: any;
    Capabilities: string[];
    Parameters: any[];
    Tags: {
        Key: string;
        Value: any;
    }[];
};
