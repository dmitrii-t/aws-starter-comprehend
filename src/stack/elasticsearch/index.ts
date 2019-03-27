import * as cdk from '@aws-cdk/cdk';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as es from '@aws-cdk/aws-elasticsearch';

export interface ElasticsearchClusterProps {
  //Add if needed
}

export interface ElasticsearchNetworkConfig {
  vpc: ec2.VpcNetwork;
  vpcPlacement: ec2.VpcPlacementStrategy;
  securityGroup: ec2.SecurityGroup;
}

export class ElasticsearchCluster extends cdk.Construct {

  readonly networkConfig: ElasticsearchNetworkConfig;

  private readonly elasticsearch: es.CfnDomain;

  get domainEndpoint(): string {
    return this.elasticsearch.domainEndpoint
  }

  constructor(parent: cdk.Construct, id: string, props?: ElasticsearchClusterProps) {
    super(parent, id);

    const vpcId = 'Vpc';

    // Network configuration
    const vpc = new ec2.VpcNetwork(this, vpcId, {
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
          name: 'LambdaSubnet',
          subnetType: SubnetType.Private,
        },
        {
          cidrMask: 24,
          name: 'ElasticsearchSubnet',
          subnetType: SubnetType.Isolated,
        }
      ],
    });

    const vpcPlacement: ec2.VpcPlacementStrategy = {subnetName: 'LambdaSubnet'};

    const elasticsearchSubnet = vpc.subnets({subnetName: 'ElasticsearchSubnet'})[0];

    // Public SG allows http access from the Internet
    const publicSecurityGroup = new ec2.SecurityGroup(this, 'PublicSG', {
      vpc: vpc,
      description: 'Public security group with http access',
      allowAllOutbound: true
    });
    publicSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    //
    const clientSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: vpc,
      description: 'Private security group for to allow lambdas to access VPC resources',
      allowAllOutbound: true
    });

    // Elasticsearch security group
    const elasticsearchSecurityGroup = new ec2.SecurityGroup(this, 'ElasticsearchSG', {
      vpc: vpc,
      description: 'Private security group with limited access from public and lambda groups only'
    });
    elasticsearchSecurityGroup.addIngressRule(publicSecurityGroup, new ec2.TcpPort(80));
    elasticsearchSecurityGroup.addIngressRule(clientSecurityGroup, new ec2.TcpPort(80));

    // Elasticsearch cluster
    // const serviceLinkedRole = new iam.CfnServiceLinkedRole(this, 'ElasticsearchServiceLinkedRole', {
    //   awsServiceName: 'es.amazonaws.com'
    // });

    const elasticsearch = new es.CfnDomain(this, `Elasticsearch`, {
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

    //
    this.elasticsearch = elasticsearch;
    this.networkConfig = {
      vpc, vpcPlacement, securityGroup: clientSecurityGroup
    };
  }
}

