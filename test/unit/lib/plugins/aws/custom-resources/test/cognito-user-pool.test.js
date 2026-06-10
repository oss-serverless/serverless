'use strict';

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const utils = require('../../../../../../../lib/plugins/aws/custom-resources/resources/utils');

describe('Custom resource Cognito user pool permissions', () => {
  let sentCommands;
  let addPermission;
  let removePermission;

  beforeEach(() => {
    sentCommands = [];

    class LambdaClient {
      constructor() {
        this.config = {};
      }

      send(command) {
        sentCommands.push(command);
        return Promise.resolve();
      }
    }

    class AddPermissionCommand {
      constructor(input) {
        this.input = input;
      }
    }

    class RemovePermissionCommand {
      constructor(input) {
        this.input = input;
      }
    }

    ({ addPermission, removePermission } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/lib/permissions',
      {
        '@aws-sdk/client-lambda': {
          LambdaClient,
          AddPermissionCommand,
          RemovePermissionCommand,
        },
      }
    ));
  });

  it('should pass qualifier when adding Lambda permission', async () => {
    await addPermission({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      userPoolName: 'orders-pool',
      partition: 'aws',
      region: 'us-east-1',
      accountId: '123456789012',
      userPoolId: 'us-east-1_abc123',
    });

    expect(sentCommands[0].input).to.include({
      FunctionName: 'orders',
      Qualifier: 'provisioned',
    });
  });

  it('should pass qualifier when removing Lambda permission', async () => {
    await removePermission({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      userPoolName: 'orders-pool',
      region: 'us-east-1',
    });

    expect(sentCommands[0].input).to.include({
      FunctionName: 'orders',
      Qualifier: 'provisioned',
    });
  });
});

