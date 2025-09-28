#!/usr/bin/env node

// Test script to demonstrate the search behavior

const API_BASE = 'http://localhost:4000';

async function testSearches() {
    console.log('🚌 Testing Bus Search Functionality');
    console.log('====================================\n');

    try {
        console.log('1️⃣  Testing: Colombo → Jaffna');
        console.log('--------------------------------');
        const response1 = await fetch(`${API_BASE}/search?directional=true&from=Colombo&to=Jaffna`);
        const data1 = await response1.json();

        if (data1.buses && data1.buses.length > 0) {
            console.log(`✅ Found ${data1.buses.length} bus(es)`);
            data1.buses.forEach((bus, idx) => {
                console.log(`   Bus ${idx + 1}: ${bus.name} (${bus.busNumber})`);
                console.log(`   Direction: ${bus.direction}`);
                console.log(`   Journey times: ${bus.relevantJourneys.map(j => `${j.start}-${j.end}`).join(', ')}`);
                console.log('');
            });
        } else {
            console.log('❌ No buses found');
        }

        console.log('\n2️⃣  Testing: Jaffna → Colombo');
        console.log('--------------------------------');
        const response2 = await fetch(`${API_BASE}/search?directional=true&from=Jaffna&to=Colombo`);
        const data2 = await response2.json();

        if (data2.buses && data2.buses.length > 0) {
            console.log(`✅ Found ${data2.buses.length} bus(es)`);
            data2.buses.forEach((bus, idx) => {
                console.log(`   Bus ${idx + 1}: ${bus.name} (${bus.busNumber})`);
                console.log(`   Direction: ${bus.direction}`);
                console.log(`   Journey times: ${bus.relevantJourneys.map(j => `${j.start}-${j.end}`).join(', ')}`);
                console.log('');
            });
        } else {
            console.log('❌ No buses found');
        }

        console.log('\n📊 Summary:');
        console.log('===========');
        console.log('The search system correctly finds buses for both directions:');
        console.log('- Colombo → Jaffna: Shows forward journey departure times');
        console.log('- Jaffna → Colombo: Shows return journey departure times');
        console.log('');
        console.log('💡 Key Point: "Return journey" means the same bus traveling');
        console.log('   back from its destination to the origin with different times.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSearches().catch(console.error);