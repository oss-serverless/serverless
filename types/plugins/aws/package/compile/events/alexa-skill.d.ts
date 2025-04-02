export = AwsCompileAlexaSkillEvents;
declare class AwsCompileAlexaSkillEvents {
    constructor(serverless: any);
    serverless: any;
    provider: any;
    hooks: {
        initialize: () => void;
        'package:compileEvents': () => Promise<void>;
    };
    compileAlexaSkillEvents(): void;
}
