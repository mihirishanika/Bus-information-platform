// Test script to verify directional search functionality
const API_BASE = 'http://localhost:4000';

async function testDirectionalSearch() {
    console.log('Testing directional search functionality...\n');

    // Test 1: Search "ja ela to kandy" - should return normal journey times
    console.log('Test 1: Search "ja ela to kandy"');
    try {
        const response1 = await fetch(`${API_BASE}/search?q=ja ela to kandy`);
        const data1 = await response1.json();
        console.log('Response:', JSON.stringify(data1, null, 2));
        console.log('Found buses:', data1.buses?.length || 0);
        if (data1.buses && data1.buses.length > 0) {
            const bus = data1.buses[0];
            console.log('First bus journeys:', bus.relevantJourneys || bus.journeys);
            console.log('Direction:', bus.direction);
        }
        console.log('');
    } catch (error) {
        console.error('Test 1 failed:', error.message);
    }

    // Test 2: Search "kandy to ja ela" - should return return journey times
    console.log('Test 2: Search "kandy to ja ela"');
    try {
        const response2 = await fetch(`${API_BASE}/search?q=kandy to ja ela`);
        const data2 = await response2.json();
        console.log('Response:', JSON.stringify(data2, null, 2));
        console.log('Found buses:', data2.buses?.length || 0);
        if (data2.buses && data2.buses.length > 0) {
            const bus = data2.buses[0];
            console.log('First bus journeys:', bus.relevantJourneys || bus.journeys);
            console.log('Direction:', bus.direction);
        }
        console.log('');
    } catch (error) {
        console.error('Test 2 failed:', error.message);
    }

    // Test 3: Direct API call to directional search
    console.log('Test 3: Direct directional search API call (ja ela to kandy)');
    try {
        const response3 = await fetch(`${API_BASE}/search?directional=true&from=ja ela&to=kandy`);
        const data3 = await response3.json();
        console.log('Response:', JSON.stringify(data3, null, 2));
        console.log('Found buses:', data3.buses?.length || 0);
        if (data3.buses && data3.buses.length > 0) {
            const bus = data3.buses[0];
            console.log('First bus journeys:', bus.relevantJourneys || bus.journeys);
            console.log('Direction:', bus.direction);
        }
        console.log('');
    } catch (error) {
        console.error('Test 3 failed:', error.message);
    }

    // Test 4: Direct API call to directional search (reverse direction)
    console.log('Test 4: Direct directional search API call (kandy to ja ela)');
    try {
        const response4 = await fetch(`${API_BASE}/search?directional=true&from=kandy&to=ja ela`);
        const data4 = await response4.json();
        console.log('Response:', JSON.stringify(data4, null, 2));
        console.log('Found buses:', data4.buses?.length || 0);
        if (data4.buses && data4.buses.length > 0) {
            const bus = data4.buses[0];
            console.log('First bus journeys:', bus.relevantJourneys || bus.journeys);
            console.log('Direction:', bus.direction);
        }
        console.log('');
    } catch (error) {
        console.error('Test 4 failed:', error.message);
    }
}

// Run the test
testDirectionalSearch().catch(console.error);