import { CustomConstruct } from '../';
import * as apigateway from '@aws-cdk/aws-apigateway';
import {
  HttpIntegration,
  HttpIntegrationProps,
  IRestApiResource,
  LambdaIntegrationOptions,
  MethodOptions,
  PassthroughBehavior,
  ResourceOptions
} from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/cdk';
import { AuthorizationType } from '@aws-cdk/aws-apigateway';

// Allowed headers
const CORS_DEFAULT_ALLOW_HEADERS = [
  'Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'
].join(',');

export interface CorsProps {
  origin: string;
  allowMethods: string[];
  allowHeaders?: string;
}

/**
 * Construct to build and configure API Gateway
 *
 */
export class ApiGatewayConstruct extends CustomConstruct<apigateway.RestApi> {

  private resourceBuilders: { [key: string]: ApiResourceConstruct } = {};

  constructor(scope: cdk.Construct, id: string = 'ApiGateway') {
    super(scope, id);
    this.instance = new apigateway.RestApi(this, id);
  }

  /**
   * Creates or or simply returns specified resource
   *
   * @param path
   * @param resourceBuilderProvider
   */
  resource(path: string, resourceBuilderProvider: (path: string) => ApiResourceConstruct = this.defaultResourceProvider): ApiResourceConstruct {

    // Returns the root if path is just '/'
    if (path === '/') {
      return this.root();
    }

    const segments = path.split('/');
    let resource = segments[0] || segments[1];

    if (!(resource in this.resourceBuilders)) {
      this.resourceBuilders[resource] = resourceBuilderProvider(resource)
    }

    return this.resourceBuilders[resource]
  }

  /**
   * Returns root resource
   */
  root(): ApiResourceConstruct {
    return this.resourceBuilders['/'] = new ApiResourceConstruct(this, this.instance.root);
  }

  private defaultResourceProvider = (path: string): ApiResourceConstruct => {
    const resource = this.instance.root.addResource(path);
    return new ApiResourceConstruct(this, resource)
  }

}

export class ApiResourceConstruct {

  constructor(private apiGatewayConstruct: ApiGatewayConstruct, private resource: IRestApiResource) {
  }

  /**
   * Returns instance of API Gateway Construct for the resource. It is useful
   * when to have fluent API where you can chain multiple method calls to build the API in form of
   *
   *
   */
  getApiGatewayConstruct(): ApiGatewayConstruct {
    return this.apiGatewayConstruct;
  }

  /**
   * Configures CORS policies for current resource
   *
   * @param props
   */
  addCors(props: CorsProps): ApiResourceConstruct {
    const {
      origin, allowMethods, allowHeaders
    } = props;

    const localAllowMethods: string[] = ['OPTIONS'].concat(allowMethods);

    const mockIntegration = new apigateway.MockIntegration({
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
    });

    const method: MethodOptions = {
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
    };

    // Instruments OPTION http method to return CORS policies
    this.resource.addMethod('OPTIONS', mockIntegration, method);
    return this;
  }

  /**
   * Adds lambda PROXY integration to current API Gateway
   *
   * @param httpMethod
   * @param handler
   * @param options
   */
  addLambdaProxyIntegration(httpMethod: string, handler: lambda.Function, options?: LambdaIntegrationOptions): ApiResourceConstruct {
    const integrationProps: LambdaIntegrationOptions = {
      // True is the default value, just to be explicit
      proxy: true,
      // Overrides
      ...options,
    };
    this.resource.addMethod(httpMethod, new apigateway.LambdaIntegration(handler, integrationProps));
    return this;
  }

  /**
   * Adds HTTP proxy integration to API Gateway
   *
   * @param httpMethod
   * @param url
   * @param integrationProps
   * @param methodProps
   */
  addHttpProxyIntegration(httpMethod: string, url: string, integrationProps?: HttpIntegrationProps, methodProps?: MethodOptions): ApiResourceConstruct {
    //
    const method: MethodOptions = {
      authorizationType: AuthorizationType.None,
      // requestParameters: {
      //   'method.request.path.proxy': true
      // },
      // methodResponses: [{
      //   statusCode: '200'
      // }],
      // Overrides
      ...methodProps
    };

    const integration: HttpIntegration = new HttpIntegration(url, {
      options: {
        passthroughBehavior: PassthroughBehavior.WhenNoMatch,
        // requestParameters: {
        //   'integration.request.path.proxy': 'method.request.path.proxy',
        // },
        // integrationResponses: [{
        //   statusCode: '200'
        // }]
      },
      httpMethod: httpMethod,
      proxy: true,
      // Overrides
      ...integrationProps
    });
    this.resource.addMethod(httpMethod, integration, method);
    return this;
  }

}

