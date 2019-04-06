import * as ec2 from '@aws-cdk/aws-ec2';

export interface Ec2NetworkPops {
  readonly vpc: ec2.VpcNetwork;
  readonly vpcPlacement: ec2.VpcPlacementStrategy;
  readonly securityGroup: ec2.SecurityGroup;
}
