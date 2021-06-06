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
      enableDnsSupport: ensureString(unparsedEnv, 'enableDnsSupport') || "true",
      natGateways: ensureString(unparsedEnv, 'natGateways') || "1",
      enableDnsHostnames: ensureString(unparsedEnv, 'enableDnsHostnames') || "true",
      maxAzs: ensureString(unparsedEnv, 'maxAzs') || "2",
      allowAllOutboundSGAccess: ensureString(unparsedEnv, 'allowAllOutboundSGAccess') || "true",
      allowAllOutboundSG: ensureString(unparsedEnv, 'allowAllOutboundSG') || "true",
      fargateMemoryLimitMiB: ensureString(unparsedEnv, 'fargateMemoryLimitMiB') || "512",
      fargateCpu: ensureString(unparsedEnv, 'fargateCpu') || "256",
      fargateImage: ensureString(unparsedEnv, 'fargateImage') || "camunda/camunda-bpm-platform",
      fargateContainerPort: ensureString(unparsedEnv, 'fargateContainerPort') || "8080",
      allowAllOutboundAlbSG: ensureString(unparsedEnv, 'allowAllOutboundAlbSG') || "true",
      ingressPortAlbSG: ensureString(unparsedEnv, 'ingressPortAlbSG') || "80",
      allowAllOutboundServiceSG: ensureString(unparsedEnv, 'allowAllOutboundServiceSG') || "true",
      ingressPortServiceSG: ensureString(unparsedEnv, 'ingressPortServiceSG') || "8080",
      desiredCountservice: ensureString(unparsedEnv, 'desiredCountservice') || "1",
      internetFacinglb: ensureString(unparsedEnv, 'internetFacinglb') || "true",
      portListener: ensureString(unparsedEnv, 'portListener') || "80",
      portTargetGroup: ensureString(unparsedEnv, 'portTargetGroup') || "8080",
      pathHealthCheck: ensureString(unparsedEnv, 'pathHealthCheck') || "/",
      intervalHealthCheck: ensureString(unparsedEnv, 'intervalHealthCheck') || "1",
      healthyThresholdCount: ensureString(unparsedEnv, 'healthyThresholdCount') || "7",
      unhealthyThresholdCount: ensureString(unparsedEnv, 'unhealthyThresholdCount') || "7",
      healthyHttpCodes: ensureString(unparsedEnv, 'healthyHttpCodes') || "200-399",
      targetUtilizationPercent: ensureString(unparsedEnv, 'targetUtilizationPercent') || "50",
      DbName: ensureString(unparsedEnv, 'DbName') || "processengine",
      DbUser: ensureString(unparsedEnv, 'DbUser' || "camunda"),
      DbInstType: ensureString(unparsedEnv, 'DbInstType' || "small"),
      DbInstClass: ensureString(unparsedEnv, 'DbInstClass' || "t3")
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