describe('Custom resource Cognito user pool handler', () => {
  it('should reject create with a descriptive missing-pool error', async () => {
    const findUserPoolByName = sinon.stub().resolves(null);
    const addPermission = sinon.stub().resolves();
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await expect(
      handler(
        {
          RequestType: 'Create',
          ResourceProperties: {
            FunctionName: 'orders',
            FunctionQualifier: 'provisioned',
            UserPoolName: 'orders-pool',
            UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
          },
        },
        {}
      )
    ).to.be.rejectedWith('Could not find Cognito User Pool "orders-pool"');

    expect(addPermission).to.not.have.been.called;
  });

  it('should reject update with a descriptive missing-pool error', async () => {
    const findUserPoolByName = sinon.stub().resolves(null);
    const addPermission = sinon.stub().resolves();
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await expect(
      handler(
        {
          RequestType: 'Update',
          ResourceProperties: {
            FunctionName: 'orders',
            FunctionQualifier: 'provisioned',
            UserPoolName: 'orders-pool',
            UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
          },
          OldResourceProperties: {
            FunctionName: 'orders-old',
            FunctionQualifier: 'provisioned',
            UserPoolName: 'orders-pool',
            UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
          },
        },
        {}
      )
    ).to.be.rejectedWith('Could not find Cognito User Pool "orders-pool"');

    expect(addPermission).to.not.have.been.called;
    expect(updateConfiguration).to.not.have.been.called;
  });

  it('should add permission before updating the user pool on create', async () => {
    const calls = [];
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().callsFake(async (input) => {
      calls.push(['addPermission', input]);
    });
    const updateConfiguration = sinon.stub().callsFake(async (input) => {
      calls.push(['updateConfiguration', input]);
    });
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await handler(
      {
        RequestType: 'Create',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          UserPoolName: 'orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
      },
      {}
    );

    expect(addPermission.args[0][0]).to.include({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      userPoolName: 'orders-pool',
      userPoolId: 'us-east-1_abc123',
    });
    expect(updateConfiguration.args[0][0]).to.include({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      userPoolName: 'orders-pool',
    });
    expect(calls.map(([name]) => name)).to.deep.equal(['addPermission', 'updateConfiguration']);
  });

  it('should add qualified permission before migrating existing trigger target', async () => {
    const calls = [];
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().callsFake(async (input) => {
      calls.push(['addPermission', input]);
    });
    const updateConfiguration = sinon.stub().callsFake(async (input) => {
      calls.push(['updateConfiguration', input]);
    });
    const removePermission = sinon.stub().callsFake(async (input) => {
      calls.push(['removePermission', input]);
    });
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await handler(
      {
        RequestType: 'Update',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          UserPoolName: 'orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
        OldResourceProperties: {
          FunctionName: 'orders',
          UserPoolName: 'orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
      },
      {}
    );

    expect(addPermission).to.have.been.calledOnce;
    expect(addPermission.args[0][0]).to.include({
      functionName: 'orders',
      functionQualifier: 'provisioned',
      userPoolName: 'orders-pool',
      userPoolId: 'us-east-1_abc123',
    });
    expect(updateConfiguration.args[0][0]).to.include({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      previousLambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders',
      userPoolName: 'orders-pool',
    });
    expect(removePermission.args[0][0]).to.include({
      functionName: 'orders',
      userPoolName: 'orders-pool',
    });
    expect(removePermission.args[0][0]).to.have.property('functionQualifier', undefined);
    expect(removeConfiguration).to.not.have.been.called;
    expect(calls.map(([name]) => name)).to.deep.equal([
      'addPermission',
      'updateConfiguration',
      'removePermission',
    ]);
  });

  it('should continue migration when qualified permission already exists', async () => {
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().rejects({ name: 'ResourceConflictException' });
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await handler(
      {
        RequestType: 'Update',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          UserPoolName: 'orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
        OldResourceProperties: {
          FunctionName: 'orders',
          UserPoolName: 'orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
      },
      {}
    );

    expect(updateConfiguration).to.have.been.calledOnce;
    expect(removePermission).to.have.been.calledOnce;
  });

  it('should not remove previous Lambda arn from a new user pool', async () => {
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().resolves();
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon.stub().resolves();
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await handler(
      {
        RequestType: 'Update',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          UserPoolName: 'new-orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
        OldResourceProperties: {
          FunctionName: 'orders',
          UserPoolName: 'old-orders-pool',
          UserPoolConfigs: [{ Trigger: 'PreSignUp' }],
        },
      },
      {}
    );

    expect(updateConfiguration.args[0][0]).to.include({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      previousLambdaArn: undefined,
      userPoolName: 'new-orders-pool',
    });
    expect(removeConfiguration.args[0][0]).to.include({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders',
      userPoolName: 'old-orders-pool',
    });
  });

  it('should remove trigger configuration when Lambda permission is already missing', async () => {
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().resolves();
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon.stub().rejects({ name: 'ResourceNotFoundException' });
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await handler(
      {
        RequestType: 'Delete',
        ResourceProperties: {
          FunctionName: 'orders',
          FunctionQualifier: 'provisioned',
          UserPoolName: 'orders-pool',
        },
      },
      {}
    );

    expect(removeConfiguration).to.have.been.calledOnce;
  });

  it('should rethrow AccessDeniedException when removing Lambda permission during delete', async () => {
    const findUserPoolByName = sinon.stub().resolves({ Id: 'us-east-1_abc123' });
    const addPermission = sinon.stub().resolves();
    const updateConfiguration = sinon.stub().resolves();
    const removePermission = sinon
      .stub()
      .rejects(Object.assign(new Error('denied'), { name: 'AccessDeniedException' }));
    const removeConfiguration = sinon.stub().resolves();

    const { handler } = proxyquire(
      '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/handler',
      {
        '../utils': {
          ...utils,
          getEnvironment: () => ({
            Partition: 'aws',
            Region: 'us-east-1',
            AccountId: '123456789012',
          }),
          handlerWrapper: (wrappedHandler) => wrappedHandler,
        },
        './lib/permissions': { addPermission, removePermission },
        './lib/user-pool': {
          findUserPoolByName,
          updateConfiguration,
          removeConfiguration,
        },
      }
    );

    await expect(
      handler(
        {
          RequestType: 'Delete',
          ResourceProperties: {
            FunctionName: 'orders',
            FunctionQualifier: 'provisioned',
            UserPoolName: 'orders-pool',
          },
        },
        {}
      )
    ).to.be.rejectedWith('denied');

    expect(removeConfiguration).to.not.have.been.called;
  });
});

describe('Custom resource Cognito user pool configuration', () => {
  const makeUserPoolLib = (responses) => {
    const sentCommands = [];

    class CognitoIdentityProviderClient {
      constructor() {
        this.config = {};
      }

      send(command) {
        sentCommands.push(command);
        const response = responses.shift();
        if (response instanceof Error) return Promise.reject(response);
        return Promise.resolve(response);
      }
    }

    class ListUserPoolsCommand {
      constructor(input) {
        this.input = input;
      }
    }

    class DescribeUserPoolCommand {
      constructor(input) {
        this.input = input;
      }
    }

    class UpdateUserPoolCommand {
      constructor(input) {
        this.input = input;
      }
    }

    return {
      sentCommands,
      lib: proxyquire(
        '../../../../../../../lib/plugins/aws/custom-resources/resources/cognito-user-pool/lib/user-pool',
        {
          '@aws-sdk/client-cognito-identity-provider': {
            CognitoIdentityProviderClient,
            ListUserPoolsCommand,
            DescribeUserPoolCommand,
            UpdateUserPoolCommand,
          },
        }
      ),
    };
  };

  it('should reject update with a descriptive missing-pool error', async () => {
    const { lib } = makeUserPoolLib([{ UserPools: [] }]);

    await expect(
      lib.updateConfiguration({
        lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
        userPoolName: 'orders-pool',
        userPoolConfigs: [{ Trigger: 'PreSignUp' }],
        region: 'us-east-1',
      })
    ).to.be.rejectedWith('Could not find Cognito User Pool "orders-pool"');
  });

  it('should no-op delete when the target user pool no longer exists', async () => {
    const { sentCommands, lib } = makeUserPoolLib([{ UserPools: [] }]);

    await lib.removeConfiguration({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders:provisioned',
      userPoolName: 'orders-pool',
      region: 'us-east-1',
    });

    expect(sentCommands.map((command) => command.constructor.name)).to.deep.equal([
      'ListUserPoolsCommand',
    ]);
  });
});
