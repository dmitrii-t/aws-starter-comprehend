import 'source-map-support/register'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as cdk from '@aws-cdk/cdk'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import * as kinesis from '@aws-cdk/aws-kinesis'
import * as lambda from '@aws-cdk/aws-lambda'
import * as event_sources from '@aws-cdk/aws-lambda-event-sources'
import * as iam from '@aws-cdk/aws-iam'
import * as s3 from '@aws-cdk/aws-s3';

import { patchElasticsearchConstructWithDeliveryStream } from './custom-stack-constructs/elasticsearch.delivery.stream'
import { VpcConstruct } from './custom-stack-constructs/vpc'
import { patchVpcConstructWithEc2Instance } from './custom-stack-constructs/vpc.ec2'
import { patchVpcConstructWithVpcLink } from './custom-stack-constructs/vpc.link'
import { ElasticsearchConstruct } from './custom-stack-constructs/elasticsearch'
import { ApiGatewayConstruct } from './custom-stack-constructs/apigateway'
import { patchApiGatewayConstructWithVpcIntegration } from './custom-stack-constructs/apigateway.vpclink';

// Patches custom constructs extensions
patchElasticsearchConstructWithDeliveryStream();
patchApiGatewayConstructWithVpcIntegration();
patchVpcConstructWithVpcLink();
patchVpcConstructWithEc2Instance();

/**
 * Builds a could stack which utilises
 *
 */
class AwsStarterSentimentAnalysisStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines stack constants
    const elasticsearchIndex = 'text_lines';

    // Defines Kinesis stream to handle submitted text lines
    const postStream = new kinesis.Stream(this, 'PostStream');

    // Defines lambda handler to process POST requests, split provided text by lines
    // and populate lines to kinesis stream for further porocessing
    const postHandler = new lambda.Function(this, 'PostHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.post',
      timeout: 8,
      code: lambda.Code.asset('./bin/post-handler'),
      environment: {
        output_stream: postStream.streamName
      }
    });
    // Grants write permission to the handler to publish to the post stream
    postStream.grantWrite(postHandler.role);

    // Defines API Gateway for the stack
    const gatewayConstruct = new ApiGatewayConstruct(this, 'ApiGateway');

    // Adds resource to submit text via POST method
    gatewayConstruct
      .resource('text_lines')
      .addCors({origin: '*', allowMethods: ['POST']})
      .addLambdaProxyIntegration('POST', postHandler);

    // Defines VPC construct
    const vpcConstruct = new VpcConstruct(this, 'Vpc', {maxAZs: 1});

    // // Bastion instances
    // vpcConstruct.withEc2Instances('Bastion', vpcConstruct.bastionVpcPlacement, {
    //   imageId: amazonLinuxImage.imageId,
    //   instanceType: 't2.micro',
    //   keyName: 'dtcimbal.aws.key.pair'
    // });

    // Defines shared placement strategy for the stack components below
    const elasticsearchPlacement = vpcConstruct.privateVpcPlacement;

    //
    const deliveryBackupBucket = new s3.Bucket(this, 'DeliveryBackup');
    //
    const deliveryStreamName = 'DeliveryStream';

    // Elasticsearch
    const elasticsearchConstruct = new ElasticsearchConstruct(this, 'SearchCluster', elasticsearchPlacement)
      .withDeliveryStream(deliveryStreamName, {
        backupBucket: deliveryBackupBucket,
        elasticsearchIndex
      });

    // Defines lambda handler to append recognized sentiment to submitted text lines
    const sentimentHandler = new lambda.Function(this, 'SentimentHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      timeout: 10,
      code: lambda.Code.asset('./bin/sentiment-handler'),
      environment: {
        output_stream: deliveryStreamName
      },
    });

    // Adds Kinesis post stream as a source
    sentimentHandler.addEventSource(new event_sources.KinesisEventSource(postStream, {
      startingPosition: lambda.StartingPosition.Latest
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    // to the sentimentHandler to allow it to read post stream and publish to the delivery stream
    postStream.grantRead(sentimentHandler.role);

    // Adds permission comprehend:DetectSentiment
    sentimentHandler.role!
      .addToPolicy(new iam.PolicyStatement()
        .addAllResources()
        .addActions('comprehend:DetectSentiment'));

    // Adds permission to write to Firehose
    sentimentHandler.role!.addToPolicy(new iam.PolicyStatement()
      .addResource(elasticsearchConstruct.getDeliveryStream(deliveryStreamName).deliveryStreamArn)
      .addActions('firehose:*'));

    // EC2 configuration below
    const amazonLinuxImage = new ec2.AmazonLinuxImage().getImage(this);

    // Defines alias of the endpoint  elasticsearch cluster
    const endpoint = elasticsearchConstruct.domainEndpoint;

    // Defines HTTP proxy init block
    const proxyInit = cdk.Fn.sub([
      `#cloud-config`,
      `repo_update: true`,
      `repo_upgrade: all`,
      ``,
      `packages:`,
      ` - epel-release`,
      ` - nginx`,
      ``,
      `write_files:`,
      ` - path: /etc/nginx/conf.d/proxy.conf`,
      `   permissions: '0644'`,
      `   content: |`,
      `    server_names_hash_bucket_size 512;`,
      `    server {`,
      `      listen 80;`,
      `      listen [::]:80;`,
      ``,
      `      server_name \${targetEndpoint};`,
      ``,
      `      location / {`,
      `        proxy_http_version 1.1;`,
      `        proxy_pass http://\${targetEndpoint};`,

      `        proxy_set_header Host \${targetEndpoint};`,
      `        proxy_set_header Connection "Keep-Alive";`,
      `        proxy_set_header Proxy-Connection "Keep-Alive";`,
      `        proxy_set_header Authorization "";`,
      `      }`,
      `    }`,
      ``,
      `runcmd:`,
      ` - chkconfig nginx on`,
      ` - service nginx start`,
      ``,
      `output : { all : '| tee -a /var/log/cloud-init-output.log' }`,
      `#eof`,
      ``,
    ].join('\n'), {
      targetEndpoint: endpoint
    });

    // Defines EC2
    vpcConstruct.withEc2Instances('SearchProxy', elasticsearchPlacement, {
      imageId: amazonLinuxImage.imageId,
      instanceType: 't2.micro',
      keyName: 'dtcimbal.aws.key.pair',
      userData: cdk.Fn.base64(proxyInit),
    });

    // Defines NetworkLoadBalancer targets to send traffic from API Gateway
    const targets = vpcConstruct.findAllEc2Instances('SearchProxy').map(it => new elbv2.InstanceTarget(it.instanceId));
    // Defines VPC Link for API Gateway to sent traffic to
    const vpcLink = vpcConstruct.withVpcLink('VpcLink', elasticsearchPlacement, targets).vpcLink;

    // Instruments API Gateway to create another resource /search integrated to VPC
    gatewayConstruct.node.addDependency(elasticsearchConstruct.instance);
    gatewayConstruct.withVpcIntegration('POST', '/search', `http://${endpoint}/_search`, {
      cors: {origin: '*'},
      vpcLink
    });

  }
}

// Runs
const app = new cdk.App();
new AwsStarterSentimentAnalysisStack(app, 'AwsStarterSentimentAnalysisStack');
app.run();
