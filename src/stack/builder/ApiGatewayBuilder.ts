import { Builder } from './Builder';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { IRestApiResource, PassthroughBehavior } from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';

export class ApiGatewayBuilder extends Builder<apigateway.RestApi> {

  protected construct(): void {
    this.instance = new apigateway.RestApi(this.scope, this.name || 'ApiGateway');
  }

  root() {
    return new ResourceBuilder(this, () => this.instance.root)
  }
}

export class ResourceBuilder {

  constructor(private gatewayBuilder: ApiGatewayBuilder,
              private resourceProvider: () => IRestApiResource) {
  }

  addCors(origin: string, allowMethods: string[] = [], allowHeaders: string = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'): ApiGatewayBuilder {
    const allowMthds: string[] = ['OPTIONS'].concat(allowMethods);
    this.gatewayBuilder.postConstructs.push(() => {
      this.resourceProvider().addMethod('OPTIONS', new apigateway.MockIntegration({
        passthroughBehavior: PassthroughBehavior.Never,
        requestTemplates: {
          'application/json': '{"statusCode": 200}'
        },
        integrationResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': `\'${allowHeaders}\'`,
            'method.response.header.Access-Control-Allow-Methods': `\'${allowMthds}\'`,
            'method.response.header.Access-Control-Allow-Origin': `\'${origin}\'`,
          },
          responseTemplates: {
            'application/json': ''
          }
        }],
      }), {
        methodResponses: [{
          statusCode: '200',
          responseModels: {
            'application/json': new apigateway.EmptyModel()
          },
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': false,
            'method.response.header.Access-Control-Allow-Methods': false,
            'method.response.header.Access-Control-Allow-Origin': false,
          }
        }]
      });
    });
    return this.gatewayBuilder;
  }

  addLambdaHandler(httpMethod: string,  handler: lambda.Function) {
    this.gatewayBuilder.postConstructs.push(() => {
      this.resourceProvider().addMethod(httpMethod, new apigateway.LambdaIntegration(handler));
    });
    return this.gatewayBuilder;
  }

}

