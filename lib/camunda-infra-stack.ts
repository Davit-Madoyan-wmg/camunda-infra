import * as cdk from '@aws-cdk/core';
import {Tags} from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import {BuildConfig, RuntimeProps} from "../config/build-config";
import {Bucket} from '@aws-cdk/aws-s3';
import {Distribution as CloudfrontDistribution, LambdaEdgeEventType} from '@aws-cdk/aws-cloudfront';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {StringParameter} from '@aws-cdk/aws-ssm';
import {S3Origin} from '@aws-cdk/aws-cloudfront-origins';
import * as r53 from '@aws-cdk/aws-route53';
import * as acm from '@aws-cdk/aws-certificatemanager';

export class CamundaInfraStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, buildConfig: BuildConfig, runtimeProps: RuntimeProps, props?: cdk.StackProps) {
        super(scope, id, props);

        function convertStringToBool(boolStr: string): boolean {
            return (/true/i).test(boolStr)
        }

        // Destructuring "buildconfig"
        const {
            AWSProfileRegion,
            Project,
            App,
            Environment,
            Cidr,
            enableDnsSupport,
            natGateways,
            enableDnsHostnames,
            maxAzs,
            allowAllOutboundSGAccess,
            allowAllOutboundSG,
            fargateMemoryLimitMiB,
            fargateCpu,
            fargateImage,
            fargateContainerPort,
            fargateLogRetention,
            allowAllOutboundAlbSG,
            ingressPortAlbSG,
            allowAllOutboundServiceSG,
            ingressPortServiceSG,
            desiredCountservice,
            internetFacinglb,
            portListener,
            portTargetGroup,
            pathHealthCheck,
            intervalHealthCheck,
            healthyThresholdCount,
            unhealthyThresholdCount,
            healthyHttpCodes,
            targetUtilizationPercent,
            ASGmaxCapacity,
            ASGminCapacity,
            DatabaseInstanceEngineFullVersion,
            DatabaseInstanceEngineMajorVersion,
            DbName,
            DbUser,
            DbInstType,
            DbInstClass,
        } = buildConfig;

        const appFullName = `${Project}-${App}-${Environment}`

