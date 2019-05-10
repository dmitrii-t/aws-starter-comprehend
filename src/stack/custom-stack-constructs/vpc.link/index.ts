import { VpcConstruct, VpcPlacement } from '../vpc';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { VpcLink } from '@aws-cdk/aws-apigateway';
import { INetworkLoadBalancerTarget } from '@aws-cdk/aws-elasticloadbalancingv2';
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');


declare module '../vpc' {
  interface VpcConstruct {
    /**
     * Creates VPC Link with private placement
     *
     * @param vpcLinkName
     * @param targets
     */
    withPrivateVpcLink(vpcLinkName: string, targets: INetworkLoadBalancerTarget[]): VpcConstruct;

    /**
     * Creates VPC Link with specified placement
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

export function patchVpcConstructWithVpcLink() {

  //
  VpcConstruct.prototype.withPrivateVpcLink = function (vpcLinkName: string, targets: INetworkLoadBalancerTarget[]): VpcConstruct {
    return this.withVpcLink(vpcLinkName, this.privateVpcPlacement, targets);
  };

  //
  VpcConstruct.prototype.withVpcLink = function (vpcLinkName: string, vpcLinkPlacement: VpcPlacement, targets: INetworkLoadBalancerTarget[]): VpcConstruct {
    //
    const networkBalancer = new elbv2.NetworkLoadBalancer(this, vpcLinkName + 'NetworkLoadBalancer', {
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

    this.vpcLink = new apigateway.VpcLink(this, vpcLinkName + 'VpcLink', {
      targets: [networkBalancer],
      name: vpcLinkName
    });
    this.vpcLink.node.addDependency(networkBalancer);

    //Outputs
    // const vpcLinkId = new cdk.CfnOutput(this, vpcLinkName, {
    //   description: `${vpcLinkName} VCP link id`,
    //   value: this.vpcLink.vpcLinkId
    // });

    return this
  }
}
