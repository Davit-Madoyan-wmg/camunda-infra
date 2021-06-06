#!/usr/bin/env node
import {Tags} from '@aws-cdk/core';
import cdk = require('@aws-cdk/core');
import {CamundaInfraStack} from '../lib/camunda-infra-stack';
import {BuildConfig} from "../config/build-config";

const app = new cdk.App();

function ensureString(object: { [name: string]: any }, propName: string ): string {
  if(!object[propName] || object[propName].trim().length === 0)
      throw new Error(propName +" does not exist or is empty");

  return object[propName];
}

function getConfig() {
  let env = app.node.tryGetContext('config');
  if (!env)
      throw new Error("Context variable missing on CDK command. Pass in as `-c config=XXX`");

  let unparsedEnv = app.node.tryGetContext(env);

  let buildConfig: BuildConfig = {
      AWSProfileRegion: ensureString(unparsedEnv, 'AWSProfileRegion'),
      Project: ensureString(unparsedEnv, 'Project'),
      App: ensureString(unparsedEnv, 'App'),
      Environment: ensureString(unparsedEnv, 'Environment'),
      Cidr: ensureString(unparsedEnv, 'Cidr'),
      DbName: ensureString(unparsedEnv, 'DbName'),
      DbUser: ensureString(unparsedEnv, 'DbUser'),
      DbInstType: ensureString(unparsedEnv, 'DbInstType'),
      DbInstClass: ensureString(unparsedEnv, 'DbInstClass')
  };

  return buildConfig;
}

function Main() {
  let buildConfig: BuildConfig = getConfig();

    Tags.of(app).add('Project', buildConfig.Project);
    Tags.of(app).add('App', buildConfig.App);
    Tags.of(app).add('Environment', buildConfig.Environment);

  let mainStackName = buildConfig.App + "-" + buildConfig.Environment + "-main";
  const mainStack = new CamundaInfraStack(app, mainStackName, buildConfig, {env: {region: buildConfig.AWSProfileRegion}});
}

Main();
