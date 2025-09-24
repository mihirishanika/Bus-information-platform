import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const tableName = process.env.BUS_TABLE_NAME;

const corsHeaders = {
	'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
	'Access-Control-Allow-Headers': 'Content-Type,Authorization',
	'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
	console.log('GetRoutes event:', JSON.stringify(event, null, 2));

	try {
		if (event.httpMethod === 'OPTIONS') {
			return {
				statusCode: 200,
				headers: corsHeaders,
				body: JSON.stringify({ message: 'CORS preflight' })
			};
		}

		// Scan the bus table and transform to legacy routes format
		const params = {
			TableName: tableName,
			Limit: 50
		};

		const result = await dynamoDB.send(new ScanCommand(params));
		const buses = result.Items || [];

		// Transform buses to legacy routes format for compatibility
		const routes = buses.map(bus => ({
			id: bus.id || bus.licenseNo,
			code: bus.busNumber || bus.licenseNo,
			name: bus.route || `${bus.from} → ${bus.to}`,
			from: bus.from,
			to: bus.to,
			type: bus.busType || 'normal',
			verified: (bus.verifiedVotes || 0) >= 3,
			popular: (bus.verifiedVotes || 0) >= 2,
			headwayMins: 15, // Default headway
			dailyDepartures: (bus.journeys?.length || 0) + (bus.returnJourneys?.length || 0) || bus.dailyDepartures || 0
		}));

		return {
			statusCode: 200,
			headers: corsHeaders,
			body: JSON.stringify({
				routes,
				count: routes.length
			})
		};

	} catch (error) {
		console.error('GetRoutes error:', error);
		return {
			statusCode: 500,
			headers: corsHeaders,
			body: JSON.stringify({
				error: 'Internal server error',
				message: error.message
			})
		};
	}
};