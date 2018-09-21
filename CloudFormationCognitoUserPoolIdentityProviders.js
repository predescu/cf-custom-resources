const AWS = require('aws-sdk');

async function deleteIdentityProvider(cognitoIdentityServiceProvider, userPoolId, providerName) {
  const response = await cognitoIdentityServiceProvider.describeIdentityProvider({
    UserPoolId: userPoolId,
    ProviderName: providerName
  }).promise();

  if (response.IdentityProvider.UserPoolId) {
    await cognitoIdentityServiceProvider.deleteIdentityProvider({
      UserPoolId: response.IdentityProvider.UserPoolId,
      ProviderName: providerName
    }).promise();
  }
}

async function sendCloudFormationResponse(event, responseStatus, responseData) {
  const params = {
    FunctionName: 'CloudFormationSendResponse',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      ResponseURL: event.ResponseURL,
      ResponseStatus: responseStatus,
      ResponseData: responseData
    })
  };

  const lambda = new AWS.Lambda();
  const response = await lambda.invoke(params).promise();

  if (response.FunctionError) {
    const responseError = JSON.parse(response.Payload);
    throw new Error(responseError.errorMessage);
  }
}

exports.handler = async (event) => {
  try {
    const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

    switch (event.RequestType) {
      case 'Create':
        console.info(`CFE-Cognito-UserPoolFederation ${event.RequestType} - IN PROGRESS`);
        await cognitoIdentityServiceProvider.createIdentityProvider({
          UserPoolId: event.ResourceProperties.UserPoolId,
          ProviderName: event.ResourceProperties.ProviderName,
          ProviderType: event.ResourceProperties.ProviderType,
          ProviderDetails: event.ResourceProperties.ProviderDetails,
          AttributeMapping: event.ResourceProperties.AttributeMapping,
        }).promise();
        break;

      case 'Update':
        console.info(`CFE-Cognito-UserPoolFederation ${event.RequestType} - IN PROGRESS`);
        await deleteIdentityProvider(cognitoIdentityServiceProvider,
          event.OldResourceProperties.UserPoolId,
          event.OldResourceProperties.ProviderName);
        await cognitoIdentityServiceProvider.createIdentityProvider({
          UserPoolId: event.ResourceProperties.UserPoolId,
          ProviderName: event.ResourceProperties.ProviderName,
          ProviderType: event.ResourceProperties.ProviderType,
          ProviderDetails: event.ResourceProperties.ProviderDetails,
          AttributeMapping: event.ResourceProperties.AttributeMapping
        }).promise();
        break;

      case 'Delete':
        console.info(`CFE-Cognito-UserPoolFederation ${event.RequestType} - IN PROGRESS`);
        await deleteIdentityProvider(cognitoIdentityServiceProvider,
          event.ResourceProperties.UserPoolId,
          event.ResourceProperties.ProviderName);
        break;
    }

    await sendCloudFormationResponse(event, 'SUCCESS');
    console.info(`CFE-Cognito-UserPoolFederation ${event.RequestType} - SUCCESS`);
  } catch (error) {
    console.error(`CFE-Cognito-UserPoolFederation ${event.RequestType} - FAILED:`, error);
    await sendCloudFormationResponse(event, 'FAILED', event);
  }
};
