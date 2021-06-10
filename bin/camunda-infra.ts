#!/usr/bin/env node
import {Tags} from '@aws-cdk/core';
import {CarpathiaCamundaStack} from '../lib/camunda-infra-stack';
import {BuildConfig} from "../config/build-config";
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
        ACCOUNT: ensureString(unparsedEnv, 'ACCOUNT'),
        PROJECT: ensureString(unparsedEnv, 'PROJECT'),
        APP: ensureString(unparsedEnv, 'APP'),
        ENVIRONMENT: ensureString(unparsedEnv, 'ENVIRONMENT'),
        VPC: {
            cidr: unparsedEnv.VPC.cidr || "10.11.0.0/16",
            enableDnsSupport: unparsedEnv.VPC.enableDnsSupport || "true",
            natGateways: unparsedEnv.VPC.natGateways || "1",
            enableDnsHostnames: unparsedEnv.VPC.enableDnsHostnames || "true",
            maxAzs: unparsedEnv.VPC.maxAzs || "2",
        },
        POSTGRES_SG_ACCESS: {
            allowAllOutbound: unparsedEnv.POSTGRES_SG_ACCESS.allowAllOutbound || "true",
        },
        POSTGRES_SG: {
            allowAllOutbound: unparsedEnv.POSTGRES_SG.allowAllOutbound || "true",
        },
        FARGATE: {
            memoryLimitMiB: unparsedEnv.FARGATE.memoryLimitMiB || "512",
            cpu: unparsedEnv.FARGATE.cpu || "256",
            image: unparsedEnv.FARGATE.image || "camunda/camunda-bpm-platform:7.15.0",
            containerPort: unparsedEnv.FARGATE.containerPort || "8080",
            logRetention: unparsedEnv.FARGATE.logRetention || "60",
        },
        ALB_SG: {
            allowAllOutbound: unparsedEnv.ALB_SG.allowAllOutbound || "true",
            ingressPort: unparsedEnv.ALB_SG.ingressPort || "80",
        },
        SERVICE_SG: {
            allowAllOutbound: unparsedEnv.SERVICE_SG.allowAllOutbound || "true",
            ingressPort: unparsedEnv.SERVICE_SG.ingressPort || "8080",
        },
        SERVICE: {
            desiredCount: unparsedEnv.SERVICE.desiredCount || "1",
        },
        LOAD_BALANCER: {
            internetFacing: unparsedEnv.LOAD_BALANCER.internetFacing || "true",
        },
        LISTENER: {
            port: unparsedEnv.LISTENER.port || "80",
        },
        TARGET_GROUP: {
            port: unparsedEnv.TARGET_GROUP.port || "8080",
            HealthCheck: {
                path: unparsedEnv.TARGET_GROUP.HealthCheck.path || "/",
                interval: unparsedEnv.TARGET_GROUP.HealthCheck.interval || "1",
                healthyThresholdCount: unparsedEnv.TARGET_GROUP.HealthCheck.healthyThresholdCount || "7",
                unhealthyThresholdCount: unparsedEnv.TARGET_GROUP.HealthCheck.unhealthyThresholdCount || "7",
                healthyHttpCodes: unparsedEnv.TARGET_GROUP.HealthCheck.healthyHttpCodes || "200-399",
            }
        },
        AUTO_SCALING_GROUP: {
            targetUtilizationPercent: unparsedEnv.AUTO_SCALING_GROUP.targetUtilizationPercent || "50",
            maxCapacity: unparsedEnv.AUTO_SCALING_GROUP.maxCapacity || "10",
            minCapacity: unparsedEnv.AUTO_SCALING_GROUP.minCapacity || "1",
        },
        RDS: {
            DatabaseInstanceEngineFullVersion: unparsedEnv.RDS.DatabaseInstanceEngineFullVersion || "12.5",
            DatabaseInstanceEngineMajorVersion: unparsedEnv.RDS.DatabaseInstanceEngineMajorVersion || "12",
            InstanceClass: unparsedEnv.RDS.InstanceClass || "t3",
            InstanceType: unparsedEnv.RDS.instanceType || "small",
            databaseName: unparsedEnv.RDS.databaseName || "camunda_db",
            username: unparsedEnv.RDS.username || "camunda",
        }

    };

    return buildConfig;
}

const main = async () => {
    let buildConfig: BuildConfig = getConfig();

    Tags.of(app).add('Project', buildConfig.PROJECT);
    Tags.of(app).add('App', buildConfig.APP);
    Tags.of(app).add('Environment', buildConfig.ENVIRONMENT);

    let mainStackName = buildConfig.PROJECT + "-" + buildConfig.APP + "-" + buildConfig.ENVIRONMENT;
    const mainStack = new CarpathiaCamundaStack(
        app,
        mainStackName,
        buildConfig,
        {
            env: {
                region: buildConfig.AWS_PROFILE_REGION,
                account: buildConfig.ACCOUNT
            }
        }
    )
}

main();
