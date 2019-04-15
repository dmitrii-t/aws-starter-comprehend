import * as cdk from '@aws-cdk/cdk';
import { CustomConstruct, Ec2NetworkPops } from '../';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';

export interface ElasticsearchConstructProps  {
  public: boolean
}


export class ElasticsearchConstruct extends CustomConstruct<es.CfnDomain> {

  network: Ec2NetworkPops;

  endpoint: string;

  constructor(scope: cdk.Construct, id: string, props?:ElasticsearchConstructProps) {
    super(scope, id);

    const vpcId = 'Vpc';

    // Network configuration
    const vpc = new ec2.VpcNetwork(this, vpcId, {
      cidr: '10.0.0.0/16',
      natGateways: 1,
      natGatewayPlacement: {
        subnetName: 'PublicSubnet'
      },
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
    const publicSubnet = vpc.subnets({subnetName: 'PublicSubnet'})[0];
    const clientSubnet = vpc.subnets({subnetName: 'ClientSubnet'})[0];
    const isolatedSubnet = vpc.subnets({subnetName: 'ElasticsearchSubnet'})[0];

    // Public SG allows http access from the Internet
    const publicSecurityGroup = new ec2.SecurityGroup(this, 'PublicSG', {
      description: 'Public security group with http access',
      allowAllOutbound: true,
      vpc: vpc
    });
    publicSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    //
    const clientSecurityGroup = new ec2.SecurityGroup(this, 'ClientSG', {
      description: 'Private security group to allow Lambda or API Gateway to access isolated resources',
      allowAllOutbound: true,
      vpc: vpc
    });

    // Elasticsearch security group
    const isolatedSecurityGroup = new ec2.SecurityGroup(this, 'ElasticsearchSG', {
      description: 'Isolated security group with limited access from lambda group only',
      vpc: vpc
    });
    isolatedSecurityGroup.addIngressRule(clientSecurityGroup, new ec2.TcpPort(80));

    const publicVpcOptions = {
      subnetIds: [publicSubnet.subnetId],
      securityGroupIds: [publicSecurityGroup.securityGroupId]
    };

    const isolatedVpcOptions = {
      subnetIds: [isolatedSubnet.subnetId],
      securityGroupIds: [isolatedSecurityGroup.securityGroupId]
    };

    // Elasticsearch cluster
    const serviceLinkedRole = new iam.CfnServiceLinkedRole(this, 'ElasticsearchServiceLinkedRole', {
      awsServiceName: 'es.amazonaws.com'
    });

    this.instance = new es.CfnDomain(this, id || 'Elasticsearch', {
      domainName: id,
      elasticsearchVersion: '6.4',
      accessPolicies: new iam.PolicyDocument()
        .addStatement(new iam.PolicyStatement()
          .addAwsPrincipal('*')
          .addResource('arn:aws:es:*')
          .addAction('es:ESHttp*')),
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
      vpcOptions: props && props.public ? publicVpcOptions : isolatedVpcOptions
    });

    this.network = {
      securityGroup: clientSecurityGroup,
      vpcPlacement,
      vpc
    };

    // Populates Elasticsearch endpoint for further usage
    this.endpoint = this.instance.domainEndpoint;

    // Outputs public Elasticsearch endpoint
    if (props && props.public) {
      const publicEndpoint = new cdk.CfnOutput(this, 'ElastricsearchDomainEndpoint', {
        description: 'Elasticsearch Endpoint',
        value: this.instance.domainEndpoint
      });
    }
  }
}
