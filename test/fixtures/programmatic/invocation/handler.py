import json
import os

ENV_KEY_PREFIXES = ('AWS_', 'LAMBDA_', 'SLS_', 'PROVIDER_LEVEL_VAR', 'FUNCTION_LEVEL_VAR',
                    'PARAM_ENV_VAR', 'NULL_VAR', 'IS_LOCAL', 'NODE_PATH', 'LD_LIBRARY_PATH',
                    'PATH', 'LANG')


def handler(event, context):
    env_subset = {k: v for k, v in os.environ.items() if k.startswith(ENV_KEY_PREFIXES)}
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Invoked",
            "env": env_subset
        })
    }
