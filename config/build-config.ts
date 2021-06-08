import {ListBucketsCommandOutput} from "@aws-sdk/client-s3";
import {GetCallerIdentityCommandOutput} from "@aws-sdk/client-sts";

export interface RuntimeProps {
    bucketList: ListBucketsCommandOutput;
    callerIdentity: GetCallerIdentityCommandOutput;
    deploymentTarget?: 'dev' | 'qa' | 'uat' | 'prod';
}

export interface BuildConfig {
    readonly AWSProfileRegion: string;
    readonly Project: string;
    readonly App: string;
    readonly Environment: string;
    readonly Cidr: string;
    readonly enableDnsSupport: string;
    readonly natGateways: string;
    readonly enableDnsHostnames: string;
    readonly maxAzs: string;
    readonly allowAllOutboundSGAccess: string;
    readonly allowAllOutboundSG: string;
    readonly fargateMemoryLimitMiB: string;
    readonly fargateCpu: string;
    readonly fargateImage: string;
    readonly fargateContainerPort: string;
    readonly fargateLogRetention: string;
    readonly allowAllOutboundAlbSG: string;
    readonly ingressPortAlbSG: string;
    readonly allowAllOutboundServiceSG: string;
    readonly ingressPortServiceSG: string;
    readonly desiredCountservice: string;
    readonly internetFacinglb: string;
    readonly portListener: string;
    readonly portTargetGroup: string;
    readonly pathHealthCheck: string;
    readonly intervalHealthCheck: string;
    readonly healthyThresholdCount: string;
    readonly unhealthyThresholdCount: string;
    readonly healthyHttpCodes: string;
    readonly targetUtilizationPercent: string;
    readonly ASGmaxCapacity: string;
    readonly ASGminCapacity: string;
    readonly DatabaseInstanceEngineFullVersion: string;
    readonly DatabaseInstanceEngineMajorVersion: string;
    readonly DbName: string;
    readonly DbUser: string;
    readonly DbInstType: string;
    readonly DbInstClass: string;
}
