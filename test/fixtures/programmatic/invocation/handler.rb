require 'json'

def handler(event:, context:)
  env_subset = ENV.to_hash.select { |k, _|
    k.start_with?('AWS_', 'LAMBDA_', 'SLS_', 'PROVIDER_LEVEL_VAR', 'FUNCTION_LEVEL_VAR',
                   'PARAM_ENV_VAR', 'NULL_VAR', 'IS_LOCAL', 'NODE_PATH', 'LD_LIBRARY_PATH', 'PATH')
  }
  {"statusCode" => 200, "body" => {"message" => "Invoked", "env" => env_subset}.to_json }
end