        const vpc = new ec2.Vpc(this, 'camundaVPC', {
            cidr: Cidr,
            enableDnsSupport: convertStringToBool(enableDnsSupport),
            natGateways: +natGateways,
            enableDnsHostnames: convertStringToBool(enableDnsHostnames),
            maxAzs: +maxAzs,
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
        Tags.of(vpc).add("Name", `${appFullName}-vpc`)

        // Bucket setup for web distribution bucket
        const {bucketList: {Buckets = []}, callerIdentity} = runtimeProps;
        const bucketId = `web-distribution-bucket-${Environment}`;
        const bucketName = `carpathia-wmg-${bucketId}-${callerIdentity.Account}`;

        const webDistributionBucket = Buckets.some((b: any) => b.Name === bucketName) ?
            Bucket.fromBucketName(this, bucketId, bucketName) :
            new Bucket(this, bucketId, {
                bucketName,
                publicReadAccess: true,
                websiteIndexDocument: 'index.html',
            });

        // Lambda@Edge
        /* -- This option is only needed if the stack is not deployed in us-east-1

        const lambdaEdge = new CloudfrontExperimental.EdgeFunction(this, 'lambda-edge', {
          code: Code.fromAsset(path.join(process.cwd(), 'src/lambda/')),
          runtime: Runtime.NODEJS_14_X,
          handler: 'cloudfront-edge.handler',
        });
        */
        const lambdaCloudfrontEdge = new NodejsFunction(this, 'lambda-edge', {
            entry: "src/lambda/cloudfront-edge.ts",
            // environment: {
            //   BUCKET_WEBSITE_ENDPOINT: webDistributionBucket.bucketWebsiteDomainName,
            // }
        });

        const domainName = 'dev.wmg.clients.productlab.dev';

        // Certificate
        const certificate = new acm.Certificate(this, 'ssl-certificate', {
            domainName,
        });

        // Route53 Hosted Zone
        const r53HostedZone = new r53.HostedZone(this, 'r53-hosted-zone', {
            zoneName: domainName,
        });


        // Cloudfront Distribution
        const cloudfrontDistributionId = `cloudfront-web-distribution-${Environment}`;
        const cloudfrontDistribution = new CloudfrontDistribution(this, cloudfrontDistributionId, {
            defaultBehavior: {
                origin: new S3Origin(webDistributionBucket),
                edgeLambdas: [
                    {
                        functionVersion: lambdaCloudfrontEdge.currentVersion,
                        eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                    }
                ]
            },
            certificate,
            domainNames: [domainName]
        });

        // Database Cluster
        // const postgres = new rds.DatabaseCluster(this, 'postgres-cluster', {
        //     engine: rds.DatabaseClusterEngine.auroraPostgres({
        //         version: rds.AuroraPostgresEngineVersion.VER_12_4,
        //     }),
        //     instanceProps: {
        //         vpc,
        //         vpcSubnets: {
        //             subnetType: ec2.SubnetType.PUBLIC,
        //         }
        //     },
        // });
        // postgres.connections.allowFromAnyIpv4(ec2.Port.allTcp());

        // SSM Params
        new StringParameter(this, `ssm-${bucketId}`, {
            parameterName: 'web-distribution-bucket-name',
            stringValue: bucketName,
        });
        new StringParameter(this, `ssm-cloudfront-domain-name`, {
            parameterName: 'cloudfront-distribution-domain-name',
            stringValue: cloudfrontDistribution.distributionDomainName,
        });
        // new StringParameter(this, 'ssm-postgres-creds-secret-arn', {
        //     parameterName: 'postgres-master-password-secret-arn',
        //     stringValue: postgres.secret!.secretArn,
        // })

        // Create an ECS cluster
        const cluster = new ecs.Cluster(this, 'camundaCluster', {
            vpc: vpc,
            clusterName: `${appFullName}-cluster`
        })
        Tags.of(cluster).add("Name", `${appFullName}-cluster`)

        // Create SG for RDS
        const postgresSGAccess = new ec2.SecurityGroup(this, `rds-security-group-access`, {
            vpc: vpc,
            allowAllOutbound: convertStringToBool(allowAllOutboundSGAccess),
            description: 'SG to access Postgres',
        });
        Tags.of(postgresSGAccess).add("Name", `${appFullName}-rds-access-sg`)

        const postgresSG = new ec2.SecurityGroup(this, `rds-security-group`, {
            vpc: vpc,
            allowAllOutbound: convertStringToBool(allowAllOutboundSG),
            description: 'SG to attach to Postgres'
        });
        postgresSG.connections.allowFrom(postgresSGAccess, ec2.Port.tcp(5432), 'Ingress postgres from postgresSGAccess');
        Tags.of(postgresSG).add("Name", `${appFullName}-rds-sg`)

        const secret = new rds.DatabaseSecret(this, 'Secret', {
            username: DbUser,
            secretName: `${appFullName}-dbsecret`
        });
        Tags.of(secret).add("Name", `${appFullName}-dbsecret`)

        // Create an RDS instance
        const rdsInstance = new rds.DatabaseInstance(this, 'CamundaInstance', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.of(
                    DatabaseInstanceEngineFullVersion,
                    DatabaseInstanceEngineMajorVersion
                )
            }),
            instanceType: new ec2.InstanceType(`${DbInstClass}.${DbInstType}`),
            vpc: vpc,
            vpcSubnets: {subnetType: ec2.SubnetType.ISOLATED},
            databaseName: DbName,
            credentials: rds.Credentials.fromSecret(secret),
            securityGroups: [postgresSG],
            instanceIdentifier: `${appFullName}-rds`
        })
        Tags.of(rdsInstance).add("Name", `${appFullName}-rds`)

        // Create a task definition
        const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'camundaTaskDef', {
            memoryLimitMiB: +fargateMemoryLimitMiB,
            cpu: +fargateCpu
        });

        // Add params to task definition
        fargateTaskDefinition.addContainer("camunda", {
            // Use an image from DockerHub
            image: ecs.ContainerImage.fromRegistry(fargateImage),
            portMappings: [{containerPort: +fargateContainerPort}],
            containerName: App,
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: `/aws/ecs/${appFullName}`,
                logRetention: +fargateLogRetention
            }),
            environment: {
                DB_DRIVER: "org.postgresql.Driver",
                DB_URL: "jdbc:postgresql://" + rdsInstance.instanceEndpoint.socketAddress + "/" + DbName
            },
            secrets: {
                DB_PASSWORD: ecs.Secret.fromSecretsManager(rdsInstance.secret!, 'password'),
                DB_USERNAME: ecs.Secret.fromSecretsManager(rdsInstance.secret!, 'username'),
            },
        });
        Tags.of(fargateTaskDefinition).add("Name", `${appFullName}-fargatetaskdefinition`)

        // Create SG for ALB
        const AlbSG = new ec2.SecurityGroup(this, `Alb-security-group`, {
            vpc: vpc,
            allowAllOutbound: convertStringToBool(allowAllOutboundAlbSG),
            description: 'SG for ALB'
        });
        AlbSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(+ingressPortAlbSG), 'HTTP ingress from anywhere');
        Tags.of(AlbSG).add("Name", `${appFullName}-alb-sg`)

        // Create SG for Service
        const ServiceSG = new ec2.SecurityGroup(this, `Alb-security-group-access`, {
            vpc: vpc,
            allowAllOutbound: convertStringToBool(allowAllOutboundServiceSG),
            description: 'SG for camunda service'
        });
        ServiceSG.connections.allowFrom(AlbSG, ec2.Port.tcp(+ingressPortServiceSG), 'Ingress from ALB sg');
        Tags.of(ServiceSG).add("Name", `${appFullName}-service-sg`)

        // Create service
        const service = new ecs.FargateService(this, 'camundaService', {
            cluster: cluster,
            taskDefinition: fargateTaskDefinition,
            desiredCount: +desiredCountservice,
            vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE},
            securityGroups: [postgresSGAccess, ServiceSG],
            serviceName: `${appFullName}-service`
        });
        Tags.of(service).add("Name", `${appFullName}-service`)

        // Create ALB
        const lb = new elbv2.ApplicationLoadBalancer(this, 'camundaLB', {
            vpc,
            internetFacing: convertStringToBool(internetFacinglb),
            securityGroup: AlbSG,
            loadBalancerName: `${appFullName}-lb`
        });
        Tags.of(lb).add("Name", `${appFullName}-lb`)

        //  Create listener
        const listener = lb.addListener('Listener', {port: +portListener});
        Tags.of(listener).add("Name", `${appFullName}-listener`)

        //  Create targetGroup
        const targetGroup = listener.addTargets('ECS', {
            port: +portTargetGroup,
            targets: [service],
            healthCheck: {
                path: pathHealthCheck,
                interval: cdk.Duration.minutes(+intervalHealthCheck),
                healthyThresholdCount: +healthyThresholdCount,
                unhealthyThresholdCount: +unhealthyThresholdCount,
                healthyHttpCodes: healthyHttpCodes
            },
            targetGroupName: `${appFullName}`
        });
        Tags.of(targetGroup).add("Name", `${appFullName}`)

        // Create ASG
        const scaling = service.autoScaleTaskCount({
            maxCapacity: +ASGmaxCapacity,
            minCapacity: +ASGminCapacity
        });
        scaling.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: +targetUtilizationPercent
        });
        Tags.of(scaling).add("Name", `${appFullName}-asg`)

    }
}
