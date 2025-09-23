const corsHeaders = {
	'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
	'Access-Control-Allow-Headers': 'Content-Type,Authorization',
	'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
	console.log('GetNextBus event:', JSON.stringify(event, null, 2));

	try {
		if (event.httpMethod === 'OPTIONS') {
			return {
				statusCode: 200,
				headers: corsHeaders,
				body: JSON.stringify({ message: 'CORS preflight' })
			};
		}

		const queryParams = event.queryStringParameters || {};
		const route = queryParams.route || 'Unknown Route';

		// Mock next bus data for now
		// In a real implementation, this would query real-time bus tracking data
		const currentTime = new Date();
		const nextBuses = [
			{
				time: new Date(currentTime.getTime() + 10 * 60000).toLocaleTimeString('en-US', {
					hour12: false,
					hour: '2-digit',
					minute: '2-digit'
				}),
				type: 'Standard',
				fare: 120,
				minutesAway: 10
			},
			{
				time: new Date(currentTime.getTime() + 25 * 60000).toLocaleTimeString('en-US', {
					hour12: false,
					hour: '2-digit',
					minute: '2-digit'
				}),
				type: 'Semi Luxury',
				fare: 150,
				minutesAway: 25
			},
			{
				time: new Date(currentTime.getTime() + 40 * 60000).toLocaleTimeString('en-US', {
					hour12: false,
					hour: '2-digit',
					minute: '2-digit'
				}),
				type: 'Luxury AC',
				fare: 200,
				minutesAway: 40
			}
		];

		return {
			statusCode: 200,
			headers: corsHeaders,
			body: JSON.stringify({
				route,
				nextBuses,
				updated: currentTime.toISOString(),
				message: 'Mock data - replace with real-time bus tracking integration'
			})
		};

	} catch (error) {
		console.error('GetNextBus error:', error);
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