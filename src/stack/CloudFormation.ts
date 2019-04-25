import 'source-map-support/register';
import * as ec2 from '@aws-cdk/aws-ec2'
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { patchElasticsearchConstructWithDeliveryStream } from './custom-stack-constructs/elasticsearch.input_stream'
import { patchElasticsearchConstructWithApiGateway } from './custom-stack-constructs/elasticsearch.gateway';
import { VpcConstruct } from './custom-stack-constructs/vpc';
import { patchVpcConstructWithBastion } from './custom-stack-constructs/vpc.bastion';
import { patchVpcConstructWithVpcEndpoint } from './custom-stack-constructs/vpc.link';
import { ElasticsearchConstruct } from './custom-stack-constructs/elasticsearch';


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
    patchElasticsearchConstructWithDeliveryStream();
    patchElasticsearchConstructWithApiGateway();
    patchVpcConstructWithVpcEndpoint();
    patchVpcConstructWithBastion();

    //
    const bastionImage = new ec2.AmazonLinuxImage().getImage(this);

    const vpcConstruct = new VpcConstruct(this, 'ContextSearchVpc')
      .withPrivateVpcLink()
      .withBastion('Bastion', {
        imageId: bastionImage.imageId,
        instanceType: 't2.micro',
        keyName: 'dtcimbal.aws.key.pair'
      });

    //
    const vpcLink = vpcConstruct.privateVpcLink;

    //
    const elasticsearchConstruct = new ElasticsearchConstruct(this, 'ContextSearch', {...vpcConstruct.privateVpcPlacement})
    //TODO add {proxy+} integration
      .withApiGateway('ANY', '/', '/_search', {vpcLink, cors: {origin: '*'}})
    // .withDeliveryStream(resultStream, 'text_line', {
    //   securityGroup: vpcConstruct.isolatedSecurityGroup,
    //   vpcPlacementStrategy: isolatedPlacementStrategy,
    //   vpc: vpcConstruct.vpc
    // })
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
