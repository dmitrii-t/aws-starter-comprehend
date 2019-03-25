#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as es from '@aws-cdk/aws-elasticsearch';

class AwsStarterComprehendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcId = `${this.name}Vpc`;

    // Network configuration
    const vpc = new ec2.VpcNetwork(this, vpcId, {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      natGatewayPlacement: {subnetName: 'PublicSubnet'},
      subnetConfiguration: [
        {
          cidrMask: '10.0.1.0/24',
          name: 'PublicSubnet',
          subnetType: SubnetType.Public,
        },
        {
          cidrMask: '10.0.2.0/24',
          name: 'LambdaSubnet',
          subnetType: SubnetType.Private,
        }
      ],
    });

    const elasticsearchSubnetId = 'ElasticsearchSubnet';
    const elasticsearchSubnet = new ec2.VpcPrivateSubnet(this, elasticsearchSubnetId, {
      vpcId,
      cidrBlock: '10.0.3.0/24'
    });

    // Public SG allows http access from the Internet
    const publicSg = new ec2.SecurityGroup(this, `${this.name}PublicSG`, {
      vpc: vpc,
      description: 'Public security group with http access',
      allowAllOutbound: true
    });
    publicSg.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    //
    const lambdaSg = new ec2.SecurityGroup(this, `${this.name}LambdaSG`, {
      vpc: vpc,
      description: 'Private security group for to allow lambdas to access VPC resources',
      allowAllOutbound: true
    });


    // Elasticsearch security group
    const elasticsearchSgId = `${this.name}ElasticsearchSG`;
    const elasticsearchSg = new ec2.SecurityGroup(this, elasticsearchSgId, {
      vpc: vpc,
      description: 'Private security group with limited access from public and lambda groups only'
    });
    elasticsearchSg.addIngressRule(publicSg, new ec2.TcpPort(80));
    elasticsearchSg.addIngressRule(lambdaSg, new ec2.TcpPort(80));

    //
    const elasticsearch = new es.CfnDomain(this, `${this.name}Elasticsearch`, {
      elasticsearchVersion: '6.4',
      ebsOptions: {
        // We will use ephemeral storages for this demo project for simplicity
        ebsEnabled: false,
      },
      vpcOptions: {
        subnetIds: [elasticsearchSubnetId],
        securityGroupIds: [elasticsearchSgId]
      }
    });

    // Defines source message bucket
    const fileBucket = new s3.Bucket(this, 'FileBucket');

    // Defines message data stream
    const contentStream = new kinesis.Stream(this, 'ContentStream');

    // Defines s3 file handler which populates file contents to the data stream
    const fileHandler = new lambda.Function(this, 'FileHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'file-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
      environment: {
        message_stream: contentStream.streamName
      }
    });
    fileHandler.addEventSource(new event_sources.S3EventSource(fileBucket, {
      events: [s3.EventType.ObjectCreated]
    }));
    // Adds permissions s3:GetObject* and s3:List
    fileBucket.grantRead(fileHandler.role);
    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantWrite(fileHandler.role);

    // Defines message stream handler
    const contentHandler = new lambda.Function(this, 'ContentHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'content-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
      // Network config
      vpc: vpc,
      vpcPlacement: {subnetName: 'LambdaSubnet'},
      securityGroup: lambdaSg,
      // Lambda ENV setup
      environment: {
        elasticsearch_url: elasticsearch.domainEndpoint
      }
    });
    contentHandler.addEventSource(new event_sources.KinesisEventSource(contentStream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantRead(contentHandler.role);

    // Adds permission comprehend:DetectSentiment
    contentHandler.role!.addToPolicy(new iam.PolicyStatement()
      .addAllResources()
      .addActions('comprehend:DetectSentiment'));
  };
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
