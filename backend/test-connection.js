// backend/test-connection.js
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

const {
    AWS_REGION = "us-east-1",
    BUS_TABLE_NAME = "businfo-backend-buses"
} = process.env;

AWS.config.update({ region: AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function testConnection() {
    console.log('Testing DynamoDB connection...');
    console.log('Region:', AWS_REGION);
    console.log('Table:', BUS_TABLE_NAME);

    try {
        // Test 1: Describe table
        console.log('\n1. Checking table structure...');
        const ddb = new AWS.DynamoDB();
        const tableInfo = await ddb.describeTable({ TableName: BUS_TABLE_NAME }).promise();
        console.log('Table status:', tableInfo.Table.TableStatus);
        console.log('Primary key:', tableInfo.Table.KeySchema);
        console.log('Attributes:', tableInfo.Table.AttributeDefinitions);

        // Test 2: Scan existing items
        console.log('\n2. Scanning existing items...');
        const scanResult = await dynamoDB.scan({
            TableName: BUS_TABLE_NAME,
            Limit: 5
        }).promise();
        console.log('Existing items:', scanResult.Count);
        if (scanResult.Items && scanResult.Items.length > 0) {
            console.log('Sample item:', JSON.stringify(scanResult.Items[0], null, 2));
        }

        // Test 3: Insert test bus
        console.log('\n3. Testing insert...');
        const testBus = {
            licenseNo: `TEST-${Date.now()}`,
            busNumber: `TEST-${Date.now()}`,
            companyName: 'Test Transport Company',
            from: 'Test City A',
            to: 'Test City B',
            busType: 'normal',
            route: 'Test City A → Test City B',
            seatCount: 45,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            verifiedVotes: 0,
            id: `bus_test_${Date.now()}`
        };

        await dynamoDB.put({
            TableName: BUS_TABLE_NAME,
            Item: testBus
        }).promise();

        console.log('✅ Test bus inserted successfully');

        // Test 4: Read it back
        console.log('\n4. Reading test bus back...');
        const getResult = await dynamoDB.get({
            TableName: BUS_TABLE_NAME,
            Key: { licenseNo: testBus.licenseNo }
        }).promise();

        if (getResult.Item) {
            console.log('✅ Test bus retrieved successfully');
        } else {
            console.log('❌ Test bus not found');
        }

        // Test 5: Clean up
        console.log('\n5. Cleaning up...');
        await dynamoDB.delete({
            TableName: BUS_TABLE_NAME,
            Key: { licenseNo: testBus.licenseNo }
        }).promise();

        console.log('✅ Test bus deleted successfully');
        console.log('\n🎉 All tests passed! Your DynamoDB connection is working.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

testConnection();