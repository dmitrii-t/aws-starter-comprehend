import { ApiGatewayConstruct } from '../apigateway';
import { ConnectionType, HttpIntegrationProps, VpcLink } from '@aws-cdk/aws-apigateway';


// Adds ElasticsearchConstruct stream methods  declaration
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

export function patchApiGatewayConstructWithVpcIntegration() {

  ApiGatewayConstruct.prototype.withVpcIntegration = function (method: string, resourceName: string, integrationPath: string, props?: ApiGatewayProps) {

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

    const resource = this.resource(resourceName);
    resource.addHttpProxyIntegration(method, integrationPath, integrationProps);

    // Applies provided props
    if (props && props.cors) {
      resource.addCors({allowMethods: [method], ...props.cors})
    }

    return this;
  }

}
