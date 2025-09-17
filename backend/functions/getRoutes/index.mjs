import { routes } from '../sharedData.js';

export const handler = async () => {
	return {
		statusCode: 200,
		headers: cors(),
		body: JSON.stringify({ routes })
	};
};

function cors() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET,OPTIONS'
	};
}
