import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const tableName = process.env.BUS_TABLE_NAME;

const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
    console.log('Bus function event:', JSON.stringify(event, null, 2));

    try {
        const httpMethod = event.httpMethod;
        const pathParameters = event.pathParameters || {};
        const licenseNo = pathParameters.licenseNo;

        switch (httpMethod) {
            case 'OPTIONS':
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'CORS preflight' })
                };

            case 'POST':
                return await createBus(event);

            case 'GET':
                if (licenseNo) {
                    return await getBus(licenseNo);
                } else {
                    return await listBuses(event);
                }

            case 'PUT':
                return await updateBus(licenseNo, event);

            default:
                return {
                    statusCode: 405,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Bus function error:', error);
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

async function createBus(event) {
    try {
        const body = JSON.parse(event.body || '{}');
        const { busNumber, companyName, from, to } = body;

        if (!busNumber || !companyName || !from || !to) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required fields: busNumber, companyName, from, to'
                })
            };
        }

        // Create bus item with all provided data
        const busItem = {
            licenseNo: String(busNumber).trim(),
            busNumber: String(busNumber).trim(),
            companyName: String(companyName).trim(),
            from: String(from).trim(),
            to: String(to).trim(),
            route: `${from.trim()} → ${to.trim()}`,
            busType: body.busType || 'normal',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            verifiedVotes: 0,
            id: `bus_${busNumber.trim()}_${Date.now()}`,
            ...body
        };

        // Remove any null or undefined values
        Object.keys(busItem).forEach(key => {
            if (busItem[key] === null || busItem[key] === undefined) {
                delete busItem[key];
            }
        });

        const params = {
            TableName: tableName,
            Item: busItem,
            ConditionExpression: 'attribute_not_exists(licenseNo)'
        };

        await dynamoDB.send(new PutCommand(params));

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Bus created successfully',
                bus: busItem
            })
        };

    } catch (error) {
        console.error('Create bus error:', error);
        if (error.name === 'ConditionalCheckFailedException') {
            return {
                statusCode: 409,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Bus with this license number already exists' })
            };
        }
        throw error;
    }
}

async function getBus(licenseNo) {
    try {
        const params = {
            TableName: tableName,
            Key: { licenseNo: String(licenseNo) }
        };

        const result = await dynamoDB.send(new GetCommand(params));

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Bus not found' })
            };
        }

        // Add computed fields
        const bus = {
            ...result.Item,
            dailyDepartures: result.Item.journeys?.length || result.Item.dailyDepartures || 0,
            verified: (result.Item.verifiedVotes || 0) >= 3
        };

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(bus)
        };
    } catch (error) {
        console.error('Get bus error:', error);
        throw error;
    }
}

async function listBuses(event) {
    try {
        const queryParams = event.queryStringParameters || {};
        const limit = Math.min(parseInt(queryParams.limit) || 50, 100);

        const params = {
            TableName: tableName,
            Limit: limit
        };

        // Add pagination support
        if (queryParams.lastKey) {
            try {
                params.ExclusiveStartKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
            } catch (e) {
                console.warn('Invalid lastKey parameter:', e);
            }
        }

        const result = await dynamoDB.send(new ScanCommand(params));

        // Transform for frontend compatibility
        const buses = result.Items.map(bus => ({
            ...bus,
            dailyDepartures: bus.journeys?.length || bus.dailyDepartures || 0,
            verified: (bus.verifiedVotes || 0) >= 3
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                buses,
                count: buses.length,
                lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null
            })
        };
    } catch (error) {
        console.error('List buses error:', error);
        throw error;
    }
}

async function updateBus(licenseNo, event) {
    try {
        if (!licenseNo) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'License number is required' })
            };
        }

        const body = JSON.parse(event.body || '{}');

        // Check if bus exists first
        const getParams = {
            TableName: tableName,
            Key: { licenseNo: String(licenseNo) }
        };

        const existing = await dynamoDB.send(new GetCommand(getParams));
        if (!existing.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Bus not found' })
            };
        }

        // Handle special vote increment case
        if (body.verifiedVotes === 'increment') {
            const updateParams = {
                TableName: tableName,
                Key: { licenseNo: String(licenseNo) },
                UpdateExpression: 'ADD #votes :inc SET #updated = :updated',
                ExpressionAttributeNames: {
                    '#votes': 'verifiedVotes',
                    '#updated': 'updatedAt'
                },
                ExpressionAttributeValues: {
                    ':inc': 1,
                    ':updated': new Date().toISOString()
                },
                ReturnValues: 'ALL_NEW'
            };

            const result = await dynamoDB.send(new UpdateCommand(updateParams));
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: 'Vote recorded successfully',
                    bus: result.Attributes
                })
            };
        }

        // Regular update
        const updateParams = {
            TableName: tableName,
            Key: { licenseNo: String(licenseNo) },
            UpdateExpression: 'SET #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };

        // Build dynamic update expression for other fields
        const updateFields = [];
        Object.keys(body).forEach((key, index) => {
            if (key !== 'licenseNo' && body[key] !== undefined && body[key] !== null) {
                const attrName = `#attr${index}`;
                const attrValue = `:val${index}`;
                updateFields.push(`${attrName} = ${attrValue}`);
                updateParams.ExpressionAttributeNames[attrName] = key;
                updateParams.ExpressionAttributeValues[attrValue] = body[key];
            }
        });

        if (updateFields.length > 0) {
            updateParams.UpdateExpression += ', ' + updateFields.join(', ');
        }

        // Update route field if from/to changed
        if (body.from || body.to) {
            const newFrom = body.from || existing.Item.from;
            const newTo = body.to || existing.Item.to;
            const routeAttr = '#route';
            const routeVal = ':route';
            updateParams.ExpressionAttributeNames[routeAttr] = 'route';
            updateParams.ExpressionAttributeValues[routeVal] = `${newFrom} → ${newTo}`;
            updateParams.UpdateExpression += `, ${routeAttr} = ${routeVal}`;
        }

        const result = await dynamoDB.send(new UpdateCommand(updateParams));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Bus updated successfully',
                bus: result.Attributes
            })
        };

    } catch (error) {
        console.error('Update bus error:', error);
        throw error;
    }
}