import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  PostgresEngineVersion,
} from 'aws-cdk-lib/aws-rds';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Duration} from "aws-cdk-lib";
import * as path from "path";
import {Cors} from "aws-cdk-lib/aws-apigateway";

import * as apigw from "aws-cdk-lib/aws-apigateway"

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

    const lambdaSG = new ec2.SecurityGroup(this, "LambdaSG", {
      vpc
    })

    const dbProxy = new rds.DatabaseProxy(this, "PostgresProxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(dbInstance),
      secrets: [dbInstance.secret!],
      securityGroups: [sg],
      vpc,
      requireTLS: false,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      })
    })

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          "aws-sdk",
          "pg-native",
        ]
      },
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.minutes(3),
      memorySize: 256
    }

    const createLambdaFn = new NodejsFunction(this, "RDSLambdaFn", {
      entry: path.join(__dirname, "../lambda", "create-table.ts"),
      ...nodeJsFunctionProps,
      functionName: "createTableLambdaFn",
      environment: {
        DB_ENDPOINT_ADDRESS: dbProxy.endpoint,
        DB_NAME: databaseName,
        DB_SECRET_ARN: dbInstance.secret?.secretFullArn || "",
      },
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      securityGroups: [lambdaSG],
    })
    dbInstance.secret?.grantRead(createLambdaFn)

    const insertLambdaFn = new NodejsFunction(this, "insertLambdaFn", {
      entry: path.join(__dirname, "../lambda", "insert.ts"),
      ...nodeJsFunctionProps,
      functionName: "insertLambdaFn",
      environment: {
        DB_ENDPOINT_ADDRESS: dbProxy.endpoint,
        DB_NAME: databaseName,
        DB_SECRET_ARN: dbInstance.secret?.secretFullArn || "",
      },
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      securityGroups: [lambdaSG]
    })
    dbInstance.secret?.grantRead(insertLambdaFn)

    const selectLambdaFn = new NodejsFunction(this, "SelectLambdaFn", {
      entry: path.join(__dirname, "../lambda", "select.ts"),
      ...nodeJsFunctionProps,
      functionName: "selectLambdaFn",
      environment: {
        DB_ENDPOINT_ADDRESS: dbProxy.endpoint,
        DB_NAME: databaseName,
        DB_SECRET_ARN: dbInstance.secret?.secretFullArn || "",
      },
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      securityGroups: [lambdaSG]
    })
    dbInstance.secret?.grantRead(selectLambdaFn)

    sg.addIngressRule(lambdaSG, ec2.Port.tcp(5432), "Lambda to Postgres")

    const restApi = new apigw.RestApi(this, "DatabaseAPI", {
      restApiName: "databaseApiGateway",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS
      }
    })

    const rootApi = restApi.root.addResource("database")

    const createIntegration = new apigw.LambdaIntegration(createLambdaFn)
    const selectIntegration = new apigw.LambdaIntegration(selectLambdaFn)
    const insertIntegration = new apigw.LambdaIntegration(insertLambdaFn)

    rootApi.addMethod("GET", selectIntegration, {})
    rootApi.addMethod("POST", createIntegration, {})
    rootApi.addMethod("PUT", insertIntegration, {})
  }
}
