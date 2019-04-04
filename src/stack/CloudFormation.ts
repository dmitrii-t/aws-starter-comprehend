import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import * as iam from '@aws-cdk/aws-iam';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { IRestApiResource, PassthroughBehavior } from '@aws-cdk/aws-apigateway';

// import { ElasticsearchCluster } from './elasticsearch';

class AwsStarterComprehendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const elasticsearch = new ElasticsearchCluster(this, 'Elasticsearch');

    // Defines message data stream
    const contentStream = new kinesis.Stream(this, 'ContentStream');

    // Defines s3 file handler which populates file contents to the data stream
    const httpHandler = new lambda.Function(this, 'HttpHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/http-handler'),
      environment: {
        message_stream: contentStream.streamName
      }
    });

    // API Gateway
    const restApi = new apigateway.RestApi(this, 'SentimentAnalysisApi');

    const resource: IRestApiResource = restApi.root;

    resource.addMethod('POST', new apigateway.LambdaIntegration(httpHandler));
    resource.addMethod('OPTIONS', new apigateway.MockIntegration({
      passthroughBehavior: PassthroughBehavior.Never,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': '\'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token\'',
          'method.response.header.Access-Control-Allow-Methods': '\'POST,OPTIONS\'',
          'method.response.header.Access-Control-Allow-Origin': '\'*\'',
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

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantWrite(httpHandler.role);

    // Defines message stream handler
    const streamHandler = new lambda.Function(this, 'StreamHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/stream-handler'),

      // Network config
      // ...elasticsearch.networkConfig,
      // Lambda ENV setup
      // environment: {
      //   elasticsearch_endpoint: elasticsearch.domainEndpoint
      // }
    });
    streamHandler.addEventSource(new event_sources.KinesisEventSource(contentStream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantRead(streamHandler.role);

    // Adds permission comprehend:DetectSentiment
    streamHandler.role!.addToPolicy(new iam.PolicyStatement()
      .addAllResources()
      .addActions('comprehend:DetectSentiment'));
  };
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
