import { VpcConstruct, VpcPlacement } from '../vpc';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { VpcLink } from '@aws-cdk/aws-apigateway';
import { INetworkLoadBalancerTarget } from '@aws-cdk/aws-elasticloadbalancingv2';
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');


declare module '../vpc' {
  interface VpcConstruct {
    /**
     *
     * @param vpcLinkName
     * @param targets
     */
    withPrivateVpcLink(vpcLinkName: string, targets: INetworkLoadBalancerTarget[]): VpcConstruct;

    /**
     *
     * @param vpcLinkName
     * @param vpcLinkPlacement
     * @param targets
     */
    withVpcLink(vpcLinkName: string, vpcLinkPlacement: VpcPlacement, targets: INetworkLoadBalancerTarget[]): VpcConstruct;

    /**
     * The reference to the private VpcLink
     */
    vpcLink: VpcLink
  }
}

export function patchVpcConstructWithVpcEndpoint() {
  //
  VpcConstruct.prototype.withPrivateVpcLink = function (vpcLinkName: string, targets: INetworkLoadBalancerTarget[]): VpcConstruct {
    return this.withVpcLink(vpcLinkName, this.privateVpcPlacement, targets);
  };

  //
  VpcConstruct.prototype.withVpcLink = function (vpcLinkName: string, vpcLinkPlacement: VpcPlacement, targets: INetworkLoadBalancerTarget[]): VpcConstruct {
    //
    const networkBalancer = new elbv2.NetworkLoadBalancer(this, this.id + 'NetworkLoadBalancer', {
      vpc: vpcLinkPlacement.vpc,
      vpcPlacement: vpcLinkPlacement.vpcPlacementStrategy
    });

    const listener = networkBalancer.addListener(vpcLinkName + 'NetworkLoadBalancerListener', {
      port: 80
    });

    listener.addTargets(vpcLinkName + 'NetworkLoadBalancerTargets', {
      port: 80,
      targets
    });

    this.vpcLink = new apigateway.VpcLink(this, this.id + 'VpcLink', {
      targets: [networkBalancer],
      name: vpcLinkName
    });

    //Outputs
    // const vpcLinkId = new cdk.CfnOutput(this, vpcLinkName, {
    //   description: `${vpcLinkName} VCP link id`,
    //   value: this.vpcLink.vpcLinkId
    // });

    return this
  }
}
