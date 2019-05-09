import { ElasticsearchConstruct } from '../elasticsearch';
import { RestApiConstruct } from '../apigateway';
import { ConnectionType, HttpIntegrationProps, VpcLink } from '@aws-cdk/aws-apigateway';

// Adds ElasticsearchConstruct stream methods  declaration
declare module '../elasticsearch' {
  interface ElasticsearchConstruct {
    withPrivatelyIntegratedApiGateway(method: string, resourceName: string, integrationPath:string, props?: ElasticsearchApiProps): ElasticsearchConstruct;
  }
}

export interface ElasticsearchApiProps {
  cors?: {
    origin: string;
    allowHeaders?: string;
  }
  vpcLink?: VpcLink
}

export function patchElasticsearchConstructWithApiGateway() {

  /**
   *
   * @param method
   * @param resourceName
   * @param integrationPath
   * @param props
   */
  ElasticsearchConstruct.prototype.withPrivatelyIntegratedApiGateway = function (method: string, resourceName: string, integrationPath:string, props?: ElasticsearchApiProps): ElasticsearchConstruct {
    const restApiConstruct = new RestApiConstruct(this, this.id + 'ApiGateway');
    restApiConstruct.node.addDependency(this.instance);

    let integrationProps: HttpIntegrationProps = {};

    //
    if (props && props.vpcLink) {
      const vpcIntegrationProps: HttpIntegrationProps = {
        options: {
          connectionType: ConnectionType.VpcLink,
          vpcLink: props.vpcLink
        }
      };

      // Updates integration props
      integrationProps = Object.assign(integrationProps, vpcIntegrationProps);
    }

    const resource = restApiConstruct.resource(resourceName);
    resource.addHttpProxyIntegration(method, 'http://' + this.endpoint + integrationPath, integrationProps);

    // Applies provided props
    if (props && props.cors) {
      resource.addCors({allowMethods: [method], ...props.cors})
    }

    return this;
  };
}




