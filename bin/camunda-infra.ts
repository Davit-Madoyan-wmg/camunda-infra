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

        AWS_PROFILE_REGION: ensureString(unparsedEnv, 'AWS_PROFILE_REGION'),
        PROJECT: ensureString(unparsedEnv, 'PROJECT'),
        APP: ensureString(unparsedEnv, 'APP'),
        ENVIRONMENT: ensureString(unparsedEnv, 'ENVIRONMENT'),
        VPC: {
            cidr: unparsedEnv.cidr || "10.11.0.0/16",
            enableDnsSupport: unparsedEnv.enableDnsSupport || "true",
            natGateways: unparsedEnv.natGateways || "1",
            enableDnsHostnames: unparsedEnv.enableDnsHostnames || "true",
            maxAzs: unparsedEnv.maxAzs || "2",
        },
        POSTGRES_SG_ACCESS: {
            allowAllOutbound: unparsedEnv.allowAllOutbound || "true",
        },
        POSTGRES_SG: {
            allowAllOutbound: unparsedEnv.allowAllOutbound || "true",
        },
        FARGATE: {
            memoryLimitMiB: unparsedEnv.memoryLimitMiB || "512",
            cpu: unparsedEnv.cpu || "256",
            image: unparsedEnv.image || "camunda/camunda-bpm-platform",
            containerPort: unparsedEnv.containerPort || "8080",
            logRetention: unparsedEnv.logRetention || "60",
        },
        ALB_SG: {
            allowAllOutbound: unparsedEnv.allowAllOutbound || "true",
            ingressPort: unparsedEnv.ingressPort || "80",
        },
        SERVICE_SG: {
            allowAllOutbound: unparsedEnv.allowAllOutbound || "true",
            ingressPort: unparsedEnv.ingressPort || "8080",
        },
        SERVICE: {
            desiredCount: unparsedEnv.desiredCount || "1",
        },
        LOAD_BALANCER: {
            internetFacing: unparsedEnv.internetFacing || "true",
        },
        LISTENER: {
            port: unparsedEnv.port || "80",
        },
        TARGET_GROUP: {
            port: unparsedEnv.port || "8080",
            HealthCheck: {
                path: unparsedEnv.path || "/",
                interval: unparsedEnv.interval || "1",
                healthyThresholdCount: unparsedEnv.healthyThresholdCount || "7",
                unhealthyThresholdCount: unparsedEnv.unhealthyThresholdCount || "7",
                healthyHttpCodes: unparsedEnv.healthyHttpCodes || "200-399",
            }
        },
        AUTO_SCALING_GROUP: {
            targetUtilizationPercent: unparsedEnv.targetUtilizationPercent || "50",
            maxCapacity: unparsedEnv.maxCapacity || "10",
            minCapacity: unparsedEnv.minCapacity || "1",
        },
        RDS: {
            DatabaseInstanceEngineFullVersion: unparsedEnv.DatabaseInstanceEngineFullVersion || "12.5",
            DatabaseInstanceEngineMajorVersion: unparsedEnv.DatabaseInstanceEngineMajorVersion || "12",
            InstanceClass: unparsedEnv.InstanceClass || "t3",
            InstanceType: unparsedEnv.instanceType || "small",
            databaseName: unparsedEnv.databaseName || "camunda_db",
            username: unparsedEnv.username || "camunda",
        }

    };

    return buildConfig;
}

const main = async () => {
    let buildConfig: BuildConfig = getConfig();

    const s3Client = new S3Client({region: 'us-east-1'});
    const stsClient = new STSClient({region: 'us-east-1'});

    const bucketList = await s3Client.send(new ListBucketsCommand({}));
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));


    Tags.of(app).add('Project', buildConfig.PROJECT);
    Tags.of(app).add('App', buildConfig.APP);
    Tags.of(app).add('Environment', buildConfig.ENVIRONMENT);

    let mainStackName = buildConfig.APP + "-" + buildConfig.ENVIRONMENT + "-main";
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
                region: buildConfig.AWS_PROFILE_REGION
            }
        });
}

main();
