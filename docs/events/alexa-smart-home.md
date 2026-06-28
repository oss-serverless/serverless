# Alexa Smart Home

An [Alexa Smart Home Skill](https://developer.amazon.com/en-US/docs/alexa/smarthome/understand-the-smart-home-skill-api.html) lets customers control smart-home devices with Amazon Alexa. osls can wire an `alexaSmartHome` event to a Lambda function so that Alexa invokes the function to handle Smart Home directives.

This will enable your Lambda function to be called by an Alexa Smart Home Skill.
`amzn1.ask.skill.xx-xx-xx-xx` is an application ID for Alexa Smart Home. You need to sign up [Amazon Developer Console](https://developer.amazon.com/) and get your application ID.
After deploying, add your deployed Lambda function ARN to which this event is attached to the Service Endpoint under Configuration on Amazon Developer Console.

Please see [Steps to Create a Smart Home Skill](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/steps-to-create-a-smart-home-skill) for more info.

## Simple event definition

```yaml
functions:
  mySkill:
    handler: mySkill.handler
    events:
      - alexaSmartHome: amzn1.ask.skill.xx-xx-xx-xx
```

## Enabling / Disabling

**Note:** `alexaSmartHome` events are enabled by default.

This will create and attach a alexaSmartHome event for the `mySkill` function which is disabled. If enabled it will call
the `mySkill` function by an Alexa Smart Home Skill.

```yaml
functions:
  mySkill:
    handler: mySkill.handler
    events:
      - alexaSmartHome:
          appId: amzn1.ask.skill.xx-xx-xx-xx
          enabled: false
```

---

[← All Events](./README.md) · [Docs Home](../README.md)
