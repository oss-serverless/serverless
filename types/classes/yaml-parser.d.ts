export = YamlParser;
declare class YamlParser {
    constructor(serverless: any);
    serverless: any;
    parse(yamlFilePath: any): Promise<object>;
}
