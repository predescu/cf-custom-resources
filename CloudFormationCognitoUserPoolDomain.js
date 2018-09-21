const AWS = require('aws-sdk');

async function deleteUserPoolDomain(cognitoIdentityServiceProvider, domain) {
  const response = await cognitoIdentityServiceProvider.describeUserPoolDomain({
    Domain: domain
  }).promise();

  if (response.DomainDescription.Domain) {
    await cognitoIdentityServiceProvider.deleteUserPoolDomain({
      UserPoolId: response.DomainDescription.UserPoolId,
      Domain: domain,
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
      ResponseData: responseData,
    }),
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
        await cognitoIdentityServiceProvider.createUserPoolDomain({
          UserPoolId: event.ResourceProperties.UserPoolId,
          Domain: event.ResourceProperties.Domain
        }).promise();
        break;

      case 'Update':
        await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.OldResourceProperties.Domain);

        await cognitoIdentityServiceProvider.createUserPoolDomain({
          UserPoolId: event.ResourceProperties.UserPoolId,
          Domain: event.ResourceProperties.Domain
        }).promise();
        break;

      case 'Delete':
        await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.ResourceProperties.Domain);
        break;
    }

    await sendCloudFormationResponse(event, 'SUCCESS');
    console.info(`CognitoUserPoolDomain Success for request type ${event.RequestType}`);
  } catch (error) {
    console.error(`CognitoUserPoolDomain Error for request type ${event.RequestType}:`, error);
    await sendCloudFormationResponse(event, 'FAILED');
  }
};
