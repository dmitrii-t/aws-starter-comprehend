import 'source-map-support/register'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as cdk from '@aws-cdk/cdk'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import { patchElasticsearchConstructWithDeliveryStream } from './custom-stack-constructs/elasticsearch.input_stream'
import { VpcConstruct } from './custom-stack-constructs/vpc'
import { patchVpcConstructWithBastion } from './custom-stack-constructs/vpc.ec2'
import { patchVpcConstructWithVpcLink } from './custom-stack-constructs/vpc.link'
import { ElasticsearchConstruct } from './custom-stack-constructs/elasticsearch'
import { ApiGatewayConstruct } from './custom-stack-constructs/apigateway'
import { patchApiGatewayConstructWithVpcIntegration } from './custom-stack-constructs/apigateway.vpc';

// Patches custom constructs extensions
patchElasticsearchConstructWithDeliveryStream();
patchApiGatewayConstructWithVpcIntegration();
patchVpcConstructWithVpcLink();
patchVpcConstructWithBastion();

class AwsStarterComprehendStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const sourceStream = new kinesis.Stream(this, 'SourceStream');
    // const resultStream = new kinesis.Stream(this, 'ResultStream');
    //
    // // Defines s3 file handler which populates file contents to the data stream
    // const postHandler = new lambda.Function(this, 'HttpHandler', {
    //   runtime: lambda.Runtime.NodeJS810,
    //   handler: 'index.post',
    //   code: lambda.Code.asset('./bin/http-handler'),
    //   environment: {
    //     output_stream: sourceStream.streamName
    //   }
    // });
    //
    // // // Grants write permission to the source stream
    // sourceStream.grantWrite(postHandler.role);
    // //
    // const restApi = new ApiGatewayConstruct(this, 'RestApi')
    //   .root().addCors({origin: '*', allowMethods: ['POST']})
    //   .root().addLambdaProxyIntegration('POST', postHandler)
    //   .getInstance();
    //
    //
    // // Defines message stream handler
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

    const amazonLinuxImage = new ec2.AmazonLinuxImage().getImage(this);
    const vpcConstruct = new VpcConstruct(this, 'ContextSearchVpc', {maxAZs: 1});

    // Bastion instances
    // vpcConstruct.withEc2Instance('Bastion', vpcConstruct.bastionVpcPlacement, {
    //   imageId: amazonLinuxImage.imageId,
    //   instanceType: 't2.micro',
    //   keyName: 'dtcimbal.aws.key.pair'
    // });

    // Elasticsearch
    const elasticsearchConstruct = new ElasticsearchConstruct(this, 'ContextSearch', vpcConstruct.privateVpcPlacement)
    //     .withDeliveryStream(resultStream, 'text_line', vpcConstruct.privateVpcPlacement)
    ;

    // Alias of the elasticsearch cluster used API Gateway
    const endpoint = elasticsearchConstruct.endpoint;

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
      `      server_name \${serviceAlias};`,
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
      targetEndpoint: endpoint,
      serviceAlias: endpoint
    });

    vpcConstruct.withEc2Instance('Proxy', vpcConstruct.privateVpcPlacement, {
      imageId: amazonLinuxImage.imageId,
      instanceType: 't2.micro',
      keyName: 'dtcimbal.aws.key.pair',
      userData: cdk.Fn.base64(proxyInit),
    });

    // Step #2
    const targets = vpcConstruct.findAllEc2Instances('Proxy').map(it => new elbv2.InstanceTarget(it.instanceId));
    const vpcLink = vpcConstruct.withVpcLink('VpcLink', vpcConstruct.privateVpcPlacement, targets).vpcLink;

    const gatewayConstruct = new ApiGatewayConstruct(this, 'ContextSearchApiGateway');
    gatewayConstruct.node.addDependency(elasticsearchConstruct.instance);
    gatewayConstruct.withVpcIntegration('ANY', '/', `http://${endpoint}`, {
      cors: {origin: '*'},
      vpcLink
    });
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
