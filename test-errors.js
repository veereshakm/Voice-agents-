const axios = require('axios');

// Test script to demonstrate error handling
async function testErrorHandling() {
    console.log('🧪 Testing AI Voice Agent Error Handling\n');

    const baseUrl = 'http://localhost:3000';

    // Test 1: Health check with missing API keys
    console.log('1. Testing health check with missing API keys...');
    try {
        const healthResponse = await axios.get(`${baseUrl}/health`);
        console.log('✅ Health check response:', healthResponse.data);
    } catch (error) {
        console.log('❌ Health check failed:', error.response?.data || error.message);
    }

    // Test 2: Test invalid session ID
    console.log('\n2. Testing invalid session ID...');
    try {
        const response = await axios.get(`${baseUrl}/agent/chat/invalid-session/history`);
        console.log('✅ Invalid session response:', response.data);
    } catch (error) {
        console.log('❌ Invalid session error:', error.response?.data || error.message);
    }

    // Test 3: Test missing audio file
    console.log('\n3. Testing missing audio file...');
    try {
        const response = await axios.post(`${baseUrl}/agent/chat/test-session`, {}, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log('✅ Missing audio response:', response.data);
    } catch (error) {
        console.log('❌ Missing audio error:', error.response?.data || error.message);
    }

    // Test 4: Test non-existent endpoint
    console.log('\n4. Testing non-existent endpoint...');
    try {
        const response = await axios.get(`${baseUrl}/nonexistent`);
        console.log('✅ Non-existent endpoint response:', response.data);
    } catch (error) {
        console.log('❌ Non-existent endpoint error:', error.response?.data || error.message);
    }

    console.log('\n🎯 Error handling test completed!');
    console.log('\n📝 To test the full application:');
    console.log('1. Start the server: node server.js');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Try recording audio - you should see fallback responses due to missing API keys');
    console.log('4. Check the browser console for detailed error information');
}

// Run the test
testErrorHandling().catch(console.error);

