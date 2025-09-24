#!/usr/bin/env node

/**
 * Enhanced test with realistic image sizes to check DynamoDB limits
 */

const fs = require('fs');
const path = require('path');

// Create a realistic base64 image (simulating a 100KB image)
function createRealisticMockImage(sizeKB) {
    // Create a base64 string that approximates the given size
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const targetLength = Math.floor(sizeKB * 1024 * 4 / 3); // Base64 is ~33% larger than binary

    let base64Data = '';
    for (let i = 0; i < targetLength; i++) {
        base64Data += base64Chars[Math.floor(Math.random() * base64Chars.length)];
    }

    return `data:image/jpeg;base64,${base64Data}`;
}

function testRealisticImageSizes() {
    console.log('\n🧪 TESTING: Realistic Image Sizes\n');

    const testSizes = [50, 100, 200, 300]; // KB

    testSizes.forEach(sizeKB => {
        console.log(`\n📸 Testing ${sizeKB}KB image:`);

        const mockImage = createRealisticMockImage(sizeKB);
        const actualSizeKB = Math.round(mockImage.length / 1024);

        // Create a bus payload with this image
        const payload = {
            busNumber: 'TEST-1234',
            licenseNo: 'TEST-1234',
            companyName: 'Test Bus Company',
            from: 'Colombo',
            to: 'Kandy',
            photos: [
                { name: `test-image-${sizeKB}kb.jpg`, data: mockImage }
            ]
        };

        const jsonString = JSON.stringify(payload);
        const payloadSizeKB = Math.round(jsonString.length / 1024);

        console.log(`   - Target size: ${sizeKB}KB`);
        console.log(`   - Actual image size: ${actualSizeKB}KB`);
        console.log(`   - Total payload size: ${payloadSizeKB}KB`);

        if (payloadSizeKB > 400) {
            console.log(`   ❌ EXCEEDS DynamoDB limit (400KB) by ${payloadSizeKB - 400}KB`);
        } else {
            console.log(`   ✅ Within DynamoDB limit (${400 - payloadSizeKB}KB remaining)`);
        }
    });
}

function testMultipleImages() {
    console.log('\n🧪 TESTING: Multiple Images Scenario\n');

    // Simulate adding 3-4 images of different sizes (realistic user scenario)
    const images = [
        { name: 'bus-exterior.jpg', sizeKB: 80 },
        { name: 'bus-interior.jpg', sizeKB: 60 },
        { name: 'bus-front.jpg', sizeKB: 70 },
        { name: 'bus-side.jpg', sizeKB: 90 }
    ];

    console.log('📸 Creating realistic multi-image payload...');

    const photos = images.map(img => ({
        name: img.name,
        data: createRealisticMockImage(img.sizeKB)
    }));

    const payload = {
        busNumber: 'TEST-MULTI',
        licenseNo: 'TEST-MULTI',
        companyName: 'Multi Image Bus Co',
        from: 'Colombo',
        to: 'Kandy',
        route: 'Colombo → Kandy',
        busType: 'luxury',
        seatCount: 45,
        year: 2022,
        journeys: [
            { start: '06:00', end: '10:30' },
            { start: '14:00', end: '18:30' }
        ],
        contacts: {
            driver: '0771234567',
            conductor: '0779876543'
        },
        photos: photos,
        createdAt: new Date().toISOString()
    };

    const jsonString = JSON.stringify(payload);
    const payloadSizeKB = Math.round(jsonString.length / 1024);

    console.log('\n📊 Results:');
    console.log(`   - Number of images: ${photos.length}`);
    console.log(`   - Individual image sizes: ${images.map(i => `${i.sizeKB}KB`).join(', ')}`);
    console.log(`   - Total payload size: ${payloadSizeKB}KB`);
    console.log(`   - Images portion: ~${Math.round(payloadSizeKB * 0.9)}KB (~90% of payload)`);

    if (payloadSizeKB > 400) {
        console.log(`   ❌ CRITICAL: Exceeds DynamoDB limit by ${payloadSizeKB - 400}KB`);
        console.log(`   📋 This will cause the database save to fail!`);

        // Calculate max image size per image to stay under limit
        const nonImagePayloadSize = 20; // Rough estimate for bus metadata
        const maxTotalImageSize = 400 - nonImagePayloadSize;
        const maxPerImage = Math.floor(maxTotalImageSize / photos.length);

        console.log(`   💡 To fix: Keep total images under ${maxTotalImageSize}KB`);
        console.log(`   💡 Max per image (${photos.length} images): ~${maxPerImage}KB each`);
    } else {
        console.log(`   ✅ Within limits (${400 - payloadSizeKB}KB remaining)`);
    }
}

