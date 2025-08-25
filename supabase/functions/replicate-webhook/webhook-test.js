#!/usr/bin/env node

/**
 * Replicate Webhook Test Script
 * Tests the webhook endpoint with mock Replicate completion data
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://etnepmeyxrznwfzikyqp.supabase.co',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bmVwbWV5eHJ6bndmemlreXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0OTc1NjIsImV4cCI6MjA1NTA3MzU2Mn0.JamETnIUenJrJ-Dd-tTlL4m66TMg54TJRWfSzSBUWQ0',
  TEST_USER_ID: '12345678-1234-1234-1234-123456789012',
  WEBHOOK_URL: null
};

CONFIG.WEBHOOK_URL = `${CONFIG.SUPABASE_URL}/functions/v1/replicate-webhook`;

console.log('🧪 Replicate Webhook Test Suite');
console.log('================================');
console.log(`Webhook URL: ${CONFIG.WEBHOOK_URL}`);
console.log('');

// Helper function to make HTTP requests
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData,
            raw: responseData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            raw: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test 1: Create a mock generation record
async function testCreateGeneration() {
  console.log('📝 Test 1: Creating mock generation record...');
  
  const mockGeneration = {
    prediction_id: `test_${Date.now()}`,
    prompt: 'Test video generation for webhook testing',
    model: 'hailuo-2',
    status: 'processing'
  };

  try {
    const response = await makeRequest(`${CONFIG.SUPABASE_URL}/rest/v1/photo_generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }, mockGeneration);

    if (response.status === 201) {
      console.log('✅ Generation record created successfully');
      console.log(`   Prediction ID: ${mockGeneration.prediction_id}`);
      return mockGeneration.prediction_id;
    } else {
      console.log('❌ Failed to create generation record');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${response.raw}`);
      return null;
    }
  } catch (error) {
    console.log('❌ Error creating generation record:', error.message);
    return null;
  }
}

// Test 2: Test webhook with successful completion
async function testWebhookSuccess(predictionId) {
  console.log('\n🎯 Test 2: Testing webhook with successful completion...');
  
  const mockWebhookPayload = {
    id: predictionId,
    status: 'succeeded',
    output: 'https://replicate.delivery/pbxt/example-video.mp4',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    urls: {
      get: `https://api.replicate.com/v1/predictions/${predictionId}`
    }
  };

  try {
    const response = await makeRequest(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Replicate-Webhook/1.0'
      }
    }, mockWebhookPayload);

    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${response.raw}`);
    
    if (response.status === 200) {
      console.log('✅ Webhook processed successfully');
      return true;
    } else {
      console.log('❌ Webhook processing failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error calling webhook:', error.message);
    return false;
  }
}

// Test 3: Test webhook with failure
async function testWebhookFailure() {
  console.log('\n💥 Test 3: Testing webhook with failure...');
  
  const failurePredictionId = `test_failure_${Date.now()}`;
  
  // First create a generation record for the failure test
  const mockGeneration = {
    prediction_id: failurePredictionId,
    prompt: 'Test failure case',
    model: 'hailuo-2',
    status: 'processing'
  };

  try {
    await makeRequest(`${CONFIG.SUPABASE_URL}/rest/v1/photo_generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    }, mockGeneration);

    const mockFailurePayload = {
      id: failurePredictionId,
      status: 'failed',
      error: 'Test error: Video generation failed due to invalid input',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };

    const response = await makeRequest(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Replicate-Webhook/1.0'
      }
    }, mockFailurePayload);

    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${response.raw}`);
    
    if (response.status === 200) {
      console.log('✅ Failure webhook processed successfully');
      return true;
    } else {
      console.log('❌ Failure webhook processing failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing failure webhook:', error.message);
    return false;
  }
}

// Test 4: Check database records
async function testDatabaseRecords() {
  console.log('\n🗄️  Test 4: Checking database records...');
  
  try {
    // Check photo_generations table
    const generationsResponse = await makeRequest(`${CONFIG.SUPABASE_URL}/rest/v1/photo_generations?select=*&order=created_at.desc&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY
      }
    });

    console.log('   Recent photo_generations records:');
    if (generationsResponse.data && generationsResponse.data.length > 0) {
      generationsResponse.data.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.prediction_id} - ${record.status} (${record.model})`);
      });
    } else {
      console.log('   No records found');
    }

    // Check photos table
    const photosResponse = await makeRequest(`${CONFIG.SUPABASE_URL}/rest/v1/photos?select=*&order=created_at.desc&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY
      }
    });

    console.log('\n   Recent photos records:');
    if (photosResponse.data && photosResponse.data.length > 0) {
      photosResponse.data.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.id.substring(0, 8)} - ${record.content_type} (${record.original_url ? record.original_url.substring(0, 50) + '...' : 'no URL'})`);
      });
    } else {
      console.log('   No records found');
    }

    return true;
  } catch (error) {
    console.log('❌ Error checking database records:', error.message);
    return false;
  }
}

// Test 5: Test webhook endpoint availability
async function testWebhookEndpoint() {
  console.log('\n🌐 Test 5: Testing webhook endpoint availability...');
  
  try {
    const response = await makeRequest(CONFIG.WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Webhook-Test/1.0'
      }
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${response.raw}`);
    
    if (response.status === 200 || response.status === 405) {
      console.log('✅ Webhook endpoint is accessible');
      return true;
    } else {
      console.log('❌ Webhook endpoint may not be accessible');
      return false;
    }
  } catch (error) {
    console.log('❌ Error accessing webhook endpoint:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('Starting webhook tests...\n');
  
  const results = {
    endpointTest: false,
    createGeneration: false,
    webhookSuccess: false,
    webhookFailure: false,
    databaseCheck: false
  };

  // Test webhook endpoint
  results.endpointTest = await testWebhookEndpoint();
  
  // Create mock generation
  const predictionId = await testCreateGeneration();
  results.createGeneration = !!predictionId;
  
  // Test successful webhook
  if (predictionId) {
    results.webhookSuccess = await testWebhookSuccess(predictionId);
  }
  
  // Test failure webhook
  results.webhookFailure = await testWebhookFailure();
  
  // Check database records
  results.databaseCheck = await testDatabaseRecords();
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Endpoint Accessibility: ${results.endpointTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Generation Creation: ${results.createGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Success Webhook: ${results.webhookSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Failure Webhook: ${results.webhookFailure ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database Records: ${results.databaseCheck ? '✅ PASS' : '❌ FAIL'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Your webhook system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});