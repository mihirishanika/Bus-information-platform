// Shared static route dataset (demo only)
export const routes = [
	{ id: 'R-001', code: '100', from: 'Colombo', to: 'Kandy', type: 'luxury', verified: true, popular: true, headwayMins: 45 },
	{ id: 'R-002', code: '101', from: 'Colombo', to: 'Galle', type: 'semi', verified: true, popular: true, headwayMins: 60 },
	{ id: 'R-003', code: '102', from: 'Kandy', to: 'Jaffna', type: 'normal', verified: false, popular: false, headwayMins: 120 },
	{ id: 'R-004', code: '103', from: 'Colombo', to: 'Matara', type: 'luxury', verified: true, popular: true, headwayMins: 55 },
	{ id: 'R-005', code: '104', from: 'Kurunegala', to: 'Colombo', type: 'normal', verified: true, popular: false, headwayMins: 40 }
];

export function computeNextDeparture(route) {
	// Service window 05:00 to 23:00
	const startMinutes = 5 * 60; // 300
	const endMinutes = 23 * 60; // 1380
	const now = new Date();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	if (currentMinutes < startMinutes) {
		return { nextTime: minutesToTime(startMinutes), minutesUntil: startMinutes - currentMinutes };
	}
	if (currentMinutes > endMinutes) {
		return { nextTime: null, minutesUntil: null, ended: true };
	}
	const intervalsSinceStart = Math.floor((currentMinutes - startMinutes) / route.headwayMins);
	let nextMinutes = startMinutes + (intervalsSinceStart + 1) * route.headwayMins;
	if (nextMinutes > endMinutes) {
		return { nextTime: null, minutesUntil: null, ended: true };
	}
	return { nextTime: minutesToTime(nextMinutes), minutesUntil: nextMinutes - currentMinutes };
}

function minutesToTime(total) {
	const h = Math.floor(total / 60).toString().padStart(2, '0');
	const m = (total % 60).toString().padStart(2, '0');
	return `${h}:${m}`;
}
