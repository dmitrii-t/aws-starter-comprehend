import { CustomConstruct } from '../index';
import * as ec2 from '@aws-cdk/aws-ec2';
import { IVpcSubnet, SubnetType } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/cdk';

export const publicPlacement: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Public};
export const privatePlacement: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Private};
export const isolatedPlacement: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Isolated};

export interface VpcOptions {
  readonly vpc: ec2.VpcNetwork;
  readonly vpcPlacement: ec2.VpcPlacementStrategy;
  readonly securityGroup: ec2.SecurityGroup;
}

export class VpcConstruct extends CustomConstruct<ec2.VpcNetwork> {

  get publicSubnets(): IVpcSubnet[] {
    return this.instance.subnets(publicPlacement);
  }

  get privateSubnets(): IVpcSubnet[] {
    return this.instance.subnets(privatePlacement);
  }

  get isolatedSubnets(): IVpcSubnet[] {
    return this.instance.subnets(isolatedPlacement);
  }

  get vpc(): ec2.VpcNetwork {
    return this.instance;
  }

  publicSecurityGroup: ec2.SecurityGroup;

  privateSecurityGroup: ec2.SecurityGroup;

  isolatedSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string,) {
    super(scope, id);

    // Network configuration
    this.instance = new ec2.VpcNetwork(this, id, {
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
          name: 'PrivateSubnet',
          subnetType: SubnetType.Private,
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: SubnetType.Isolated,
        }
      ],
    });

    // Public SG allows http access from the Internet
    this.publicSecurityGroup = new ec2.SecurityGroup(this, 'PublicSG', {
      description: 'Public security group with http access',
      allowAllOutbound: true,
      vpc: this.instance
    });
    this.publicSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    //
    this.privateSecurityGroup = new ec2.SecurityGroup(this, 'PrivateSG', {
      description: 'Private security group to allow Lambda or API Gateway to access isolated resources',
      allowAllOutbound: true,
      vpc: this.instance
    });

    // Elasticsearch security group
    this.isolatedSecurityGroup = new ec2.SecurityGroup(this, 'IsolatedSG', {
      description: 'Isolated security group with limited access from private group only',
      vpc: this.instance
    });
    this.isolatedSecurityGroup.addIngressRule(this.privateSecurityGroup, new ec2.TcpPort(80));
  }

}
