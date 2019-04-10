import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { ElasticsearchBuilder } from './builder/ElasticsearchBuilder';
import * as iam from '@aws-cdk/aws-iam';
import { ApiGatewayBuilder } from './builder/ApiGatewayBuilder';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';

class AwsStarterComprehendStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceStream = new kinesis.Stream(this, 'SourceStream');
    const resultStream = new kinesis.Stream(this, 'ResultStream');

    // Defines s3 file handler which populates file contents to the data stream
    const httpHandler = new lambda.Function(this, 'HttpHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/http-handler'),
      environment: {
        output_stream: sourceStream.streamName
      }
    });
    // Grants write permission to the source stream
    sourceStream.grantWrite(httpHandler.role);

    const apiGateway = new ApiGatewayBuilder(this, 'ApiGateway')
      .root().addCors('*', ['POST'])
      .root().addLambdaHandler('POST', httpHandler)
      .build();

    // Defines message stream handler
    const streamHandler = new lambda.Function(this, 'StreamHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/stream-handler'),
      environment: {
        output_stream: resultStream.streamName
      }
    });
    streamHandler.addEventSource(new event_sources.KinesisEventSource(sourceStream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));
    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    sourceStream.grantRead(streamHandler.role);
    resultStream.grantWrite(streamHandler.role);

    // Adds permission comprehend:DetectSentiment
    streamHandler.role!.addToPolicy(new iam.PolicyStatement()
      .addAllResources()
      .addActions('comprehend:DetectSentiment'));

    const elasticsearch = new ElasticsearchBuilder(this, '', 'text_line')
      .connectInputStream(resultStream)
      .build();
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
