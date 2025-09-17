import { routes, computeNextDeparture } from '../sharedData.js';

export const handler = async (event) => {
	const params = event?.queryStringParameters || {};
	const code = (params.route || params.code || '').trim();
	if (!code) {
		return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing route query parameter ?route=CODE' }) };
	}
	const route = routes.find(r => r.code === code || r.id === code);
	if (!route) {
		return { statusCode: 404, headers: cors(), body: JSON.stringify({ error: 'Route not found' }) };
	}
	const next = computeNextDeparture(route);
	return {
		statusCode: 200,
		headers: cors(),
		body: JSON.stringify({ route: { code: route.code, from: route.from, to: route.to, headwayMins: route.headwayMins }, next })
	};
};

function cors() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET,OPTIONS'
	};
}
