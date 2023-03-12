import * as AWS from 'aws-sdk';
import { Client } from 'pg';

export const handler = async (): Promise<any> => {
    try {
        const host = process.env.DB_ENDPOINT_ADDRESS || '';
        console.log(`host:${host}`);
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

        await client.query(`
            INSERT INTO users (name, email)
                VALUES ('John Doe', 'John.Doe@email.com'),
                       ('Jane Doe', 'Jane.Doe@emailc.om');
            `);
        console.log("Query executed")

        await client.end();

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Successfully created new user"
            })
        }
    } catch (err) {
        console.log('error while trying to connect to db' + err);
    }
};