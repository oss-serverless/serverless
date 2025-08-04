'use strict';

const awsLog = require('log').get('aws');
const awsRequest = require('@serverless/test/aws-request');

// Support for both AWS SDK v2 and v3
const getCognitoClient = () => {
  if (process.env.SLS_AWS_SDK_V3 === '1') {
    // AWS SDK v3
    const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
    const {
      CreateUserPoolCommand,
      CreateUserPoolClientCommand,
      DeleteUserPoolCommand,
      ListUserPoolsCommand,
      DescribeUserPoolCommand,
      AdminCreateUserCommand,
      AdminSetUserPasswordCommand,
      InitiateAuthCommand,
    } = require('@aws-sdk/client-cognito-identity-provider');

    const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });

    return {
      createUserPool: (params) => client.send(new CreateUserPoolCommand(params)),
      createUserPoolClient: (params) => client.send(new CreateUserPoolClientCommand(params)),
      deleteUserPool: (params) => client.send(new DeleteUserPoolCommand(params)),
      listUserPools: (params) => client.send(new ListUserPoolsCommand(params)),
      describeUserPool: (params) => client.send(new DescribeUserPoolCommand(params)),
      adminCreateUser: (params) => client.send(new AdminCreateUserCommand(params)),
      adminSetUserPassword: (params) => client.send(new AdminSetUserPasswordCommand(params)),
      initiateAuth: (params) => client.send(new InitiateAuthCommand(params)),
    };
  }
  // AWS SDK v2
  const CognitoIdentityServiceProviderService = require('aws-sdk').CognitoIdentityServiceProvider;
  return {
    createUserPool: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'createUserPool', params),
    createUserPoolClient: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'createUserPoolClient', params),
    deleteUserPool: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'deleteUserPool', params),
    listUserPools: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'listUserPools', params),
    describeUserPool: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'describeUserPool', params),
    adminCreateUser: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'adminCreateUser', params),
    adminSetUserPassword: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'adminSetUserPassword', params),
    initiateAuth: (params) =>
      awsRequest(CognitoIdentityServiceProviderService, 'initiateAuth', params),
  };
};

const cognito = getCognitoClient();

async function createUserPool(name, config = {}) {
  const params = Object.assign({}, { PoolName: name }, config);
  return cognito.createUserPool(params);
}

async function createUserPoolClient(name, userPoolId) {
  const params = {
    ClientName: name,
    UserPoolId: userPoolId,
    ExplicitAuthFlows: ['USER_PASSWORD_AUTH'],
  };
  return cognito.createUserPoolClient(params);
}

async function deleteUserPool(name) {
  return findUserPoolByName(name).then((pool) => cognito.deleteUserPool({ UserPoolId: pool.Id }));
}

async function deleteUserPoolById(poolId) {
  return cognito.deleteUserPool({
    UserPoolId: poolId,
  });
}

async function findUserPoolByName(name) {
  awsLog.debug('find cognito user pool by name %s', name);

  const params = {
    MaxResults: 60,
  };

  const pools = [];
  async function recursiveFind(nextToken) {
    if (nextToken) params.NextToken = nextToken;
    return cognito.listUserPools(params).then((result) => {
      pools.push(...result.UserPools.filter((pool) => pool.Name === name));
      if (result.NextToken) return recursiveFind(result.NextToken);
      switch (pools.length) {
        case 0:
          return null;
        case 1:
          return pools[0];
        default:
          throw new Error(`Found more than one pool named '${name}'`);
      }
    });
  }

  return recursiveFind();
}

async function findUserPools() {
  const params = { MaxResults: 60 };

  const pools = [];
  async function recursiveFind(nextToken) {
    if (nextToken) params.NextToken = nextToken;
    return cognito.listUserPools(params).then((result) => {
      pools.push(...result.UserPools.filter((pool) => pool.Name.includes(' CUP ')));
      if (result.NextToken) return recursiveFind(result.NextToken);
      return null;
    });
  }

  return recursiveFind().then(() => pools);
}

async function describeUserPool(userPoolId) {
  return cognito
    .describeUserPool({
      UserPoolId: userPoolId,
    })
    .then((result) => {
      awsLog.debug('cognito.describeUserPool %s %j', userPoolId, result);
      return result;
    });
}

async function createUser(userPoolId, username, password) {
  const params = {
    UserPoolId: userPoolId,
    Username: username,
    TemporaryPassword: password,
  };
  return cognito.adminCreateUser(params);
}

async function setUserPassword(userPoolId, username, password) {
  const params = {
    UserPoolId: userPoolId,
    Username: username,
    Password: password,
    Permanent: true,
  };
  return cognito.adminSetUserPassword(params);
}

async function initiateAuth(clientId, username, password) {
  const params = {
    ClientId: clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };
  return cognito.initiateAuth(params);
}

module.exports = {
  createUserPool,
  deleteUserPool,
  deleteUserPoolById,
  findUserPoolByName,
  findUserPools,
  describeUserPool,
  createUserPoolClient,
  createUser,
  setUserPassword,
  initiateAuth,
};
