import * as AWS from 'aws-sdk';
import { Client } from 'pg';

export const handler = async (): Promise<any> => {
    try {
        // Get the database endpoint
        const host = process.env.DB_ENDPOINT_ADDRESS || '';
        console.log(`host:${host}`);

        // Get the database and ARN
        const database = process.env.DB_NAME || '';
        const dbSecretArn = process.env.DB_SECRET_ARN || '';

        // Create a Secrets Manager instance with YOUR region specified
        const secretManager = new AWS.SecretsManager({
            region: 'eu-central-1',
        });
        // Get the secret
        const secretParams: AWS.SecretsManager.GetSecretValueRequest = {
            SecretId: dbSecretArn,
        };
        const dbSecret = await secretManager.getSecretValue(secretParams).promise();
        const secretString = dbSecret.SecretString || '';

        if (!secretString) {
            throw new Error('secret string is empty');
        }

        const { password } = JSON.parse(secretString);

        // Connect a Postgres Client
        const client = new Client({
            user: 'postgres',
            host,
            database,
            password,
            port: 5432, // default port
        });
        await client.connect();
        console.log("Connected to Client")

        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE
            )
        `)

        await client.end();

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Successfully created new table"
            })
        }
    } catch (err) {
        console.log('error while trying to connect to db' + err);
    }
};