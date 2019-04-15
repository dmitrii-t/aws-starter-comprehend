import * as cdk from '@aws-cdk/cdk';
import * as ec2 from '@aws-cdk/aws-ec2';


export interface Ec2NetworkPops {
  readonly vpc: ec2.VpcNetwork;
  readonly vpcPlacement: ec2.VpcPlacementStrategy;
  readonly securityGroup: ec2.SecurityGroup;
}


export class CustomConstruct<T> extends cdk.Construct {

  public instance: T;

  constructor(scope: cdk.Construct, name: string) {
    super(scope, name);
    // Constructs the underlying service
  }

  getInstance(): T {
    return this.instance;
  }

}


