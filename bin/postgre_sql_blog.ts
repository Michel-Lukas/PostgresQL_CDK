#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PostgreSqlBlogStack } from '../lib/postgre_sql_blog-stack';

const app = new cdk.App();
new PostgreSqlBlogStack(app, 'PostgreSqlBlogStack', {});