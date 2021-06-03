import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
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
    const postgresSGAccess = new ec2.SecurityGroup(this, `rds-security-group-access`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'SG to access Postgres'
    });

    const postgresSG = new ec2.SecurityGroup(this, `rds-security-group`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'SG to attach to Postgres'
    });
    postgresSG.connections.allowFrom(postgresSGAccess, ec2.Port.tcp(5432), 'Ingress postgres from postgresSGAccess');

    // Create an RDS instance
    const rdsInstance = new rds.DatabaseInstance(this, 'CamundaInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({version: rds.PostgresEngineVersion.VER_12_5}),
      instanceType: new ec2.InstanceType(`${buildConfig.DbInstClass}.${buildConfig.DbInstType}`),
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      databaseName: buildConfig.DbName,
      credentials: rds.Credentials.fromUsername(buildConfig.DbUser, {secretName: buildConfig.DbPass}),
      securityGroups: [postgresSG]
    })

    // Create a task definition
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'camundaTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256
    });

    // Add params to task definition
    fargateTaskDefinition.addContainer("camunda", {
      // Use an image from DockerHub
      image: ecs.ContainerImage.fromRegistry("camunda/camunda-bpm-platform"),
      portMappings: [{ containerPort: 8080 }],
      containerName: buildConfig.App,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'camunda' }),
      environment: {
        DB_DRIVER: "org.postgresql.Driver",
        DB_USERNAME: buildConfig.DbUser,
        DB_PASSWORD: buildConfig.DbPass,
        DB_URL: rdsInstance.instanceEndpoint.socketAddress
      }
    });

    // Create SG for ALB
    const AlbSG = new ec2.SecurityGroup(this, `Alb-security-group`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'SG for ALB'
    });
    AlbSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP ingress from anywhere');

    // Create SG for Service
    const ServiceSG = new ec2.SecurityGroup(this, `Alb-security-group-access`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'SG for camunda service'
    });
    ServiceSG.connections.allowFrom(AlbSG, ec2.Port.tcp(80), 'Ingress from ALB sg');

    // Create service
    const service = new ecs.FargateService(this, 'camundaService', {
      cluster: cluster,
      taskDefinition: fargateTaskDefinition,
      desiredCount: 1,
      securityGroups: [postgresSGAccess, ServiceSG]
    });

    // Create ALB
    const lb = new elbv2.ApplicationLoadBalancer(this, 'camundaLB', { vpc, internetFacing: true, securityGroup: AlbSG });
    const listener = lb.addListener('Listener', { port: 80 });
    const targetGroup = listener.addTargets('ECS', {
      port: 8080,
      targets: [service]
    });

    // Create ASG
    const scaling = service.autoScaleTaskCount({ maxCapacity: 10, minCapacity: 1 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50
    });

  }
}
