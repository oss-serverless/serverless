# IoT Fleet Provisioning

AWS IoT fleet provisioning lets you register large numbers of devices from a shared provisioning template. osls wires a Lambda function as the template's [pre-provisioning hook](https://docs.aws.amazon.com/iot/latest/developerguide/pre-provisioning-hook.html), which AWS invokes to validate each device before it is provisioned. See the [AWS IoT fleet provisioning documentation](https://docs.aws.amazon.com/iot/latest/developerguide/provision-wo-cert.html).

## Simple event definition

This will create an [IoT Provisioning Template](https://docs.aws.amazon.com/iot/latest/developerguide/provision-template.html) with a [pre-provision hook](https://docs.aws.amazon.com/iot/latest/developerguide/pre-provisioning-hook.html) lambda. Both `templateBody` and `provisioningRoleArn` are required fields.

```yaml
functions:
  smartHomeValidation:
    handler: smartHomeValidation.handler
    events:
      - iotFleetProvisioning:
          templateBody: ${file(template.json)}
          provisioningRoleArn: arn:aws:iam::12345678910:role/provisioning-role
```

[Example of template.json file](https://docs.amazonaws.cn/en_us/iot/latest/developerguide/provision-template.html#bulk-template-example)

## Enabling / Disabling

**Note:** IoT templates provisioned via `iotFleetProvisioning` events are enabled by default.

This will disable the template.

```yaml
functions:
  smartHomeValidation:
    handler: smartHomeValidation.handler
    events:
      - iotFleetProvisioning:
          templateBody: ${file(template.json)}
          provisioningRoleArn: arn:aws:iam::12345678910:role/provisioning-role
          enabled: false
```

## Specify a template name

Created template name can be enforced using the `templateName` property.

```yaml
functions:
  smartHomeValidation:
    handler: smartHomeValidation.handler
    events:
      - iotFleetProvisioning:
          templateName: SmartBulbTemplate
          templateBody: ${file(template.json)}
          provisioningRoleArn: arn:aws:iam::12345678910:role/provisioning-role
```

---

[← All Events](./README.md) · [Docs Home](../README.md)
