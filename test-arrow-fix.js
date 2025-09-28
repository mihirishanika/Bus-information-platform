#!/usr/bin/env node

// Comprehensive test to verify the arrow format fix

const API_BASE = 'http://localhost:4000';

async function testAllFormats() {
    console.log('🔧 Testing Arrow Format Fix');
    console.log('===========================\n');

    const testCases = [
        { query: 'Jaffna to Colombo', description: 'Standard "to" format' },
        { query: 'Jaffna → Colombo', description: 'Arrow format (→)' },
        { query: 'Jaffna -> Colombo', description: 'ASCII arrow format (->)' },
        { query: 'Colombo to Jaffna', description: 'Reverse "to" format' },
        { query: 'Colombo → Jaffna', description: 'Reverse arrow format (→)' }
    ];

    for (const testCase of testCases) {
        console.log(`🧪 Testing: ${testCase.description}`);
        console.log(`   Query: "${testCase.query}"`);

        try {
            const encodedQuery = encodeURIComponent(testCase.query);
            const response = await fetch(`${API_BASE}/search?q=${encodedQuery}`);
            const data = await response.json();

            if (data.buses && data.buses.length > 0) {
                console.log(`   ✅ Found ${data.buses.length} bus(es)`);
                console.log(`   📍 Direction: ${data.directional ? 'Directional' : 'General'} search`);
                if (data.buses[0]) {
                    console.log(`   🚌 First bus: ${data.buses[0].name || data.buses[0].companyName} (${data.buses[0].busNumber})`);
                    if (data.buses[0].direction) {
                        console.log(`   ↔️  Journey type: ${data.buses[0].direction}`);
                    }
                }
            } else {
                console.log('   ❌ No buses found');
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        console.log('');
    }

    console.log('🎯 Expected Behavior:');
    console.log('====================');
    console.log('✅ All formats (to, →, ->) should work');
    console.log('✅ Jaffna → Colombo should show return journey times');
    console.log('✅ Colombo → Jaffna should show forward journey times');
    console.log('✅ All should be marked as directional searches');
}

testAllFormats().catch(console.error);