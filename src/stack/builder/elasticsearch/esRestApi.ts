import { ElasticsearchConstruct } from './index';
import { RestApiConstruct } from '../restApi';

// Adds ElasticsearchConstruct stream methods  declaration
declare module './index' {
  interface ElasticsearchConstruct {
    exposeRestApis(path: string, apis: string[], props?: ElasticsearchApiProps): ElasticsearchConstruct;
  }
}

export interface ElasticsearchApiProps {
  cors: {
    origin: string;
    allowHeaders?: string;
  }
}

export function patchElasticsearchConstructWithExposeRestApis() {
  //
  ElasticsearchConstruct.prototype.exposeRestApis = function (path: string, apis: string[] = ['_search'], props?: ElasticsearchApiProps): ElasticsearchConstruct {
    const restApiConstruct = new RestApiConstruct(this, 'ElasticsearchRestApi');
    restApiConstruct.node.addDependency(this.instance);

    const resource = restApiConstruct.resource(path);

    const allowMethods = [];

    // Adds APIs
    apis.forEach((api) => {
      resource.addHttpProxyIntegration('GET', this.endpoint + `/${path}` + `/${api}`);
    });
    allowMethods.push('GET');

    // Applies provided props
    if (props && props.cors) {
      resource.addCors({allowMethods, ...props.cors})
    }

    return this;
  };
}




