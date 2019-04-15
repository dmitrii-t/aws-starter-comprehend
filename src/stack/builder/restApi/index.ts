import { CustomConstruct } from '../';
import * as apigateway from '@aws-cdk/aws-apigateway';
import {
  HttpIntegrationProps,
  IRestApiResource,
  LambdaIntegrationOptions,
  PassthroughBehavior
} from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/cdk';


const CORS_DEFAULT_ALLOW_HEADERS = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token';

export interface CorsProps {
  origin: string;
  allowMethods: string[];
  allowHeaders?: string;
}

export class RestApiConstruct extends CustomConstruct<apigateway.RestApi> {

  private resourceBuilders: { [key: string]: ResourceBuilder } = {};

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);
    this.instance = new apigateway.RestApi(this, id || 'ApiGateway');
  }

  resource(path: string, resourceBuilderProvider: (path: string) => ResourceBuilder = this.defaultResourceProvider): ResourceBuilder {
    if (!(path in this.resourceBuilders)) {
      this.resourceBuilders[path] = resourceBuilderProvider(path)
    }
    return this.resourceBuilders[path]
  }

  root(): ResourceBuilder {
    return this.resource('root', () => new ResourceBuilder(this, this.instance.root));
  }

  private defaultResourceProvider = (path: string): ResourceBuilder => {
    const resource = this.instance.root.addResource(path);
    return new ResourceBuilder(this, resource)
  }

}

export class ResourceBuilder {

  constructor(private restApiConstruct: RestApiConstruct, private resource: IRestApiResource) {
  }

  addCors(props: CorsProps): RestApiConstruct {
    const {
      origin, allowMethods, allowHeaders
    } = props;

    //
    const localAllowMethods: string[] = ['OPTIONS'].concat(allowMethods);
    //
    this.resource.addMethod('OPTIONS', new apigateway.MockIntegration({
      passthroughBehavior: PassthroughBehavior.Never,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': `\'${allowHeaders || CORS_DEFAULT_ALLOW_HEADERS}\'`,
          'method.response.header.Access-Control-Allow-Methods': `\'${localAllowMethods.join(',')}\'`,
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

    return this.restApiConstruct;
  }

  addLambdaProxyIntegration(httpMethod: string, handler: lambda.Function): RestApiConstruct {
    const integrationProps: LambdaIntegrationOptions = {
      // True is the default value, just to be explicit
      proxy: true
    };
    this.resource.addMethod(httpMethod, new apigateway.LambdaIntegration(handler, integrationProps));
    return this.restApiConstruct;
  }

  addHttpProxyIntegration(httpMethod: string, url: string): RestApiConstruct {
    const integrationProps: HttpIntegrationProps = {
      // True is the default value, just to be explicit
      proxy: true
    };
    this.resource.addMethod(httpMethod, new apigateway.HttpIntegration(url, integrationProps));
    return this.restApiConstruct;
  }

}

