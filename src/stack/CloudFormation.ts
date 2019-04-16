import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { ElasticsearchConstruct } from './builder/elasticsearch';
import { patchElasticsearchConstructWithInputStream } from './builder/elasticsearch.input_stream'
import { patchElasticsearchConstructWithExposeRestApis } from './builder/elasticsearch.gateway';
import { isolatedPlacement, VpcConstruct } from './builder/vpc';


class AwsStarterComprehendStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceStream = new kinesis.Stream(this, 'SourceStream');
    const resultStream = new kinesis.Stream(this, 'ResultStream');

    // Defines s3 file handler which populates file contents to the data stream
    // const postHandler = new lambda.Function(this, 'HttpHandler', {
    //   runtime: lambda.Runtime.NodeJS810,
    //   handler: 'index.post',
    //   code: lambda.Code.asset('./bin/http-handler'),
    //   environment: {
    //     output_stream: sourceStream.streamName
    //   }
    // });
    //
    // // Grants write permission to the source stream
    // sourceStream.grantWrite(postHandler.role);
    //
    // const restApi = new RestApiConstruct(this, 'RestApi')
    //   .root().addCors('*', ['POST'])
    //   .root().addLambdaProxyIntegration('POST', postHandler)
    //   .getInstance();


    // Defines message stream handler
    // const streamHandler = new lambda.Function(this, 'StreamHandler', {
    //   runtime: lambda.Runtime.NodeJS810,
    //   handler: 'index.handler',
    //   code: lambda.Code.asset('./bin/stream-handler'),
    //   environment: {
    //     output_stream: resultStream.streamName
    //   }
    // });
    // streamHandler.addEventSource(new event_sources.KinesisEventSource(sourceStream, {
    //   startingPosition: lambda.StartingPosition.TrimHorizon
    // }));
    // // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    // sourceStream.grantRead(streamHandler.role);
    // resultStream.grantWrite(streamHandler.role);
    //
    // // Adds permission comprehend:DetectSentiment
    // streamHandler.role!.addToPolicy(new iam.PolicyStatement()
    //   .addAllResources()
    //   .addActions('comprehend:DetectSentiment'));

    //
    patchElasticsearchConstructWithInputStream();
    patchElasticsearchConstructWithExposeRestApis();


    const vpcConstruct = new VpcConstruct(this, 'ContextSearchVpc');

    const elasticsearch = new ElasticsearchConstruct(this, 'ContextSearch', {
      securityGroup: vpcConstruct.isolatedSecurityGroup,
      vpcPlacement: isolatedPlacement,
      vpc: vpcConstruct.vpc
    })
    // .connectInputStream(resultStream, 'text_line', {
    //   securityGroup: vpcConstruct.isolatedSecurityGroup,
    //   vpcPlacement: isolatedPlacement,
    //   vpc: vpcConstruct.vpc
    // })
    // .exposeRestApis('text_line', ['_search'], {cors: {origin: '*'}})
      .getInstance();
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
