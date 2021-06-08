#!/usr/bin/env node
import {Tags} from '@aws-cdk/core';
import {CamundaInfraStack} from '../lib/camunda-infra-stack';
import {BuildConfig} from "../config/build-config";
import {ListBucketsCommand, S3Client} from '@aws-sdk/client-s3';
import {GetCallerIdentityCommand, STSClient} from '@aws-sdk/client-sts';
import cdk = require('@aws-cdk/core');

const app = new cdk.App();

function ensureString(object: { [name: string]: any }, propName: string): string {
    if (!object[propName] || object[propName].trim().length === 0)
        throw new Error(propName + " does not exist or is empty");

    return object[propName];
}

function getConfig() {
    let env = app.node.tryGetContext('config');
    if (!env)
        throw new Error("Context variable missing on CDK command. Pass in as `-c config=XXX`");

    let unparsedEnv = app.node.tryGetContext(env);

    const buildConfig: BuildConfig = {
        AWSProfileRegion: ensureString(unparsedEnv, 'AWSProfileRegion'),
        Project: ensureString(unparsedEnv, 'Project'),
        App: ensureString(unparsedEnv, 'App'),
        Environment: ensureString(unparsedEnv, 'Environment'),

        Cidr: unparsedEnv.Cidr || "10.11.0.0/16",
        enableDnsSupport: unparsedEnv.enableDnsSupport || "true",
        natGateways: unparsedEnv.natGateways || "1",
        enableDnsHostnames: unparsedEnv.enableDnsHostnames || "true",
        maxAzs: unparsedEnv.maxAzs || "2",
        allowAllOutboundSGAccess: unparsedEnv.allowAllOutboundSGAccess || "true",
        allowAllOutboundSG: unparsedEnv.allowAllOutboundSG || "true",
        fargateMemoryLimitMiB: unparsedEnv.fargateMemoryLimitMiB || "512",
        fargateCpu: unparsedEnv.fargateCpu || "256",
        fargateImage: unparsedEnv.fargateImage || "camunda/camunda-bpm-platform",
        fargateContainerPort: unparsedEnv.fargateContainerPort || "8080",
        fargateLogRetention: unparsedEnv.fargateLogRetention || "60",
        allowAllOutboundAlbSG: unparsedEnv.allowAllOutboundAlbSG || "true",
        ingressPortAlbSG: unparsedEnv.ingressPortAlbSG || "80",
        allowAllOutboundServiceSG: unparsedEnv.allowAllOutboundServiceSG || "true",
        ingressPortServiceSG: unparsedEnv.ingressPortServiceSG || "8080",
        desiredCountservice: unparsedEnv.desiredCountservice || "1",
        internetFacinglb: unparsedEnv.internetFacinglb || "true",
        portListener: unparsedEnv.portListener || "80",
        portTargetGroup: unparsedEnv.portTargetGroup || "8080",
        pathHealthCheck: unparsedEnv.pathHealthCheck || "/",
        intervalHealthCheck: unparsedEnv.intervalHealthCheck || "1",
        healthyThresholdCount: unparsedEnv.healthyThresholdCount || "7",
        unhealthyThresholdCount: unparsedEnv.unhealthyThresholdCount || "7",
        healthyHttpCodes: unparsedEnv.healthyHttpCodes || "200-399",
        targetUtilizationPercent: unparsedEnv.targetUtilizationPercent || "50",
        ASGmaxCapacity: unparsedEnv.ASGmaxCapacity || "10",
        ASGminCapacity: unparsedEnv.ASGminCapacity || "1",
        DatabaseInstanceEngineFullVersion: unparsedEnv.DatabaseInstanceEngineFullVersion || "12.5",
        DatabaseInstanceEngineMajorVersion: unparsedEnv.DatabaseInstanceEngineMajorVersion || "12",
        DbName: unparsedEnv.DbName || "camunda_db",
        DbUser: unparsedEnv.DbUser || "camunda",
        DbInstType: unparsedEnv.DbInstType || "small",
        DbInstClass: unparsedEnv.DbInstClass || "t3"
    };

    return buildConfig;
}

const main = async () => {
    let buildConfig: BuildConfig = getConfig();

    const s3Client = new S3Client({region: 'us-east-1'});
    const stsClient = new STSClient({region: 'us-east-1'});

    const bucketList = await s3Client.send(new ListBucketsCommand({}));
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));


    Tags.of(app).add('Project', buildConfig.Project);
    Tags.of(app).add('App', buildConfig.App);
    Tags.of(app).add('Environment', buildConfig.Environment);

    let mainStackName = buildConfig.App + "-" + buildConfig.Environment + "-main";
    const mainStack = new CamundaInfraStack(
        app,
        mainStackName,
        buildConfig,
        {
            bucketList,
            callerIdentity
        },
        {
            env: {
                region: buildConfig.AWSProfileRegion
            }
        });
}

main();
