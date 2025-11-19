/**
 * Comprehensive Chroney Chat Testing Script
 * Tests all phases of Chroney functionality with detailed logging
 */

import { storage } from "./storage";

interface TestResult {
  query: string;
  expectedTool?: string;
  passed: boolean;
  response?: any;
  error?: string;
  notes?: string;
}

const TEST_RESULTS: TestResult[] = [];

/**
 * Make authenticated API request to chat endpoint
 */
async function testChatQuery(query: string, expectedTool?: string): Promise<TestResult> {
  const result: TestResult = {
    query,
    expectedTool,
    passed: false
  };

  try {
    console.log(`\n🧪 Testing: "${query}"`);
    console.log(`   Expected tool: ${expectedTool || 'None (conversational)'}`);

    const response = await fetch('http://localhost:5000/api/chroney/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add auth token from test admin user
      },
      body: JSON.stringify({ message: query })
    });

    const data = await response.json();
    result.response = data;

    // Check for errors
    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${JSON.stringify(data)}`;
      console.log(`   ❌ FAIL: ${result.error}`);
      return result;
    }

    // Check if response is natural language (not raw JSON or function syntax)
    const isNaturalLanguage = 
      typeof data.reply === 'string' &&
      !data.reply.includes('function(') &&
      !data.reply.includes('{') &&
      !data.reply.includes('[');

    // Log response
    console.log(`   Response: ${data.reply?.substring(0, 100)}...`);
    
    if (data.action) {
      console.log(`   Action triggered: ${data.action}`);
    }

    // Mark as passed if we got a valid response
    result.passed = !!data.reply && isNaturalLanguage;
    
    if (result.passed) {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ⚠️  Response may have issues`);
    }

  } catch (error: any) {
    result.error = error.message;
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  TEST_RESULTS.push(result);
  return result;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('═'.repeat(80));
  console.log('🚀 CHRONEY CHAT COMPREHENSIVE TESTING');
  console.log('═'.repeat(80));

  // === PHASE 1: Basic Queries ===
  console.log('\n📋 PHASE 1: BASIC QUERIES');
  console.log('─'.repeat(80));
  
  await testChatQuery("How many students are there?", "list_entities");
  await testChatQuery("How many teachers do we have?", "list_entities");
  await testChatQuery("What's my school name?", "conversational");
  await testChatQuery("Show me student list", "list_entities");
  await testChatQuery("List all teachers", "list_entities");

  // === PHASE 2: Attendance Operations ===
  console.log('\n📋 PHASE 2: ATTENDANCE OPERATIONS');
  console.log('─'.repeat(80));
  
  await testChatQuery("Who was absent yesterday?", "query_school_data OR fetch_leave_requests");
  await testChatQuery("Mark John Doe as absent today", "mark_attendance");
  await testChatQuery("Show me attendance overview", "generate_report");
  await testChatQuery("Which teachers are absent today?", "query_school_data");

  // === PHASE 3: Reporting Features ===
  console.log('\n📋 PHASE 3: REPORTING FEATURES');
  console.log('─'.repeat(80));
  
  await testChatQuery("Generate attendance report for this week", "generate_report");
  await testChatQuery("Show me teacher workload", "generate_report");
  await testChatQuery("Give me a class list for Grade 1-A", "generate_report");

  // === PHASE 4: Excel Export ===
  console.log('\n📋 PHASE 4: EXCEL EXPORT (Phase 3 Tools)');
  console.log('─'.repeat(80));
  
  await testChatQuery("Export attendance data to Excel", "generate_excel_export");
  await testChatQuery("Download student list as Excel", "generate_excel_export");

  // === PHASE 5: Advanced Analytics ===
  console.log('\n📋 PHASE 5: ADVANCED ANALYTICS (Phase 4 Tools)');
  console.log('─'.repeat(80));
  
  await testChatQuery("Predict attendance for next week", "predict_attendance");
  await testChatQuery("Analyze attendance trends", "analyze_trends");
  await testChatQuery("Detect any anomalies in the data", "detect_anomalies");
  await testChatQuery("Suggest schedule optimizations", "recommend_schedule_optimization");

  // === PHASE 6: Error Handling ===
  console.log('\n📋 PHASE 6: ERROR HANDLING');
  console.log('─'.repeat(80));
  
  await testChatQuery("tell me about it", "should handle gracefully");
  await testChatQuery("xyz123", "should handle gracefully");
  await testChatQuery("Mark nonexistent teacher absent", "should handle gracefully");

  // === TEST SUMMARY ===
  console.log('\n═'.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(80));
  
  const passed = TEST_RESULTS.filter(r => r.passed).length;
  const failed = TEST_RESULTS.filter(r => !r.passed).length;
  const total = TEST_RESULTS.length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
  
  // List failed tests
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    TEST_RESULTS.filter(r => !r.passed).forEach(r => {
      console.log(`   - "${r.query}"`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }

  console.log('\n═'.repeat(80));
}

// Run if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✨ Testing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Testing failed:', error);
      process.exit(1);
    });
}

export { runAllTests, testChatQuery, TEST_RESULTS };
