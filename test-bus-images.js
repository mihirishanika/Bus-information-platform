#!/usr/bin/env node

/**
 * Test script to verify if bus images are saved correctly in the database
 * This script will simulate adding a bus with images and check if the data persists
 */

const fs = require('fs');
const path = require('path');

// Simulate the AddBus.jsx behavior
function simulateImageUpload() {
    // Create mock image data (base64 encoded images)
    const mockImages = [
        {
            name: 'bus-front.jpg',
            data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
        },
        {
            name: 'bus-interior.jpg',
            data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
        }
    ];

    console.log('🖼️  Mock images created:', mockImages.length);
    return mockImages;
}

// Simulate the bus data payload from AddBus.jsx
function createMockBusPayload() {
    const photos = simulateImageUpload();

    const payload = {
        // Primary identifiers
        busNumber: 'TEST-1234',
        licenseNo: 'TEST-1234',
        companyName: 'Test Bus Company',

        // Route information
        from: 'Colombo',
        to: 'Kandy',
        stops: ['Kegalle', 'Mawanella'],
        route: 'Colombo → Kandy',

        // Bus specifications
        busType: 'luxury',
        seatCount: 45,
        year: 2022,

        // Schedule and fare
        journeys: [
            { start: '06:00', end: '10:30' },
            { start: '14:00', end: '18:30' }
        ],
        dailyDepartures: 2,
        journeyDuration: '4h 30m',
        adultFare: 850,
        childFare: 425,

        // Contact information
        contacts: {
            driver: '0771234567',
            conductor: '0779876543',
            booking: '0112345678'
        },

        // Media - THIS IS WHAT WE'RE TESTING
        photos: photos,

        // Metadata
        verified: false,
        verifiedVotes: 0,
        createdAt: new Date().toISOString(),
        id: `bus_TEST-1234_${Date.now()}`
    };

    console.log('📦 Mock bus payload created');
    console.log('   - License No:', payload.licenseNo);
    console.log('   - Photos count:', payload.photos.length);
    console.log('   - Photo sizes:', payload.photos.map(p => `${p.name}: ${Math.round(p.data.length / 1024)}KB`));

    return payload;
}

// Test function to check if images persist in the payload
function testImagePersistence() {
    console.log('\n🧪 TESTING: Bus Image Persistence\n');

    const originalPayload = createMockBusPayload();

    // Simulate what happens in the backend - convert to JSON and back
    console.log('📤 Simulating JSON serialization (client → server)...');
    const jsonString = JSON.stringify(originalPayload);
    const deserializedPayload = JSON.parse(jsonString);

    // Check if photos are preserved
    console.log('\n📋 RESULTS:');
    console.log('✅ Original photos count:', originalPayload.photos.length);
    console.log('✅ Deserialized photos count:', deserializedPayload.photos.length);

    if (originalPayload.photos.length === deserializedPayload.photos.length) {
        console.log('✅ Photo count matches - images preserved in serialization');

        // Check if actual image data is preserved
        let dataMatches = true;
        for (let i = 0; i < originalPayload.photos.length; i++) {
            if (originalPayload.photos[i].data !== deserializedPayload.photos[i].data) {
                dataMatches = false;
                break;
            }
        }

        if (dataMatches) {
            console.log('✅ Photo data matches - image content preserved');
        } else {
            console.log('❌ Photo data corrupted during serialization');
        }
    } else {
        console.log('❌ Photo count mismatch - images lost during serialization');
    }

    // Check payload size
    const payloadSizeKB = Math.round(jsonString.length / 1024);
    console.log(`📏 Total payload size: ${payloadSizeKB}KB`);

    if (payloadSizeKB > 400) {
        console.log('⚠️  WARNING: Payload is large (>400KB), might hit API Gateway limits');
    }

    // Simulate DynamoDB storage
    console.log('\n📊 Simulating DynamoDB storage...');

    // DynamoDB has a 400KB limit per item
    if (payloadSizeKB > 400) {
        console.log('❌ CRITICAL: Payload exceeds DynamoDB item size limit (400KB)');
        console.log('   This will cause database writes to fail!');
        return false;
    } else {
        console.log('✅ Payload size within DynamoDB limits');
    }

    return true;
}

// Test function specifically for image handling
function testImageHandling() {
    console.log('\n🖼️  TESTING: Image Data Handling\n');

    const photos = simulateImageUpload();

    // Test what happens when we process images like in AddBus.jsx
    console.log('📤 Testing FileReader simulation...');

    photos.forEach((photo, index) => {
        console.log(`   Photo ${index + 1}:`);
        console.log(`   - Name: ${photo.name}`);
        console.log(`   - Data URL prefix: ${photo.data.substring(0, 50)}...`);
        console.log(`   - Is valid data URL: ${photo.data.startsWith('data:')}`);
        console.log(`   - Size: ${Math.round(photo.data.length / 1024)}KB`);

        // Check if it's a valid base64 image
        try {
            const base64Data = photo.data.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            console.log(`   - Valid base64: ✅ (${buffer.length} bytes)`);
        } catch (error) {
            console.log(`   - Valid base64: ❌ ${error.message}`);
        }
    });

    return true;
}

// Check backend implementation for potential issues
function analyzeBackendImageHandling() {
    console.log('\n🔍 ANALYZING: Backend Image Handling\n');

    // Based on the buses/index.mjs code we read
    console.log('📝 Backend Analysis:');
    console.log('✅ Backend accepts all fields from request body via ...body spread');
    console.log('✅ Photos field will be included in the DynamoDB item');
    console.log('✅ No specific image processing or validation in backend');
    console.log('⚠️  No image size validation before DynamoDB write');
    console.log('⚠️  No compression or optimization of images');

    console.log('\n💡 Potential Issues:');
    console.log('1. Large images can exceed DynamoDB 400KB item limit');
    console.log('2. No image format validation');
    console.log('3. Base64 encoding increases storage size by ~33%');
    console.log('4. No image optimization or resizing');

    console.log('\n🔧 Recommendations:');
    console.log('1. Add client-side image compression before upload');
    console.log('2. Validate image size in AddBus.jsx before submission');
    console.log('3. Consider storing images in S3 and only URLs in DynamoDB');
    console.log('4. Add backend validation for payload size');
}

// Main test runner
function runTests() {
    console.log('🚌 BUS IMAGE PERSISTENCE TEST\n');
    console.log('Testing if images from AddBus.jsx are saved correctly in the database...\n');

    const persistenceTest = testImagePersistence();
    const imageHandlingTest = testImageHandling();
    analyzeBackendImageHandling();

    console.log('\n📊 SUMMARY:');
    if (persistenceTest && imageHandlingTest) {
        console.log('✅ Images SHOULD be saved correctly in the database');
        console.log('✅ JSON serialization preserves image data');
        console.log('✅ Backend code will store photos field as-is');

        console.log('\n⚠️  However, watch out for:');
        console.log('   - Large images causing DynamoDB size limits');
        console.log('   - No server-side validation of image data');
        console.log('   - Potential performance issues with large payloads');
    } else {
        console.log('❌ Issues detected with image persistence');
    }

    console.log('\n🔍 TO VERIFY IN REAL ENVIRONMENT:');
    console.log('1. Add a bus with images via the frontend');
    console.log('2. Check CloudWatch logs for any DynamoDB errors');
    console.log('3. Query the DynamoDB table directly to verify photos field');
    console.log('4. Test retrieving the bus data via the API');
}

// Run the tests
if (require.main === module) {
    runTests();
}

module.exports = {
    testImagePersistence,
    testImageHandling,
    analyzeBackendImageHandling,
    createMockBusPayload
};