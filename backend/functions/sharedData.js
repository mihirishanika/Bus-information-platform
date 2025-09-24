// Shared static route dataset (demo only)
export const routes = [
	// Routes should be populated from the database in production
	// This is kept empty to avoid hardcoded data
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
