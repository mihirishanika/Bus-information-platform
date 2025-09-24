const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
    console.log('ProtectedPing event:', JSON.stringify(event, null, 2));

    try {
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'CORS preflight' })
            };
        }

        // Extract user info from Cognito JWT token in the request context
        const requestContext = event.requestContext || {};
        const authorizer = requestContext.authorizer || {};
        const claims = authorizer.claims || {};

        const userEmail = claims.email || claims['cognito:username'] || 'unknown';
        const userName = claims.name || claims.given_name || userEmail;

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Protected endpoint accessible - authentication successful!',
                user: {
                    email: userEmail,
                    name: userName,
                    sub: claims.sub
                },
                timestamp: new Date().toISOString(),
                requestId: requestContext.requestId
            })
        };

    } catch (error) {
        console.error('ProtectedPing error:', error);
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