import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  PostgresEngineVersion,
} from 'aws-cdk-lib/aws-rds';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"

export class PostgreSqlBlogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseName: string = "PostgreSQLDatabase"

    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'privateLambda',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const sg = new ec2.SecurityGroup(this, "MySG", {
      vpc,
    })

    const dbInstance = new rds.DatabaseInstance(this, "MyPostgresInstance", {
      databaseName,
      engine: rds.DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_13 }),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      maxAllocatedStorage: 200,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      securityGroups: [sg]
    })
  }
}
