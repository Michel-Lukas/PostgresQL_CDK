import * as AWS from 'aws-sdk';
import { Client } from 'pg';

export const handler = async (event: any): Promise<any> => {
    try {
        const host = process.env.DB_ENDPOINT_ADDRESS || '';

        const database = process.env.DB_NAME || '';

        const dbSecretArn = process.env.DB_SECRET_ARN || '';

        const secretManager = new AWS.SecretsManager({
            region: 'eu-central-1',
        });

        const secretParams: AWS.SecretsManager.GetSecretValueRequest = {
            SecretId: dbSecretArn,
        };

        const dbSecret = await secretManager.getSecretValue(secretParams).promise();
        const secretString = dbSecret.SecretString || '';

        if (!secretString) {
            throw new Error('secret string is empty');
        }

        const { password } = JSON.parse(secretString);

        const client = new Client({
            user: 'postgres',
            host,
            database,
            password,
            port: 5432,
        });
        await client.connect();
        console.log("Connected to Client")


        const result = await client.query(` SELECT * FROM users `);

        await client.end();

        return {
            statusCode: 200,
            body: JSON.stringify(result.rows)
        }
    } catch (err) {
        console.log('error while trying to connect to db' + err);
    }
};