import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import {BuildConfig} from "../config/build-config";
import {Tags} from "@aws-cdk/core";


export class CamundaInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, buildConfig: BuildConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    function convertStringToBool(boolStr:string):boolean{
      return (/true/i).test(boolStr)
    }

    const appFullName = `${buildConfig.Project}-${buildConfig.App}-${buildConfig.Environment}`

    const vpc = new ec2.Vpc(this, 'camundaVPC', {
      cidr: buildConfig.Cidr,
      enableDnsSupport: convertStringToBool(buildConfig.enableDnsSupport),
      natGateways: +buildConfig.natGateways,
      enableDnsHostnames: convertStringToBool(buildConfig.enableDnsHostnames),
      maxAzs: +buildConfig.maxAzs,
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
    Tags.of(vpc).add("Name",`${appFullName}-vpc`)

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'camundaCluster', {
      vpc: vpc,
      clusterName: `${appFullName}-cluster`
    })
    Tags.of(cluster).add("Name",`${appFullName}-cluster`)

    // Create SG for RDS
    const postgresSGAccess = new ec2.SecurityGroup(this, `rds-security-group-access`, {
      vpc: vpc,
      allowAllOutbound: convertStringToBool(buildConfig.allowAllOutboundSGAccess),
      description: 'SG to access Postgres',
    });
    Tags.of(postgresSGAccess).add("Name",`${appFullName}-rds-access-sg`)

    const postgresSG = new ec2.SecurityGroup(this, `rds-security-group`, {
      vpc: vpc,
      allowAllOutbound: convertStringToBool(buildConfig.allowAllOutboundSG),
      description: 'SG to attach to Postgres'
    });
    postgresSG.connections.allowFrom(postgresSGAccess, ec2.Port.tcp(5432), 'Ingress postgres from postgresSGAccess');
    Tags.of(postgresSG).add("Name",`${appFullName}-rds-sg`)

    const secret = new rds.DatabaseSecret(this, 'Secret', {
      username: buildConfig.DbUser,
      secretName: `${appFullName}-dbsecret`
    });
    Tags.of(secret).add("Name",`${appFullName}-dbsecret`)

    // Create an RDS instance
    const rdsInstance = new rds.DatabaseInstance(this, 'CamundaInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.of(
              buildConfig.DatabaseInstanceEngineFullVersion,
              buildConfig.DatabaseInstanceEngineMajorVersion
          )
      }),
      instanceType: new ec2.InstanceType(`${buildConfig.DbInstClass}.${buildConfig.DbInstType}`),
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
      databaseName: buildConfig.DbName,
      credentials: rds.Credentials.fromSecret(secret),
      securityGroups: [postgresSG],
      instanceIdentifier: `${appFullName}-rds`
    })
    Tags.of(rdsInstance).add("Name",`${appFullName}-rds`)

    // Create a task definition
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'camundaTaskDef', {
      memoryLimitMiB: +buildConfig.fargateMemoryLimitMiB,
      cpu: +buildConfig.fargateCpu
    });

    // Add params to task definition
    fargateTaskDefinition.addContainer("camunda", {
      // Use an image from DockerHub
      image: ecs.ContainerImage.fromRegistry("camunda/camunda-bpm-platform"),
      portMappings: [{ containerPort: +buildConfig.fargateContainerPort }],
      containerName: buildConfig.App,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: `/aws/ecs/${appFullName}` }),
      environment: {
        DB_DRIVER: "org.postgresql.Driver",
        DB_URL: "jdbc:postgresql://"+rdsInstance.instanceEndpoint.socketAddress+"/"+buildConfig.DbName
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(rdsInstance.secret!, 'password'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(rdsInstance.secret!, 'username'),
      },
    });
    Tags.of(fargateTaskDefinition).add("Name",`${appFullName}-fargatetaskdefinition`)

    // Create SG for ALB
    const AlbSG = new ec2.SecurityGroup(this, `Alb-security-group`, {
      vpc: vpc,
      allowAllOutbound: convertStringToBool(buildConfig.allowAllOutboundAlbSG),
      description: 'SG for ALB'
    });
    AlbSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(+buildConfig.ingressPortAlbSG), 'HTTP ingress from anywhere');
    Tags.of(AlbSG).add("Name",`${appFullName}-alb-sg`)

    // Create SG for Service
    const ServiceSG = new ec2.SecurityGroup(this, `Alb-security-group-access`, {
      vpc: vpc,
      allowAllOutbound: convertStringToBool(buildConfig.allowAllOutboundServiceSG),
      description: 'SG for camunda service'
    });
    ServiceSG.connections.allowFrom(AlbSG, ec2.Port.tcp(+buildConfig.ingressPortServiceSG), 'Ingress from ALB sg');
    Tags.of(ServiceSG).add("Name",`${appFullName}-service-sg`)

    // Create service
    const service = new ecs.FargateService(this, 'camundaService', {
      cluster: cluster,
      taskDefinition: fargateTaskDefinition,
      desiredCount: +buildConfig.desiredCountservice,
      vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE},
      securityGroups: [postgresSGAccess, ServiceSG],
      serviceName: `${appFullName}-service`
    });
    Tags.of(service).add("Name",`${appFullName}-service`)

    // Create ALB
    const lb = new elbv2.ApplicationLoadBalancer(this, 'camundaLB', {
      vpc,
      internetFacing: convertStringToBool(buildConfig.internetFacinglb),
      securityGroup: AlbSG,
      loadBalancerName: `${appFullName}-lb`
    });
    Tags.of(lb).add("Name",`${appFullName}-lb`)

    //  Create listener
    const listener = lb.addListener('Listener', { port: +buildConfig.portListener });
    Tags.of(listener).add("Name",`${appFullName}-listener`)

    //  Create targetGroup
    const targetGroup = listener.addTargets('ECS', {
      port: +buildConfig.portTargetGroup,
      targets: [service],
      healthCheck: {
        path: buildConfig.pathHealthCheck,
        interval: cdk.Duration.minutes(+buildConfig.intervalHealthCheck),
        healthyThresholdCount: +buildConfig.healthyThresholdCount,
        unhealthyThresholdCount: +buildConfig.unhealthyThresholdCount,
        healthyHttpCodes: buildConfig.healthyHttpCodes
      },
      targetGroupName: `${appFullName}`
    });
    Tags.of(targetGroup).add("Name",`${appFullName}`)

    // Create ASG
    const scaling = service.autoScaleTaskCount({ maxCapacity: 10, minCapacity: 1 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: +buildConfig.targetUtilizationPercent
    });
    Tags.of(scaling).add("Name",`${appFullName}-asg`)

  }
}
