export interface BuildConfig {
    readonly AWS_PROFILE_REGION: string;
    readonly ACCOUNT: string;
    readonly PROJECT: string;
    readonly APP: string;
    readonly ENVIRONMENT: string;
    readonly VPC: {
        readonly cidr: string;
        readonly enableDnsSupport: string;
        readonly natGateways: string;
        readonly enableDnsHostnames: string;
        readonly maxAzs: string;
    },
    readonly POSTGRES_SG_ACCESS: {
        readonly allowAllOutbound: string;
    },
    readonly POSTGRES_SG: {
        readonly allowAllOutbound: string;
    },
    readonly FARGATE: {
        readonly memoryLimitMiB: string;
        readonly cpu: string;
        readonly image: string;
        readonly containerPort: string;
        readonly logRetention: string;
    },
    readonly ALB_SG: {
        readonly allowAllOutbound: string;
        readonly ingressPort: string;
    },
    readonly SERVICE_SG: {
        readonly allowAllOutbound: string;
        readonly ingressPort: string;
    },
    readonly SERVICE: {
        readonly desiredCount: string;
    },
    readonly LOAD_BALANCER: {
        readonly internetFacing: string;
    },
    readonly LISTENER: {
        readonly port: string;
    },
    readonly TARGET_GROUP: {
        readonly port: string;
        readonly HealthCheck: {
            readonly path: string;
            readonly interval: string;
            readonly healthyThresholdCount: string;
            readonly unhealthyThresholdCount: string;
            readonly healthyHttpCodes: string;
        }
    },
    readonly AUTO_SCALING_GROUP: {
        readonly targetUtilizationPercent: string;
        readonly maxCapacity: string;
        readonly minCapacity: string;
    },
    readonly RDS: {
        readonly DatabaseInstanceEngineFullVersion: string;
        readonly DatabaseInstanceEngineMajorVersion: string;
        readonly InstanceClass: string;
        readonly InstanceType: string;
        readonly databaseName: string;
        readonly username: string;
    }
}
