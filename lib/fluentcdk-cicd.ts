import { FluentStackProps, FluentConstruct, MasterBuilder, ConstructStore, StackCallback, IFluentStackProps, StackBuilder, IHash } from "./fluentCDK";
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codecommit = require('@aws-cdk/aws-codecommit');
import codebuild = require('@aws-cdk/aws-codebuild');
import cicd = require('@aws-cdk/app-delivery');

const branchNames = ['develop', 'master'];
declare module "./index" {
    interface MasterBuilder {
        cicdStack: cdk.Stack;
        pipelines: codepipeline.Pipeline[];
        synthesisedApps: SynthesisedAppsStore;
        withCiCd(cicdPipeLineName: string, repositoryName: string, createNewRepo?: boolean): MasterBuilder;
        addCICDStack(name: string,
            callStackBuilder: StackCallback,
            props?: IFluentStackProps
        ): MasterBuilder;
    }
}
MasterBuilder.prototype.withCiCd = function (cicdPipeLineName: string, repositoryName: string, createNewRepo: boolean = false): MasterBuilder {
    this.addCICDStack(cicdPipeLineName, sb => {
        sb.addConstruct<CICD, CICDProps>(CICD, cicdPipeLineName, {
            CICDPipeLineName: cicdPipeLineName,
            RepositoryName: repositoryName,
            CreateNewRepo: createNewRepo
        }, cb => {
            this.pipelines = cb.construct.pipelines;
            this.cicdStack = sb.stack;
            this.synthesisedApps = cb.construct.synthesizedApps;
        });
    })
    return this;
};
MasterBuilder.prototype.addStack = function (name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
): MasterBuilder {
    let constructStack: cdk.Stack;
    this._addstack(name, sb => {
        constructStack = sb.stack;
        callStackBuilder(sb);
    }, props);
    this.pipelines.forEach(pipeline => {
        const stageName = 'Deploy-' + constructStack.name;
        const deployStage = pipeline.addStage(stageName)
        new cicd.PipelineDeployStackAction(this.cicdStack, stageName + pipeline.id, {
            stage: deployStage,
            stack: constructStack,
            inputArtifact: this.synthesisedApps[pipeline.id],
            createChangeSetRunOrder: 998,
            adminPermissions: true,
        });
    });
    return this;
};
MasterBuilder.prototype.addCICDStack = function (name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
): MasterBuilder {
    this._addstack(name, callStackBuilder, props);
    return this;
};
export class CICDProps extends FluentStackProps {
    CICDPipeLineName: string;
    RepositoryName: string;
    CreateNewRepo: boolean = true;
}
export class SynthesisedAppsStore implements IHash<any>  {
    [details: string]: any;
}
export class CICD extends FluentConstruct {
    parent: cdk.Stack;
    deployStage: codepipeline.Stage;
    synthesizedApps: SynthesisedAppsStore = {};
    pipelines: codepipeline.Pipeline[] = [];
    props: CICDProps;
    constructor(parent: cdk.Stack, name: string, props: CICDProps, constructStore: ConstructStore) {
        super(parent, name, props, constructStore);
        this.parent = parent;
        this.props = props;
        const cicdConstruct = new cdk.Construct(this, 'cicd');
        let repo: any;
        if (!props.CreateNewRepo) {
            repo = codecommit.Repository.import(this, 'repo', {
                repositoryName: this.props.RepositoryName
            });
        }
        else {
            repo = new codecommit.Repository(cicdConstruct, 'Repository', {
                repositoryName: this.props.RepositoryName,
            });
        }
        branchNames.forEach(branch => {
            this.pipelines.push(this.constructPipeline(repo, branch));
        });
    }
    constructPipeline(repository: codecommit.Repository, branchName: string): codepipeline.Pipeline {
        const name = this.props.CICDPipeLineName + '-' + branchName;
        const cicdConstruct = new cdk.Construct(this, name);
        const pipeline = new codepipeline.Pipeline(cicdConstruct, name, {
            pipelineName: name,
            restartExecutionOnUpdate: true,
        });
        const sourceStage = new codepipeline.Stage(cicdConstruct, 'Source', {
            pipeline: pipeline
        });
        new codecommit.PipelineSourceAction(sourceStage, 'Source', {
            stage: sourceStage,
            repository: repository,
            branch: branchName
        });
        const project = new codebuild.PipelineProject(cicdConstruct, 'CodeBuild', {
            environment: {
                buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
            },
            projectName: this.props.CICDPipeLineName + '-CodeBuild-' + branchName,
            buildSpec: this.props.CICDPipeLineName + '_buildspec.yml',
        });
        const buildStage = pipeline.addStage('Build');
        const buildAction = project.addToPipeline(buildStage, 'BuildAction');
        this.synthesizedApps[name] = buildAction.outputArtifact;
        const selfUpdateStage = pipeline.addStage('SelfUpdate');
        new cicd.PipelineDeployStackAction(cicdConstruct, 'SelfUpdatePipeline', {
            adminPermissions: true,
            stage: selfUpdateStage,
            stack: this.parent,
            inputArtifact: this.synthesizedApps[name],
        });
        return pipeline;
    }
}