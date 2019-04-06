import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import { ApiGatewayConstruct } from './constructs/apigateway';
import { ElasticsearchConstruct } from './constructs/elasticsearch';

class AwsStarterComprehendStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const elasticsearch = new ElasticsearchConstruct(this, 'Elasticsearch');
    const httpGateway = new ApiGatewayConstruct(this, 'ApiGateway', elasticsearch)
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
