# Doctor

Print the status of any deprecations that were triggered during the last command run. This command is specific to osls: after you run a command such as `osls deploy` or `osls package`, osls records which deprecations were reported, and `osls doctor` replays that summary so you can review it without re-running the original command.

```bash
osls doctor
```

If no deprecations were reported during the last command run, osls prints `No deprecations were reported in the last command`.

## Examples

### Review deprecations from the last run

```bash
osls doctor
```

Prints the recorded deprecation summary from the most recent command, or a notice that none were reported.

## Related configuration

How deprecations are surfaced and which ones are suppressed is controlled by the `deprecationNotificationMode` and `disabledDeprecations` settings in `serverless.yml` (and their `SLS_DEPRECATION_NOTIFICATION_MODE` / `SLS_DEPRECATION_DISABLE` environment-variable equivalents). See the [Deprecations guide](../guides/deprecations.md) for the full list of deprecation codes and how to resolve or silence them.

---

[← All Commands](./README.md) · [Docs Home](../README.md)
