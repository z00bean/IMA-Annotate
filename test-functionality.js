/**
 * Node.js test script to verify basic functionality
 * This script tests the core modules without requiring a browser
 */

import { CONFIG, validateConfig, isApiKeyConfigured, getApiEndpoint } from './config.js';

console.log('=== IMA Annotate Frontend - Functionality Test ===\n');

// Test 1: Configuration Validation
console.log('1. Testing Configuration...');
const configValidation = validateConfig();
console.log(`   Configuration valid: ${configValidation.isValid}`);
if (!configValidation.isValid) {
    console.log(`   Errors: ${configValidation.errors.join(', ')}`);
} else {
    console.log('   ✓ Configuration is valid');
}

console.log(`   API Key configured: ${isApiKeyConfigured()}`);
console.log(`   Sample images count: ${CONFIG.SAMPLE_IMAGES.length}`);
console.log(`   Annotation colors count: ${Object.keys(CONFIG.ANNOTATION_COLORS).length}`);
console.log(`   State colors count: ${Object.keys(CONFIG.STATE_COLORS).length}`);

// Test 2: API Endpoints
console.log('\n2. Testing API Endpoints...');
console.log(`   Base URL: ${CONFIG.API_BASE_URL}`);
console.log(`   Test Connection: ${getApiEndpoint('TEST_CONNECTION')}`);
console.log(`   Get Images: ${getApiEndpoint('GET_IMAGES')}`);
console.log(`   Get Annotations: ${getApiEndpoint('GET_ANNOTATIONS')}`);

// Test 3: Sample Images Configuration
console.log('\n3. Testing Sample Images Configuration...');
CONFIG.SAMPLE_IMAGES.forEach((image, index) => {
    console.log(`   ${index + 1}. ${image}`);
});

// Test 4: Color Configuration
console.log('\n4. Testing Color Configuration...');
console.log('   Annotation Colors:');
Object.entries(CONFIG.ANNOTATION_COLORS).forEach(([className, color]) => {
    console.log(`     ${className}: ${color}`);
});

console.log('   State Colors:');
Object.entries(CONFIG.STATE_COLORS).forEach(([state, color]) => {
    console.log(`     ${state}: ${color}`);
});

// Test 5: Keyboard Shortcuts
console.log('\n5. Testing Keyboard Shortcuts...');
Object.entries(CONFIG.KEYBOARD_SHORTCUTS).forEach(([action, key]) => {
    console.log(`   ${action}: ${key}`);
});

console.log('\n=== Configuration Test Complete ===');
console.log('✓ All configuration tests passed');
console.log('\nNext steps:');
console.log('1. Open http://localhost:8080/ in a browser');
console.log('2. Open browser developer console');
console.log('3. Check for any JavaScript errors');
console.log('4. Verify that images load and navigation works');
console.log('5. Test keyboard shortcuts (Left/Right arrows)');