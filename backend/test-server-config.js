// Test server configuration
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

const {
    AWS_REGION = "ap-south-1",
    JWT_SECRET,
    BUS_TABLE_NAME,
    DYNAMODB_ENDPOINT,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY
} = process.env;

console.log('Configuration Check:');
console.log('===================');
console.log('AWS_REGION:', AWS_REGION);
console.log('JWT_SECRET:', JWT_SECRET ? 'SET' : 'NOT SET');
console.log('BUS_TABLE_NAME:', BUS_TABLE_NAME);
console.log('DYNAMODB_ENDPOINT:', DYNAMODB_ENDPOINT);
console.log('AWS_ACCESS_KEY_ID:', AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('AWS_SECRET_ACCESS_KEY:', AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');

// Test AWS configuration
AWS.config.update({ region: AWS_REGION });

function hasAwsCredentials() {
    try {
        const creds = AWS.config.credentials;
        if (!creds) return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
        if (typeof creds.expired === 'boolean') return true; // provider present
        return true;
    } catch { return false; }
}

const dynamoOptions = {};
if (DYNAMODB_ENDPOINT) {
    dynamoOptions.endpoint = DYNAMODB_ENDPOINT;
    // For DynamoDB Local, dummy credentials are fine
    if (!hasAwsCredentials()) {
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
        });
    }
}

const canUseDynamo = Boolean(BUS_TABLE_NAME && (hasAwsCredentials() || DYNAMODB_ENDPOINT));

console.log('\nAWS Check:');
console.log('==========');
console.log('hasAwsCredentials():', hasAwsCredentials());
console.log('canUseDynamo:', canUseDynamo);

if (canUseDynamo) {
    console.log('\nTesting DynamoDB connection...');
    const dynamoDB = new AWS.DynamoDB.DocumentClient(dynamoOptions);

    try {
        const result = await dynamoDB.scan({
            TableName: BUS_TABLE_NAME,
            Limit: 1
        }).promise();
        console.log('✅ DynamoDB connection successful');
        console.log('Items in table:', result.Items?.length || 0);
    } catch (error) {
        console.log('❌ DynamoDB connection failed:', error.message);
    }
} else {
    console.log('❌ DynamoDB not configured properly');
}