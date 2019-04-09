import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { Ec2NetworkPops } from './model';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';
import { Builder } from './Builder';


export class ElasticsearchBuilder extends Builder<es.CfnDomain> {

  private network: Ec2NetworkPops;

  private endpoint: string;

  connectInputStream(inputStream: kinesis.Stream): ElasticsearchBuilder {
    this.postConstructs.push(() => {
      //
      const props: StreamConnectorProps = {
        endpoint: this.endpoint,
        network: this.network,
        stream: inputStream
      };
      new StreamConnectorConstruct(this.scope, 'StreamConnector', props)
    });
    return this;
  }

  protected construct() {
    const vpcId = 'Vpc';

    // Network configuration
    const vpc = new ec2.VpcNetwork(this.scope, vpcId, {
      cidr: '10.0.0.0/16',
      natGateways: 1,
      natGatewayPlacement: {subnetName: 'PublicSubnet'},
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.Public,
        },
        {
          cidrMask: 24,
          name: 'ClientSubnet',
          subnetType: SubnetType.Private,
        },
        {
          cidrMask: 24,
          name: 'ElasticsearchSubnet',
          subnetType: SubnetType.Isolated,
        }
      ],
    });

    const vpcPlacement: ec2.VpcPlacementStrategy = {subnetName: 'ClientSubnet'};

    const elasticsearchSubnet = vpc.subnets({subnetName: 'ElasticsearchSubnet'})[0];

    // Public SG allows http access from the Internet
    const publicSecurityGroup = new ec2.SecurityGroup(this.scope, 'PublicSG', {
      vpc: vpc,
      description: 'Public security group with http access',
      allowAllOutbound: true
    });
    publicSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    //
    const clientSecurityGroup = new ec2.SecurityGroup(this.scope, 'ClientSG', {
      vpc: vpc,
      description: 'Private security group for to allow lambdas to access VPC resources',
      allowAllOutbound: true
    });

    // Elasticsearch security group
    const elasticsearchSecurityGroup = new ec2.SecurityGroup(this.scope, 'ElasticsearchSG', {
      vpc: vpc,
      description: 'Private security group with limited access from public and lambda groups only'
    });
    elasticsearchSecurityGroup.addIngressRule(publicSecurityGroup, new ec2.TcpPort(80));
    elasticsearchSecurityGroup.addIngressRule(clientSecurityGroup, new ec2.TcpPort(80));

    // Elasticsearch cluster
    // const serviceLinkedRole = new iam.CfnServiceLinkedRole(this, 'ElasticsearchServiceLinkedRole', {
    //   awsServiceName: 'es.amazonaws.com'
    // });

    this.instance = new es.CfnDomain(this.scope, this.name || 'Elasticsearch', {
      elasticsearchVersion: '6.4',
      accessPolicies: new iam.PolicyDocument()
        .addStatement(new iam.PolicyStatement()
          .addAwsPrincipal('*')
          .addResource('arn:aws:es:*')
          .addAction('es:*')),
      elasticsearchClusterConfig: {
        // The t2.micro.elasticsearch instance type supports only Elasticsearch 1.5 and 2.3.
        instanceType: 't2.small.elasticsearch',
        instanceCount: 1
      },
      ebsOptions: {
        ebsEnabled: true,
        volumeType: 'gp2',
        volumeSize: 10,
      },
      vpcOptions: {
        subnetIds: [elasticsearchSubnet.subnetId],
        securityGroupIds: [elasticsearchSecurityGroup.securityGroupId]
      }
    });

    this.network = {
      securityGroup: clientSecurityGroup,
      vpcPlacement,
      vpc
    }
  }
}

interface StreamConnectorProps {
  endpoint: string
  network: Ec2NetworkPops
  stream: kinesis.Stream
}

class StreamConnectorConstruct extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: StreamConnectorProps) {
    super(scope, id);

    const {
      endpoint, network, stream
    } = props;

    // Defines message stream handler
    const streamConnector = new lambda.Function(this, 'StreamConnector', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/stream-connector'),
      ...network,
      environment: {
        elasticsearch_endpoint: endpoint
      }
    });

    streamConnector.addEventSource(new event_sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    stream.grantRead(streamConnector.role);
  }
}
