
   __ _                  _                                _ _           
  / _| |                | |                              | | |          
 | |_| |_   _  ___ _ __ | |_   __ ___      _____   ___ __| | | __       
 |  _| | | | |/ _ \ '_ \| __| / _` \ \ /\ / / __| / __/ _` | |/ /       
 | | | | |_| |  __/ | | | |_ | (_| |\ V  V /\__ \| (_| (_| |   <        
 |_|_|_|\__,_|\___|_| |_|\__(_)__,_| \_/\_/ |___(_)___\__,_|_|\_\

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
import { VPCs, VPCProps } from '../<FolderContainingYourFluentConstructs>/vpc';

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

               _                     _                              _   
  _| || |_    | |                   | |                            | |  
 |_  __  _| __| | __ ___   _____  __| | ___   ___  ___   _ __   ___| |_ 
  _| || |_ / _` |/ _` \ \ / / _ \/ _` |/ _ \ / _ \/ __| | '_ \ / _ \ __|
 |_  __  _| (_| | (_| |\ V /  __/ (_| | (_) |  __/\__ \_| | | |  __/ |_ 
   |_||_|  \__,_|\__,_| \_/ \___|\__,_|\___/ \___||___(_)_| |_|\___|\__|
