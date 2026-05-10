# Plugin Search

Search for a specific plugin based on a search query. Connected to the [Serverless plugin registry](https://github.com/serverless/plugins).

```bash
serverless plugin search --query query
```

## Options

- `--query` or `-q` The query you want to use for your search. **Required**.

## Provided lifecycle events

- `plugin:search:search`

## Examples

### Search for a `sqs` plugin

```bash
serverless plugin search --query sqs
```