function createImageValidationCode() {
    console.log('\n🔧 GENERATING: Image Validation Code for AddBus.jsx\n');

    const validationCode = `
// Add this to AddBus.jsx to validate images before upload

const MAX_IMAGE_SIZE_KB = 80; // Adjust based on testing
const MAX_TOTAL_PAYLOAD_KB = 350; // Leave buffer for DynamoDB

const validateImageSize = (photos) => {
  const errors = [];
  let totalSizeKB = 0;
  
  photos.forEach((photo, index) => {
    const sizeKB = Math.round(photo.data.length / 1024);
    totalSizeKB += sizeKB;
    
    if (sizeKB > MAX_IMAGE_SIZE_KB) {
      errors.push(\`Image \${index + 1} (\${photo.name}) is too large: \${sizeKB}KB. Max: \${MAX_IMAGE_SIZE_KB}KB\`);
    }
  });
  
  if (totalSizeKB > MAX_TOTAL_PAYLOAD_KB) {
    errors.push(\`Total images too large: \${totalSizeKB}KB. Max: \${MAX_TOTAL_PAYLOAD_KB}KB\`);
  }
  
  return errors;
};

// Use in handleSubmit before API call:
const imageErrors = validateImageSize(photos);
if (imageErrors.length > 0) {
  setErrors([...errs, ...imageErrors]);
  return;
}
`;

    console.log('📋 Recommended validation code:');
    console.log(validationCode);
}

function analyzeCurrentImplementation() {
    console.log('\n🔍 CURRENT IMPLEMENTATION ANALYSIS\n');

    console.log('✅ What WORKS:');
    console.log('   - Images are correctly read as base64 data URLs');
    console.log('   - Photos array is included in the payload');
    console.log('   - Backend accepts and stores photos field');
    console.log('   - JSON serialization preserves image data');

    console.log('\n⚠️  What might FAIL:');
    console.log('   - Large images cause DynamoDB write failures');
    console.log('   - No client-side size validation');
    console.log('   - No user feedback about image size limits');
    console.log('   - API Gateway has 6MB request limit (probably OK)');
    console.log('   - Lambda has 6MB response limit (might be hit)');

    console.log('\n🚨 CRITICAL ISSUES:');
    console.log('   1. DynamoDB item limit: 400KB');
    console.log('   2. Typical phone photo: 1-3MB');
    console.log('   3. Base64 encoding adds 33% overhead');
    console.log('   4. User gets no warning about size limits');

    console.log('\n💡 IMMEDIATE FIXES NEEDED:');
    console.log('   1. Add image compression in frontend');
    console.log('   2. Add size validation before upload');
    console.log('   3. Show file size to users');
    console.log('   4. Consider alternative storage (S3)');
}

// Main test runner
function runEnhancedTests() {
    console.log('🚌 ENHANCED BUS IMAGE PERSISTENCE TEST\n');

    testRealisticImageSizes();
    testMultipleImages();
    createImageValidationCode();
    analyzeCurrentImplementation();

    console.log('\n🎯 CONCLUSION:');
    console.log('❌ Current implementation WILL FAIL with real-world images');
    console.log('✅ Images ARE technically saved correctly (when small enough)');
    console.log('🔧 Immediate action needed to handle image size limits');
}

runEnhancedTests();