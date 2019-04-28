import { VpcConstruct, VpcPlacement } from '../vpc';
import * as ec2 from '@aws-cdk/aws-ec2';
import { CfnInstance, CfnInstanceProps, IVpcSubnet } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/cdk';

declare module '../vpc' {
  interface VpcConstruct {
    withEc2Instance(id: string, vpcPlacement: VpcPlacement, props?: CfnInstanceProps): VpcConstruct;

    findAllEc2Instances(name: string): CfnInstance[];

    ec2Instances: { [key: string]: CfnInstance[] }
  }
}

export function patchVpcConstructWithBastion() {

  /**
   *
   */
  VpcConstruct.prototype.ec2Instances = {};

  /**
   *
   * @param name
   */
  VpcConstruct.prototype.findAllEc2Instances = function (name: string): CfnInstance[] {
    return this.ec2Instances[name];
  };

  /*
   *
   */
  VpcConstruct.prototype.withEc2Instance = function (id: string, vpcPlacement: VpcPlacement, props?: CfnInstanceProps): VpcConstruct {
    const {
      vpc, vpcPlacementStrategy, securityGroup
    } = vpcPlacement;

    // Collects subnets by the placement
    const subnets: IVpcSubnet[] = vpc.subnets(vpcPlacementStrategy);

    // Groups subnets by AZ
    const subnetsByAz:{ [key: string]: IVpcSubnet[] } = subnets.reduce((acc: { [key: string]: IVpcSubnet[] }, subnet: IVpcSubnet) => {
      const az = subnet.availabilityZone;
      if (az in acc) {
        // Adds to existing list of subnets
        acc[az].push(subnet);
      } else {
        // Adds new list
        acc[az] = [subnet]
      }
      return acc
    }, {});

    const self = this;

    Object.keys(subnetsByAz).map((az:string) => {
      // Formats Ec2 Instance Id
      const instanceId = id + '-' + az;

      // Holds AZ subnets
      const azSubnets = subnetsByAz[az];

      // Ec2 Network Interfaces
      const networkInterfaces: CfnInstance.NetworkInterfaceProperty[] = azSubnets.map((subnet, index) => {

        const networkInterface = new ec2.CfnNetworkInterface(self, `${instanceId}NetworkInterface${index}`, {
          groupSet: [securityGroup.securityGroupId],
          subnetId: subnet.subnetId,
        });

        return {
          networkInterfaceId: networkInterface.ref,
          deviceIndex: '' + index,
        } as CfnInstance.NetworkInterfaceProperty;
      });

      // Ec2 Instance
      const ec2Instance = new ec2.CfnInstance(this, instanceId, {
        availabilityZone: az,
        networkInterfaces,
        //Overrides
        ...props,
      });

      // Pushing mapping to the ec2 instance
      if (id in this.ec2Instances) {
        this.ec2Instances[id].push(ec2Instance);
      } else {
        this.ec2Instances[id] = [ec2Instance]
      }

      // Outputs
      const instancePublicEndpoint = new cdk.CfnOutput(this, `${instanceId}InstancePublicEndpoint`, {
        description: `${instanceId} instance public DNS name`,
        value: ec2Instance.instancePublicDnsName
      });

      const instancePrivateEndpoint = new cdk.CfnOutput(this, `${instanceId}InstancePrivateEndpoint`, {
        description: `${instanceId} instance priuvate DNS name`,
        value: ec2Instance.instancePrivateDnsName
      });

    });
    return this;
  };
}
