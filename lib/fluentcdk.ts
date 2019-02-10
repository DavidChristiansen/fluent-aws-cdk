import cdk = require('@aws-cdk/cdk');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipelineapi = require('@aws-cdk/aws-codepipeline-api');
import codecommit = require('@aws-cdk/aws-codecommit');
import codebuild = require('@aws-cdk/aws-codebuild');
import cicd = require('@aws-cdk/app-delivery');

const branchNames = ['develop', 'master'];

class FluentStack extends cdk.Stack implements cdk.ITaggable {
  tags: cdk.TagManager;
  stackPrefix: string;
  constructor(parent: cdk.App, stackPrefix: string, name: string, props?: IFluentStackProps) {
    super(parent, name, props);
    this.stackPrefix = stackPrefix;
  }
}
interface IBuilder {

}
class Builder implements IBuilder {

}

export type StackCallback = (stackBuilder: StackBuilder) => void;
export type ConstructCallback<T extends FluentConstruct> = (constructBuilder: ConstructBuilder<T>, construct: T) => any;
export interface IFluentStackProps extends cdk.StackProps {
  tags?: cdk.Tag[]
}
export class FluentStackProps implements IFluentStackProps {
  env?: any;
  namingScheme?: any;
  name?: string;
  tags?: cdk.Tag[]
}
export interface IHash<T> {
  [details: string]: T;
}
export class ConstructStore implements IHash<any>  {
  SharedResources: IHash<any> = {};

  setSharedConstruct<T>(name: string, instance: T): void {
    this.SharedResources[name] = instance;
  }
  getSharedConstruct<T>(constructName: string): T {
    const construct = this.SharedResources[constructName] as T;
    if (construct == null) {
      let errorDetail = ("Available constructs are:");
      const members = Object.keys(this.SharedResources);
      members.forEach(resource => {
        errorDetail += "\r\n\t- " + resource
      });
      this.throwError("construct " + constructName + " not found.", errorDetail);
    }
    return construct;
  }
  throwError(exception: string, errorDetail: string) {
  }
}
export class MasterBuilder extends Builder {
  parent: cdk.App;
  stackPrefix: string;
  constructStore: ConstructStore = new ConstructStore();
  constructReturnValues: Map<string, cdk.IConstruct>;
  pipelines: codepipeline.Pipeline[];
  cicdStack: cdk.Stack;
  synthesisedApps: SynthesisedAppsStore;

  constructor(parent: cdk.App, prefix?: string, appendPrefixSeparator: boolean = true) {
    super();
    this.parent = parent;
    this.constructReturnValues = new Map<string, cdk.IConstruct>();
    if (prefix) {
      this.stackPrefix = prefix;
      if (appendPrefixSeparator && (!prefix.endsWith('-')))
        this.stackPrefix += '-';
    }
  }

  withCiCd(cicdPipeLineName: string, repositoryName: string, createNewRepo: boolean = false): MasterBuilder {
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

  addStack(name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
  ): MasterBuilder {
    let constructStack: cdk.Stack;
    this._addstack(name, sb => {
      constructStack = sb.stack;
      callStackBuilder(sb);
    }, props);
    if (this.pipelines) {
      this.pipelines.forEach(pipeline => {
        const stageName = 'Deploy-' + constructStack.name;
        const deployStage = pipeline.addStage(stageName);
        const pipelineName = pipeline.node.resolve(pipeline.pipelineName).Ref;
        new cicd.PipelineDeployStackAction(this.cicdStack, stageName + "-for-" + pipelineName, {
          stage: deployStage,
          stack: constructStack,
          inputArtifact: this.synthesisedApps[pipelineName],
          createChangeSetRunOrder: 998,
          adminPermissions: true,
        });
      });
    }
    return this;
  };

  addCICDStack(name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
  ): MasterBuilder {
    this._addstack(name, callStackBuilder, props);
    return this;
  };

  _addstack(name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
  ): MasterBuilder {
    const cStackName = this._constructStackName(name);
    const stack = new FluentStack(this.parent, this.stackPrefix, cStackName, props);
    callStackBuilder(new StackBuilder(this, stack));
    return this;
  }

  _constructStackName(name: string): any {
    return this.stackPrefix ? this.stackPrefix + name : name;
  }
}
export class StackBuilder extends Builder {

  stack: cdk.Stack;
  masterBuilder: MasterBuilder;
  constructStore: ConstructStore;
  constructor(masterBuilder: MasterBuilder, stack: cdk.Stack) {
    super();
    this.masterBuilder = masterBuilder;
    this.constructStore = masterBuilder.constructStore;
    this.stack = stack;
  }

  addConstruct<T extends FluentConstruct, T2 extends IFluentStackProps>(
    type: { new(parent: cdk.Stack, appName: string, props: T2, constructStore: ConstructStore): T; },
    name: string,
    props: T2,
    addConstructCallback?: ConstructCallback<T>): StackBuilder {
    const construct = new type(this.stack, name, props, this.constructStore);
    construct.apply(new cdk.Tag('CreatedByStack', this.stack.name));
    construct.constructReturnValues.forEach((value, key) => {
      this.masterBuilder.constructReturnValues.set(key, value);
    });
    if (props)
      if (props.tags)
        props.tags.forEach(tag => {
          construct.apply(new cdk.Tag(tag.key, tag.value));
        });
    if (addConstructCallback) {
      addConstructCallback(new ConstructBuilder(construct), construct);
    }
    return this;
  }

  GetImportValue(name: string): cdk.IConstruct | undefined {
    const value = this.masterBuilder.constructReturnValues.get(name);
    return value;
  }
}
export class ConstructBuilder<TConstruct extends FluentConstruct> extends Builder {
  parent: StackBuilder;
  construct: TConstruct;
  constructStore: ConstructStore;

  constructor(construct: TConstruct) {
    super();
    this.construct = construct;
  }

  addTag(key: string, value: string) {
    this.construct.apply(new cdk.Tag(key, value));
  }
}
export class FluentConstruct extends cdk.Construct {
  ConstructStore: ConstructStore;
  Props: IFluentStackProps;
  Prefix: string;
  constructReturnValues: Map<string, cdk.IConstruct> = new Map<string, cdk.IConstruct>();
  constructor(parent: cdk.Construct, name: string, props: IFluentStackProps, constructStore: ConstructStore) {
    super(parent, name);
    this.ConstructStore = constructStore;
    this.Props = props;
    this.Prefix = (parent as FluentStack).stackPrefix;
  }
  StoreOutput(name: string, value: cdk.IConstruct): any {
    this.constructReturnValues.set(name, value);
  }
}
export class CICDProps extends FluentStackProps {
  CICDPipeLineName: string;
  RepositoryName: string;
  CreateNewRepo: boolean = true;
}
export class SynthesisedAppsStore implements IHash<any>  {
  [details: string]: codepipelineapi.Artifact;
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
    const pipelineName = this.node.resolve(pipeline.pipelineName).Ref;
    const buildStage = pipeline.addStage('Build');
    const buildAction = project.addToPipeline(buildStage, 'BuildAction');
    this.synthesizedApps[pipelineName] = buildAction.outputArtifact;
    const selfUpdateStage = pipeline.addStage('SelfUpdate');
    new cicd.PipelineDeployStackAction(cicdConstruct, 'SelfUpdatePipeline', {
      adminPermissions: true,
      stage: selfUpdateStage,
      stack: this.parent,
      inputArtifact: this.synthesizedApps[pipelineName],
    });
    return pipeline;
  }
}