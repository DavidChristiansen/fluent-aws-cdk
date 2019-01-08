import cdk = require('@aws-cdk/cdk');
const chalk = require('chalk')
const logSymbols = require('log-symbols');

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
    throw ('\r\n\r\n' + logSymbols.error + " " + chalk.yellow.bold('Error: ') + exception + "\r\n\r\n" + chalk.cyan.bold('Error Detail\r\n-------------------------\r\n\r\n') + errorDetail);
  }
}

export class MasterBuilder extends Builder {
  parent: cdk.App;
  stackPrefix: string;
  constructStore: ConstructStore = new ConstructStore();
  constructReturnValues: Map<string, cdk.FnImportValue>;

  constructor(parent: cdk.App, prefix?: string, appendPrefixSeparator: boolean = true) {
    super();
    this.parent = parent;
    this.constructReturnValues = new Map<string, cdk.FnImportValue>();
    this.stackPrefix = prefix;
    if (appendPrefixSeparator && (!prefix.endsWith('-')))
      this.stackPrefix += '-';
  }

  addStack(
    name: string,
    callStackBuilder: StackCallback,
    props?: IFluentStackProps
  ): MasterBuilder {
    this._addstack(name, callStackBuilder, props);
    return this;
  }

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
    type: { new(parent: cdk.Stack, appName: string, props?: T2, constructStore?: ConstructStore): T; },
    name?: string,
    props?: T2,
    addConstructCallback?: ConstructCallback<T>): StackBuilder {
    const construct = new type(this.stack, name, props, this.constructStore);
    construct.tags.setTag('CreatedByStack', this.stack.name);
    construct.constructReturnValues.forEach((value, key) => {
      this.masterBuilder.constructReturnValues.set(key, value);
    });
    if (props)
      if (props.tags)
        props.tags.forEach(tag => {
          construct.tags.setTag(tag.key, tag.value);
        });
    if (addConstructCallback) {
      addConstructCallback(new ConstructBuilder(construct), construct);
    }
    return this;
  }

  GetImportValue(name: string): cdk.FnImportValue {
    const value = this.masterBuilder.constructReturnValues.get(name);
    // console.log('getting value ' + name + ' : ' + value);
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
    this.construct.tags.setTag(key, value);
  }
}

export class FluentConstruct extends cdk.Construct implements cdk.ITaggable {
  tags: cdk.TagManager;
  ConstructStore: ConstructStore;
  Props: IFluentStackProps;
  Prefix: string;
  constructReturnValues: Map<string, cdk.FnImportValue> = new Map<string, cdk.FnImportValue>();
  constructor(parent: cdk.Construct, name: string, props: IFluentStackProps, constructStore: ConstructStore) {
    super(parent, name);
    this.ConstructStore = constructStore;
    this.Props = props;
    this.Prefix = (parent as FluentStack).stackPrefix;
    this.tags = new cdk.TagManager(parent);
  }
  StoreOutput(name: string, value: cdk.FnImportValue): any {
    // console.log('Adding importvalue ' + name + ' with value ' + value);
    this.constructReturnValues.set(name, value);
  }
}