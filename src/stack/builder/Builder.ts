import * as cdk from '@aws-cdk/cdk';

export class Builder<T> {

  protected postConstructs: Function[] = [];

  protected instance: T;

  constructor(protected scope: cdk.Construct, protected name: string) {
  }

  protected beforeConstruct(): void {
  }

  protected construct(): void {
  }

  build(): T {
    this.beforeConstruct();
    this.construct();
    // Runs deferred post construct handlers
    this.postConstructs.forEach((builder) => builder.call(this));
    return this.instance;
  }
}

