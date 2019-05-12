import { CustomConstruct } from '../index';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/cdk';

export const publicPlacementStrategy: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Public};
export const privatePlacementStrategy: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Private};
export const isolatedPlacementStrategy: ec2.VpcPlacementStrategy = {subnetsToUse: SubnetType.Isolated};

/**
 * Props to configure VPC
 */
export interface VpcProps {
  readonly maxAZs: number;
}

/**
 * Props to configure VPC placement
 */
export interface VpcPlacement {
  readonly vpc: ec2.VpcNetwork;
  readonly vpcPlacementStrategy: ec2.VpcPlacementStrategy;
  readonly securityGroup: ec2.SecurityGroup;
}

/**
 * Construct to build and configure VPC. Defines by default three subnets
 * public which publicly accessible, private which is accessible form the public network
 * and isolated which is accessible from the private subnet only.s
 *
 */
export class VpcConstruct extends CustomConstruct<ec2.VpcNetwork> {

  readonly availabilityZones: string[];

  readonly publicSecurityGroup: ec2.SecurityGroup;

  readonly bastionSecurityGroup: ec2.SecurityGroup;

  readonly privateSecurityGroup: ec2.SecurityGroup;

  readonly isolatedSecurityGroup: ec2.SecurityGroup;

  get publicSecurityGroupId(): string {
    return this.publicSecurityGroup.securityGroupId
  }

  get privateSecurityGroupId(): string {
    return this.privateSecurityGroup.securityGroupId
  }

  get isolatedSecurityGroupId(): string {
    return this.isolatedSecurityGroup.securityGroupId
  }

  get publicVpcPlacement(): VpcPlacement {
    return {
      securityGroup: this.publicSecurityGroup,
      vpcPlacementStrategy: publicPlacementStrategy,
      vpc: this.instance
    }
  }

  get bastionVpcPlacement(): VpcPlacement {
    return {
      securityGroup: this.bastionSecurityGroup,
      vpcPlacementStrategy: publicPlacementStrategy,
      vpc: this.instance
    }
  }

  get privateVpcPlacement(): VpcPlacement {
    return {
      securityGroup: this.privateSecurityGroup,
      vpcPlacementStrategy: privatePlacementStrategy,
      vpc: this.instance
    }
  }

  get isolatedVpcPlacement(): VpcPlacement {
    return {
      securityGroup: this.isolatedSecurityGroup,
      vpcPlacementStrategy: isolatedPlacementStrategy,
      vpc: this.instance
    }
  }

  get publicSubnetIds(): string[] {
    return this.instance.subnets(publicPlacementStrategy).map(it => it.subnetId);
  }

  get privateSubnetIds(): string[] {
    return this.instance.subnets(privatePlacementStrategy).map(it => it.subnetId);
  }

  get isolatedSubnetIds(): string[] {
    return this.instance.subnets(isolatedPlacementStrategy).map(it => it.subnetId);
  }

  get publicSubnets(): ec2.IVpcSubnet[] {
    return this.instance.subnets(publicPlacementStrategy);
  }

  get privateSubnets(): ec2.IVpcSubnet[] {
    return this.instance.subnets(privatePlacementStrategy);
  }

  get isolatedSubnets(): ec2.IVpcSubnet[] {
    return this.instance.subnets(isolatedPlacementStrategy);
  }

  get vpc(): ec2.VpcNetwork {
    return this.instance;
  }

  constructor(scope: cdk.Construct, id: string, props:VpcProps = {maxAZs: 3}) {
    super(scope, id);

    //
    const cidrMask = 24;

    this.availabilityZones = new cdk.AvailabilityZoneProvider(this).availabilityZones;

    // Network configuration
    this.instance = new ec2.VpcNetwork(this, id, {
      cidr: '10.0.0.0/16',
      maxAZs: props.maxAZs,
      natGateways: 1,
      natGatewayPlacement: {
        subnetName: 'PublicSubnet'
      },
      subnetConfiguration: [
        {
          cidrMask,
          name: 'PublicSubnet',
          subnetType: SubnetType.Public,
        },
        {
          cidrMask,
          name: 'PrivateSubnet',
          subnetType: SubnetType.Private,
        },
        {
          cidrMask,
          name: 'IsolatedSubnet',
          subnetType: SubnetType.Isolated,
        }
      ],
    });

    // Public SG allows http access from the Internet
    this.publicSecurityGroup = new ec2.SecurityGroup(this, 'PublicSG', {
      description: 'Public security group with http access',
      vpc: this.instance
    });
    this.publicSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    // Bastion SG
    this.bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSG', {
      description: 'Bastion security group with ssh access only which has access to both private and isolated SGs',
      vpc: this.instance
    });
    this.bastionSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(22));

    // Private SG
    this.privateSecurityGroup = new ec2.SecurityGroup(this, 'PrivateSG', {
      description: 'Private security group to allow private resources to access to isolated resources',
      vpc: this.instance
    });
    // Permits SSH access from bastion group
    this.privateSecurityGroup.addIngressRule(this.bastionSecurityGroup, new ec2.TcpPort(22));
    // Permits HTTP access inside the group
    this.privateSecurityGroup.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80));

    // Isolated SG
    this.isolatedSecurityGroup = new ec2.SecurityGroup(this, 'IsolatedSG', {
      description: 'Isolated security group with limited access from private group only',
      allowAllOutbound: false,
      vpc: this.instance
    });
    this.isolatedSecurityGroup.addIngressRule(this.privateSecurityGroup, new ec2.TcpPort(80));
    this.isolatedSecurityGroup.addIngressRule(this.bastionSecurityGroup, new ec2.TcpPort(80));
  }

}
