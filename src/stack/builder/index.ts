import * as cdk from '@aws-cdk/cdk';
import * as ec2 from '@aws-cdk/aws-ec2';

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


