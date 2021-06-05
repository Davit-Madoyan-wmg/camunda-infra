export interface BuildConfig
{
  readonly AWSProfileRegion : string;
  readonly Project: string;
  readonly App : string;
  readonly Environment : string;
  readonly Cidr : string;
  readonly DbName : string;
  readonly DbUser : string;
  readonly DbInstType : string;
  readonly DbInstClass: string;
}
