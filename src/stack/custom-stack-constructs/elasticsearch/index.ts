import * as cdk from '@aws-cdk/cdk';
import { CustomConstruct } from '../';
import * as es from '@aws-cdk/aws-elasticsearch';
import { CfnDomain } from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';
import { VpcPlacement } from '../vpc';
import * as ec2 from '@aws-cdk/aws-ec2';
import { IVpcSubnet } from '@aws-cdk/aws-ec2';

export interface ElasticsearchVpcPlacement extends VpcPlacement {
}

export class ElasticsearchConstruct extends CustomConstruct<es.CfnDomain> {

  id: string;

  vpcPlacement?: VpcPlacement;

  get elasticsearch(): CfnDomain {
    return this.instance
  }

  get endpoint(): string {
    // Use non-secure http for internal access
    return 'http://' + this.instance.domainEndpoint;
  }

  constructor(scope: cdk.Construct, id: string = 'Elasticsearch', props?: ElasticsearchVpcPlacement) {
    super(scope, id);

    this.vpcPlacement = props;

    // Vpc
    const vpcOptions: EsVpcOptions | undefined = props && props.vpc
      ? formatEsVpcOptions(props)
      : undefined;

    // Elasticsearch cluster
    this.instance = new es.CfnDomain(this, id, {
      domainName: formatDomainName(id),
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
      vpcOptions: vpcOptions ? {
        subnetIds: [vpcOptions.subnet.subnetId],
        securityGroupIds: [vpcOptions.securityGroup.securityGroupId]
      } : undefined
    });

    // Dependencies
    // const serviceLinkedRole = new iam.CfnServiceLinkedRole(this, 'ElasticsearchServiceLinkedRole', {
    //   awsServiceName: 'es.amazonaws.com'
    // });
    // this.instance.node.addDependency(serviceLinkedRole);

    // Adds Vpc dependency if Vpc is provided
    if (vpcOptions) {
      this.instance.node.addDependency(vpcOptions.subnet);
      this.instance.node.addDependency(vpcOptions.securityGroup)
    }

    // Outputs public
    const domainEndpoint = new cdk.CfnOutput(this, `${id}DomainEndpoint`, {
      description: `${id} domain endpoint`,
      value: this.instance.domainEndpoint
    });
  }
}

interface EsVpcOptions {
  subnet: IVpcSubnet
  securityGroup: ec2.SecurityGroup
}

function formatEsVpcOptions(vpcOptions: VpcPlacement): EsVpcOptions {
  const vpc = vpcOptions.vpc;

  //The only one subnet should be specified
  const subnet: IVpcSubnet = vpc.subnets(vpcOptions.vpcPlacementStrategy)[0];
  const securityGroup: ec2.SecurityGroup = vpcOptions.securityGroup;
  return {
    securityGroup, subnet
  }
}

function formatDomainName(value: string): string {
  //TODO Add camelcase to hyphen separated conversion
  return value.replace(/\s+/g, '-').toLowerCase()
}
