#!/usr/bin/env node

/**
 * Database verification script
 * This script helps verify if bus images are actually saved in the database
 */

const https = require('https');
const fs = require('fs');

// Configuration - update these based on your environment
const CONFIG = {
    API_BASE: process.env.API_BASE || 'http://localhost:3000/api', // Update with your API endpoint
    // If testing with deployed API, use: https://your-api-gateway-url.amazonaws.com/Prod
};

async function makeApiCall(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, CONFIG.API_BASE);
        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const lib = url.protocol === 'https:' ? https : require('http');

        const req = lib.request(url, requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function testImagePersistence() {
    console.log('🔍 TESTING: Bus Image Persistence in Database\n');

    try {
        // First, list existing buses to see current state
        console.log('📋 Fetching existing buses...');
        const listResponse = await makeApiCall('/buses');

        if (listResponse.status === 200) {
            const buses = listResponse.data.buses || [];
            console.log(`✅ Found ${buses.length} buses in database`);

            // Check which buses have photos
            const busesWithPhotos = buses.filter(bus => bus.photos && bus.photos.length > 0);
            console.log(`📸 Buses with photos: ${busesWithPhotos.length}`);

            if (busesWithPhotos.length > 0) {
                console.log('\n🖼️  BUSES WITH IMAGES:');
                busesWithPhotos.forEach((bus, index) => {
                    console.log(`\n   ${index + 1}. ${bus.companyName || 'Unknown'} (${bus.licenseNo})`);
                    console.log(`      Route: ${bus.from} → ${bus.to}`);
                    console.log(`      Photos: ${bus.photos.length}`);

                    bus.photos.forEach((photo, photoIndex) => {
                        const sizeKB = Math.round(photo.data.length / 1024);
                        console.log(`         ${photoIndex + 1}. ${photo.name} (${sizeKB}KB)`);
                    });

                    // Calculate total size
                    const totalSize = bus.photos.reduce((sum, p) => sum + p.data.length, 0);
                    const totalSizeKB = Math.round(totalSize / 1024);
                    console.log(`      Total image size: ${totalSizeKB}KB`);

                    if (totalSizeKB > 400) {
                        console.log(`      ⚠️  WARNING: Exceeds DynamoDB limits!`);
                    }
                });
            } else {
                console.log('\n📭 No buses with images found in database');
                console.log('   This could mean:');
                console.log('   1. No buses with images have been added yet');
                console.log('   2. Images are being stripped during save');
                console.log('   3. Database save is failing for image-containing buses');
            }

        } else {
            console.log(`❌ Failed to fetch buses: ${listResponse.status}`);
            console.log(`   Response: ${JSON.stringify(listResponse.data)}`);
        }

    } catch (error) {
        console.log(`❌ Error testing database: ${error.message}`);
        console.log('   Check if your backend is running and accessible');
    }
}

async function createTestBusWithImages() {
    console.log('\n🧪 TESTING: Creating a test bus with images\n');

    // Create a small test image (to stay within limits)
    const smallTestImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    const testBus = {
        busNumber: `TEST-VERIFY-${Date.now()}`,
        licenseNo: `TEST-VERIFY-${Date.now()}`,
        companyName: 'Test Verification Bus Co',
        from: 'Test City A',
        to: 'Test City B',
        route: 'Test City A → Test City B',
        busType: 'normal',
        seatCount: 30,
        year: 2023,
        photos: [
            {
                name: 'test-image.jpg',
                data: smallTestImage
            }
        ],
        createdAt: new Date().toISOString()
    };

    console.log('📤 Attempting to create test bus with image...');
    console.log(`   License: ${testBus.licenseNo}`);
    console.log(`   Photos: ${testBus.photos.length}`);
    console.log(`   Image size: ${Math.round(smallTestImage.length / 1024)}KB`);

    try {
        const createResponse = await makeApiCall('/buses', {
            method: 'POST',
            body: testBus,
            headers: {
                // Note: This will fail without proper authentication
                // You may need to add Authorization header for real testing
            }
        });

        if (createResponse.status === 201 || createResponse.status === 200) {
            console.log('✅ Test bus created successfully!');
            console.log('   The API accepted the bus with image data');

            // Try to retrieve it back to verify persistence
            console.log('\n🔍 Verifying bus was saved with images...');
            const getResponse = await makeApiCall(`/buses/${testBus.licenseNo}`);

            if (getResponse.status === 200) {
                const retrievedBus = getResponse.data;
                if (retrievedBus.photos && retrievedBus.photos.length > 0) {
                    console.log('✅ SUCCESS: Bus retrieved with images intact!');
                    console.log(`   Retrieved photos: ${retrievedBus.photos.length}`);
                    console.log(`   Image data preserved: ${retrievedBus.photos[0].data.length > 0 ? 'YES' : 'NO'}`);
                    return true;
                } else {
                    console.log('❌ PROBLEM: Bus saved but images missing');
                    console.log('   This indicates images are being stripped during save');
                    return false;
                }
            } else {
                console.log(`⚠️  Could not retrieve bus: ${getResponse.status}`);
                return false;
            }

        } else {
            console.log(`❌ Failed to create test bus: ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data)}`);

            if (createResponse.status === 401) {
                console.log('   Note: Authentication required for creating buses');
            }

            return false;
        }

    } catch (error) {
        console.log(`❌ Error creating test bus: ${error.message}`);
        return false;
    }
}

async function runVerification() {
    console.log('🚌 BUS IMAGE DATABASE VERIFICATION\n');
    console.log(`🌐 API Base: ${CONFIG.API_BASE}\n`);

    // Check current database state
    await testImagePersistence();

    // Try to create a test bus (may require authentication)
    console.log('\n' + '='.repeat(60));
    await createTestBusWithImages();

    console.log('\n📋 VERIFICATION SUMMARY:');
    console.log('1. Check the results above');
    console.log('2. If authentication is required, test via the frontend');
    console.log('3. Check CloudWatch logs for any DynamoDB errors');
    console.log('4. Monitor payload sizes when adding real images');

    console.log('\n💡 RECOMMENDED NEXT STEPS:');
    console.log('• Add image compression to AddBus.jsx');
    console.log('• Implement size validation before upload');
    console.log('• Consider S3 storage for larger images');
    console.log('• Add backend payload size validation');
}

// Command line argument handling
const args = process.argv.slice(2);
if (args.includes('--api-base') && args[args.indexOf('--api-base') + 1]) {
    CONFIG.API_BASE = args[args.indexOf('--api-base') + 1];
}

if (require.main === module) {
    runVerification().catch(console.error);
}

module.exports = {
    testImagePersistence,
    createTestBusWithImages,
    makeApiCall
};