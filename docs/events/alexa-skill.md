# Alexa Skill

## Event definition

This definition will enable your Lambda function to be called by an Alexa Skill kit.

`amzn1.ask.skill.xx-xx-xx-xx-xx` is an example skill ID for the Alexa Skills kit. You will receive a skill ID once you register and create a skill in the [Amazon Developer Console](https://developer.amazon.com/).
After deploying, add your deployed Lambda function ARN associated with this event to the Service Endpoint under Configuration on your Amazon Developer Console.

```yml
functions:
  mySkill:
    handler: mySkill.handler
    events:
      - alexaSkill: amzn1.ask.skill.xx-xx-xx-xx-xx
```

You can find detailed guides on how to create an Alexa Skill with Serverless using Node.js [here](https://github.com/serverless/examples/tree/master/aws-node-alexa-skill) as well as in combination with Python [here](https://github.com/serverless/examples/tree/master/aws-python-alexa-skill).

## Enabling / Disabling

**Note:** `alexaSkill` events are enabled by default.

This will create and attach a disabled alexaSkill event for the `mySkill` function. If `enabled` is set to `true`, the attached alexaSkill will execute the function.

```yaml
functions:
  mySkill:
    handler: mySkill.handler
    events:
      - alexaSkill:
          appId: amzn1.ask.skill.xx-xx-xx-xx
          enabled: false
```
