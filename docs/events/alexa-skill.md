# Alexa Skill

An [Alexa Skill](https://developer.amazon.com/en-US/docs/alexa/ask-overviews/what-is-the-alexa-skills-kit.html) is a voice-driven capability for Amazon Alexa, built with the Alexa Skills Kit (ASK). osls can wire an `alexaSkill` event to a Lambda function so that Alexa invokes the function to handle requests from your skill.

## Simple event definition

This definition will enable your Lambda function to be called by an Alexa Skill kit.

`amzn1.ask.skill.xx-xx-xx-xx-xx` is an example skill ID for the Alexa Skills kit. You will receive a skill ID once you register and create a skill in the [Amazon Developer Console](https://developer.amazon.com/).
After deploying, add your deployed Lambda function ARN associated with this event to the Service Endpoint under Configuration on your Amazon Developer Console.

```yaml
functions:
  mySkill:
    handler: mySkill.handler
    events:
      - alexaSkill: amzn1.ask.skill.xx-xx-xx-xx-xx
```

You can find detailed guides on how to create an Alexa Skill with osls using Node.js [here](https://github.com/serverless/examples/tree/master/aws-node-alexa-skill) as well as in combination with Python [here](https://github.com/serverless/examples/tree/master/aws-python-alexa-skill).

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

---

[← All Events](./README.md) · [Docs Home](../README.md)
