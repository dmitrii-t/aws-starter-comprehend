import { ApiGatewayConstruct } from '../apigateway';
import { ConnectionType, HttpIntegrationProps, VpcLink } from '@aws-cdk/aws-apigateway';

declare module '../apigateway' {
  interface ApiGatewayConstruct {
    withVpcIntegration(method: string, resourceName: string, integrationPath: string, props?: ApiGatewayProps): ApiGatewayConstruct;
  }
}

export interface ApiGatewayProps {
  cors?: {
    origin: string;
    allowHeaders?: string;
  }
  vpcLink?: VpcLink
}

/**
 * Patches API Gateway with the ability to configure VPC integration
 *
 */
export function patchApiGatewayConstructWithVpcIntegration() {

  /**
   * Configures VPC integration
   *
   * @param httpMethod
   * @param resourceName
   * @param integrationPath
   * @param props
   */
  ApiGatewayConstruct.prototype.withVpcIntegration = function (httpMethod: string, resourceName: string, integrationPath: string, props?: ApiGatewayProps) {

    // Defines integration props
    let integrationProps: HttpIntegrationProps = {};

    if (props && props.vpcLink) {
      // Vpc integration props
      const vpcIntegrationProps: HttpIntegrationProps = {
        options: {
          connectionType: ConnectionType.VpcLink,
          vpcLink: props.vpcLink
        }
      };

      // Updates integration props
      integrationProps = Object.assign(integrationProps, vpcIntegrationProps);

      // Adds Vpc link as dependency
      this.node.addDependency(props.vpcLink);
    }

    const resource = this.resource(resourceName)
      .addHttpProxyIntegration(httpMethod, integrationPath, integrationProps);

    // Applies provided props
    if (props && props.cors) {
      resource.addCors({allowMethods: [httpMethod], ...props.cors})
    }

    return this;
  }

}
