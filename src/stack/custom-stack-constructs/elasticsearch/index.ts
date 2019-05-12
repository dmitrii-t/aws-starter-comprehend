import * as cdk from '@aws-cdk/cdk';
import { CustomConstruct } from '../';
import * as es from '@aws-cdk/aws-elasticsearch';
import { CfnDomain } from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';
import { VpcPlacement } from '../vpc';
import * as ec2 from '@aws-cdk/aws-ec2';
import { IVpcSubnet } from '@aws-cdk/aws-ec2';

interface EsVpcOptions {
  subnet: IVpcSubnet
  securityGroup: ec2.SecurityGroup
}

/**
 * Elasticsearch construct to build and configure Elasticsearch cluster
 *
 */
export class ElasticsearchConstruct extends CustomConstruct<es.CfnDomain> {

  vpcPlacement?: VpcPlacement;

  /**
   * Returns instance of Elasticsearch cluster
   */
  get elasticsearch(): CfnDomain {
    return this.instance
  }

  /**
   * Returns cluster endpoint url
   */
  get domainEndpoint(): string {
    return this.instance.domainEndpoint;
  }

  /**
   * Returns cluster arn
   */
  get domainArn(): string {
    return this.instance.domainArn;
  }

  constructor(scope: cdk.Construct, id: string = 'Elasticsearch', props?: VpcPlacement) {
    super(scope, id);

    //TODO Add CloudWatch alarms for the cluster to signal if
    // - Average CPU utilization over last 10 minutes too high
    // - Average CPU credit balance over last 10 minutes too low (expect a significant performance drop soon)
    // - Average JVM memory pressure over last 10 minutes too high
    // - Master is not reachable (network issue)
    // - No automated snapshot was taken for the domain in the previous 48 hours
    // - Cluster is running out of storage space
    // - Cluster is blocking incoming write requests

    this.vpcPlacement = props;

    // Vpc options
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
  return value.replace(/\s+/g, '-').toLowerCase()
}
