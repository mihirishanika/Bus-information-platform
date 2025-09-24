// Debug script to test search logic
const from = 'Colombo';
const to = 'Jaffna';

const localBuses = [
    {
        licenseNo: 'NC-1234',
        busNumber: 'NC-1234',
        companyName: 'SuperLine Express',
        from: 'Colombo',
        to: 'Jaffna',
        route: 'Colombo → Jaffna',
        busType: 'luxury',
        seatCount: 45,
        year: 2020,
        journeys: [
            { start: '06:00', end: '12:30' },
            { start: '14:00', end: '20:30' },
            { start: '22:00', end: '04:30' }
        ],
        returnJourneys: [
            { start: '07:00', end: '13:30' },
            { start: '15:30', end: '22:00' },
            { start: '23:00', end: '05:30' }
        ],
        journeyDuration: '6h 30m',
        adultFare: 1200,
        childFare: 600,
        contacts: {
            driver: '0771234567',
            conductor: '0779876543',
            booking: '0112345678'
        },
        stops: ['Kurunegala', 'Anuradhapura', 'Vavuniya'],
        verifiedVotes: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: 'bus_NC-1234_1632465600000'
    }
];

let filteredBuses = localBuses.filter(bus => {
    const busFrom = (bus.from || '').toLowerCase().trim();
    const busTo = (bus.to || '').toLowerCase().trim();
    const searchFrom = from.toLowerCase().trim();
    const searchTo = to.toLowerCase().trim();

    // More flexible matching - check if search terms are contained in bus locations
    // Also handle common location variations
    const normalizeLocation = (loc) => {
        return loc.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/fort|central|main|bus\s*stand|station/g, '');
    };

    const normalizedBusFrom = normalizeLocation(busFrom);
    const normalizedBusTo = normalizeLocation(busTo);
    const normalizedSearchFrom = normalizeLocation(searchFrom);
    const normalizedSearchTo = normalizeLocation(searchTo);

    console.log('Bus from:', busFrom, '-> normalized:', normalizedBusFrom);
    console.log('Bus to:', busTo, '-> normalized:', normalizedBusTo);
    console.log('Search from:', searchFrom, '-> normalized:', normalizedSearchFrom);
    console.log('Search to:', searchTo, '-> normalized:', normalizedSearchTo);

    // Check both forward and return directions with flexible matching
    const isForwardMatch =
        (normalizedBusFrom.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusFrom)) &&
        (normalizedBusTo.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusTo));

    const isReturnMatch =
        (normalizedBusFrom.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusFrom)) &&
        (normalizedBusTo.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusTo));

    console.log('Forward match:', isForwardMatch);
    console.log('Return match:', isReturnMatch);

    return isForwardMatch || isReturnMatch;
});

console.log('Filtered buses:', filteredBuses.length);