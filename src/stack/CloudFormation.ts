import 'source-map-support/register'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as cdk from '@aws-cdk/cdk'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import { patchElasticsearchConstructWithDeliveryStream } from './custom-stack-constructs/elasticsearch.input_stream'
import { patchElasticsearchConstructWithApiGateway } from './custom-stack-constructs/elasticsearch.gateway'
import { VpcConstruct } from './custom-stack-constructs/vpc'
import { patchVpcConstructWithBastion } from './custom-stack-constructs/vpc.bastion'
import { patchVpcConstructWithVpcEndpoint } from './custom-stack-constructs/vpc.link'
import { ElasticsearchConstruct } from './custom-stack-constructs/elasticsearch'
import * as kinesis from '@aws-cdk/aws-kinesis'
import * as lambda from '@aws-cdk/aws-lambda'
import { RestApiConstruct } from './custom-stack-constructs/apigateway'
import * as event_sources from '@aws-cdk/aws-lambda-event-sources'
import * as iam from '@aws-cdk/aws-iam'

// Patches custom constructs extensions
patchElasticsearchConstructWithDeliveryStream();
patchElasticsearchConstructWithApiGateway();
patchVpcConstructWithVpcEndpoint();
patchVpcConstructWithBastion();

class AwsStarterComprehendStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceStream = new kinesis.Stream(this, 'SourceStream');
    const resultStream = new kinesis.Stream(this, 'ResultStream');

    // Defines s3 file handler which populates file contents to the data stream
    const postHandler = new lambda.Function(this, 'HttpHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.post',
      code: lambda.Code.asset('./bin/http-handler'),
      environment: {
        output_stream: sourceStream.streamName
      }
    });

    // // Grants write permission to the source stream
    sourceStream.grantWrite(postHandler.role);
    //
    const restApi = new RestApiConstruct(this, 'RestApi')
      .root().addCors({origin: '*', allowMethods: ['POST']})
      .root().addLambdaProxyIntegration('POST', postHandler)
      .getInstance();


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

    const vpcConstruct = new VpcConstruct(this, 'ContextSearchVpc');

    // Bastion instances
    const bastionImage = new ec2.AmazonLinuxImage().getImage(this);
    vpcConstruct.withEc2Instance('Bastion', vpcConstruct.publicVpcPlacement, {
      imageId: bastionImage.imageId,
      instanceType: 't2.micro',
      keyName: 'dtcimbal.aws.key.pair'
    });

    // Elasticsearch
    const elasticsearchConstruct =
      new ElasticsearchConstruct(this, 'ContextSearch', {...vpcConstruct.privateVpcPlacement})
        .withDeliveryStream(resultStream, 'text_line', {...vpcConstruct.privateVpcPlacement});

    const proxyInitTmpl = `
#!/bin/bash

yum install nginx
echo "server {
    listen 80;
    location / {
        proxy_pass \${ElasticsearchDomainEndpoint}/_search;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
     }
}" > /etc/nginx/sites-available/default

service nginx start
chkconfig nginx on
    `;
    const proxyImage = new ec2.AmazonLinuxImage().getImage(this);
    const proxyInit = cdk.Fn.sub(proxyInitTmpl, {
      ElasticsearchDomainEndpoint: elasticsearchConstruct.endpoint
    });

    vpcConstruct.withEc2Instance('ElasticsearchProxy', vpcConstruct.privateVpcPlacement, {
      imageId: proxyImage.imageId,
      instanceType: 't2.micro',
      userData: cdk.Fn.base64(proxyInit)
    });

    const instances = vpcConstruct.findAllEc2Instances('ElasticsearchProxy');
    const targets = instances.map(it => new elbv2.InstanceTarget(it.instanceId));
    const vpcLink = vpcConstruct.withPrivateVpcLink('PrivateLink', targets).privateVpcLink;
    elasticsearchConstruct.withPrivatelyIntegratedApiGateway('ANY', '/', '/_search', {
      cors: {origin: '*'},
      vpcLink
    });
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
