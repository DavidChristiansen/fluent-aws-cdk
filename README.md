
            8888888b.  .d8888b.              .d8888b. 8888888b. 888    d8P             888            d8888888888b.   
            888  "Y88bd88P  Y88b            d88P  Y88b888  "Y88b888   d8P              888           d88888888  "88b  
            888    888888    888            888    888888    888888  d8P               888          d88P888888  .88P  
            888    888888                   888       888    888888d88K                888         d88P 8888888888K.  
            888    888888                   888       888    8888888888b               888        d88P  888888  "Y88b 
            888    888888    888   888888   888    888888    888888  Y88b     888888   888       d88P   888888    888 
            888  .d88PY88b  d88P            Y88b  d88P888  .d88P888   Y88b             888      d8888888888888   d88P 
            8888888P"  "Y8888P"              "Y8888P" 8888888P" 888    Y88b            88888888d88P     8888888888P"  

# FluentCDK
A fluent style interface for AWS-CDK.

<!-- Patience is not simply the ability to wait - it's how we behave while we're waiting.

## Installation

via NPM
```bash
npm install --save @davedoes/aws-cdk/fluent
```

or via yarn
```bash
yarn install --save @davedoes/aws-cdk/fluent
```

-->

## Example usage

App Definition (index.ts)
```javascript
import cdk = require('@aws-cdk/cdk');
import fluentCDK = require('../lib/fluentcdk');
import '../lib/fluentcdk-cicd';
import { VPCs, VPCProps } from '../constructs/vpc';
import { VPN, VPNProps } from '../constructs/vpn';
import { TransitGW, TransitGWProps } from '../constructs/transitgw';

const app = new cdk.App();
new fluentCDK.MasterBuilder(app, 'lab')
    .withCiCd('infraCICD', 'cdk-lab')  // Defines a CI/CD pipeline
    .addStack('vpc', s => {
        s.addConstruct<VPCs, VPCProps>(VPCs, 'management', {
            cidr: '10.121.0.0/16',
            includePublicSubnet: true,
            includePrivate: true,
            includeIsolated: false
        });
    });
app.run();
```

Construct Definition
```javascript
import ec2 = require('@aws-cdk/aws-ec2');
import cdk = require('@aws-cdk/cdk');
import { FluentConstruct, FluentStackProps, ConstructStore, IFluentStackProps, IHash } from '../lib/fluentcdk';
import { SubnetType, VpcPlacementStrategy } from '@aws-cdk/aws-ec2';

export class VPCProps extends FluentStackProps {
    cidr: string;
    includePublicSubnet: boolean = true;
    includePrivate: boolean = true;
    includeIsolated: boolean = true;
}
export class VPCs extends FluentConstruct {
    constructor(parent: cdk.Stack, name: string, props: VPCProps, constructStore: ConstructStore) {
        super(parent, name, props as IFluentStackProps, constructStore);

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

        this.ConstructStore.SharedResources[name] = newVpc.export();
    }
}
```

# Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
