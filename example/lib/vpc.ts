import ec2 = require('@aws-cdk/aws-ec2');
import cdk = require('@aws-cdk/cdk');
import fluentCDK = require('../../lib/fluentcdk');
import { SubnetType } from '@aws-cdk/aws-ec2';

export class VPCProps extends fluentCDK.FluentStackProps {
    cidr: string;
    includePublicSubnet: boolean = true;
    includePrivate: boolean = true;
    includeIsolated: boolean = true;
}
export class VPCs extends fluentCDK.FluentConstruct {
    constructor(parent: cdk.Stack, name: string, props: VPCProps, constructStore: fluentCDK.ConstructStore) {
        super(parent, name, props as fluentCDK.IFluentStackProps, constructStore);

        let subnetConfiguration: ec2.SubnetConfiguration[] = [];
        if (
            (props.includePublicSubnet) ||
            (props.includePrivate) ||
            (props.includeIsolated)) {
            if (props.includePublicSubnet) {
                subnetConfiguration.push({
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: SubnetType.Public
                })
            }
            if (props.includePrivate) {
                subnetConfiguration.push({
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: SubnetType.Private
                })
            }
            if (props.includeIsolated) {
                subnetConfiguration.push({
                    cidrMask: 24,
                    name: 'Database',
                    subnetType: SubnetType.Isolated
                })
            }
        }

        const newVpc: ec2.VpcNetwork = new ec2.VpcNetwork(this, 'vpc', {
            natGateways: 1,
            natGatewayPlacement: {
                subnetsToUse: SubnetType.Public
            },
            cidr: props.cidr,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnetConfiguration: subnetConfiguration
        });

        this.ConstructStore.SharedResources[name] = newVpc;
    }
}