import * as cdk from '@aws-cdk/cdk';


export class Builder<T> {

  beforeConstructs: Function[] = [];

  postConstructs: Function[] = [];

  protected instance: T;

  constructor(protected scope: cdk.Construct, protected name:string) {
  }

  protected construct(): void {
  };

  build(): T {
    this.beforeConstructs.forEach((builder) => builder.call(this));
    this.construct();
    this.postConstructs.forEach((builder) => builder.call(this));
    return this.instance;
  }
}

