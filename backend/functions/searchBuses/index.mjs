import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const tableName = process.env.BUS_TABLE_NAME;

const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
    console.log('SearchBuses event:', JSON.stringify(event, null, 2));

    try {
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'CORS preflight' })
            };
        }

        const queryParams = event.queryStringParameters || {};
        const query = queryParams.q ? queryParams.q.trim() : '';
        const busType = queryParams.type;
        const verifiedOnly = queryParams.verified === 'true';
        const companyName = queryParams.company;
        const route = queryParams.route;

        // Start with empty results
        let allBuses = [];

        // Try different search strategies based on what's provided
        if (companyName && companyName !== 'all') {
            // Search by company using GSI
            allBuses = await searchByCompany(companyName);
        } else if (route) {
            // Search by route using GSI
            allBuses = await searchByRoute(route);
        } else if (busType && busType !== 'all') {
            // Search by bus type using GSI
            allBuses = await searchByType(busType);
        } else {
            // Full scan for general search
            allBuses = await getAllBuses();
        }

        // Apply text-based filtering if query is provided
        if (query) {
            const searchTerms = query.toLowerCase();
            allBuses = allBuses.filter(bus => {
                const searchableText = [
                    bus.busNumber || '',
                    bus.licenseNo || '',
                    bus.companyName || '',
                    bus.from || '',
                    bus.to || '',
                    bus.route || '',
                    (bus.stops || []).join(' '),
                    bus.busType || ''
                ].join(' ').toLowerCase();

                return searchableText.includes(searchTerms);
            });
        }

        // Apply additional filters
        if (busType && busType !== 'all') {
            allBuses = allBuses.filter(bus => bus.busType === busType);
        }

        if (verifiedOnly) {
            allBuses = allBuses.filter(bus => (bus.verifiedVotes || 0) >= 3);
        }

        // Transform for frontend compatibility and add computed fields
        const buses = allBuses.slice(0, 50).map(bus => ({
            ...bus,
            id: bus.id || bus.licenseNo,
            dailyDepartures: bus.journeys?.length || bus.dailyDepartures || 0,
            verified: (bus.verifiedVotes || 0) >= 3,
            code: bus.busNumber || bus.licenseNo,
            name: bus.route || `${bus.from} → ${bus.to}`,
            type: bus.busType || 'normal'
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                buses,
                count: buses.length,
                totalFound: allBuses.length,
                query: query,
                filters: {
                    type: busType,
                    verifiedOnly,
                    company: companyName,
                    route: route
                }
            })
        };

    } catch (error) {
        console.error('Search buses error:', error);
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

// Helper function to get all buses (scan)
async function getAllBuses() {
    try {
        const params = {
            TableName: tableName,
            Limit: 100
        };

        const result = await dynamoDB.send(new ScanCommand(params));
        return result.Items || [];
    } catch (error) {
        console.error('Error scanning all buses:', error);
        return [];
    }
}

// Helper function to search by company name using GSI
async function searchByCompany(companyName) {
    try {
        const params = {
            TableName: tableName,
            IndexName: 'CompanyIndex',
            KeyConditionExpression: 'companyName = :companyName',
            ExpressionAttributeValues: {
                ':companyName': companyName
            },
            Limit: 50
        };

        const result = await dynamoDB.send(new QueryCommand(params));
        return result.Items || [];
    } catch (error) {
        console.error('Error searching by company:', error);
        // Fallback to scan if GSI query fails
        return await getAllBuses();
    }
}

// Helper function to search by route using GSI
async function searchByRoute(route) {
    try {
        const params = {
            TableName: tableName,
            IndexName: 'RouteIndex',
            KeyConditionExpression: 'route = :route',
            ExpressionAttributeValues: {
                ':route': route
            },
            Limit: 50
        };

        const result = await dynamoDB.send(new QueryCommand(params));
        return result.Items || [];
    } catch (error) {
        console.error('Error searching by route:', error);
        // Fallback to scan if GSI query fails
        return await getAllBuses();
    }
}

// Helper function to search by bus type using GSI
async function searchByType(busType) {
    try {
        const params = {
            TableName: tableName,
            IndexName: 'TypeIndex',
            KeyConditionExpression: 'busType = :busType',
            ExpressionAttributeValues: {
                ':busType': busType
            },
            Limit: 50
        };

        const result = await dynamoDB.send(new QueryCommand(params));
        return result.Items || [];
    } catch (error) {
        console.error('Error searching by type:', error);
        // Fallback to scan if GSI query fails
        return await getAllBuses();
    }
}