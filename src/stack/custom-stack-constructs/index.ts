import * as cdk from '@aws-cdk/cdk';

/**
 * Base class for all custom constructs. Defines common
 * properties like underlying service instance and  id
 *
 */
export class CustomConstruct<T> extends cdk.Construct {

  public instance: T;

  public readonly id: string;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);
    this.id = id;
    // Constructs the underlying service
  }

  getInstance(): T {
    return this.instance;
  }

}


