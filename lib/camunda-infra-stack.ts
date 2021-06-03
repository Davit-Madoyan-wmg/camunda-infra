import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import {BuildConfig} from "../config/build-config";


export class CamundaInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, buildConfig: BuildConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'camundaVPC', {
      cidr: buildConfig.Cidr,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: 'db',
          subnetType: ec2.SubnetType.ISOLATED,
        }
     ]
    })

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'camundaCluster', {
      vpc: vpc,
    })

    // Create SG for RDS
    const redisSGAccess = new ec2.SecurityGroup(this, `rds-security-group-access`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'CDK Security Group'
    });

    const redisSG = new ec2.SecurityGroup(this, `rds-security-group`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'CDK Security Group'
    });
    redisSG.connections.allowFrom(redisSGAccess, ec2.Port.tcp(5432), 'Ingress postgres from public sg');

    // Create an RDS instance
    const rdsInstance = new rds.DatabaseInstance(this, 'CamundaInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({version: rds.PostgresEngineVersion.VER_12_5}),
      instanceType: new ec2.InstanceType(`${buildConfig.DbInstClass}.${buildConfig.DbInstType}`),
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      databaseName: buildConfig.DbName,
      credentials: rds.Credentials.fromUsername(buildConfig.DbUser, {secretName: buildConfig.DbPass}),
      securityGroups: [redisSG]
    })
  }
}
