import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
// @ts-ignore Badge variant types
declare module './ui/badge' {
  interface BadgeProps {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  }
}
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Play, Clock } from 'lucide-react';

interface TestResult {
  test: string;
  success: boolean;
  details: any;
  duration?: number;
}

export function TimetableTestSuite() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [classId, setClassId] = useState<string>('');
  const [academicSessionId, setAcademicSessionId] = useState<string>('');
  
  // Initialize test data dynamically
  useEffect(() => {
    const initializeTestData = async () => {
      try {
        // Get current user's school classes
        const classesResult = await makeRequest('GET', '/classes');
        if (classesResult.status === 200 && classesResult.data.length > 0) {
          setClassId(classesResult.data[0].id);
          setAcademicSessionId(classesResult.data[0].academicSessionId);
          setIsInitialized(true);
        } else {
          console.error('No classes found for testing');
        }
      } catch (error) {
        console.error('Failed to initialize test data:', error);
      }
    };
    
    initializeTestData();
  }, []);

  // Helper to make authenticated API requests
  const makeRequest = async (method: string, endpoint: string, data?: any) => {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Include cookies for authentication
    };
    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`/api${endpoint}`, options);
    const result = await response.json();
    return { status: response.status, data: result };
  };

  // Get current week start
  const getCurrentWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return monday.toISOString().split('T')[0];
  };

  // Test 1: Saturday Free Period Teacher Assignment
  const testSaturdayFreePeriodAssignment = async (): Promise<TestResult> => {
    const weekStart = getCurrentWeekStart();
    const testData = {
      classId,
      day: 'saturday',
      period: 1,
      teacherId: '8c9c97fc-faf2-49f1-801e-ccb55efb011e', // Gregory Holmes
      subjectId: '',
      startTime: '07:30',
      endTime: '08:15',
      weekStart
    };

    const result = await makeRequest('POST', '/timetable/assign', testData);
    
    // Verify assignment was saved
    const verification = await makeRequest('GET', `/timetable/weekly/${classId}`);
    const assigned = verification.data?.timetableData?.some((entry: any) => 
      entry.day === 'saturday' && 
      entry.period === 1 && 
      entry.teacherId === testData.teacherId
    );

    return {
      test: 'Saturday Free Period Assignment',
      success: result.status === 200 && assigned,
      details: {
        assignmentStatus: result.status,
        verified: assigned,
        response: result.data
      }
    };
  };

  // Test 2: Academic Session ID Validation
  const testAcademicSessionValidation = async (): Promise<TestResult> => {
    const weeklyResult = await makeRequest('GET', `/timetable/weekly/${classId}`);
    const globalResult = await makeRequest('GET', '/timetable/global');

    const weeklySessionId = weeklyResult.data?.academicSessionId;
    const sessionValid = weeklySessionId === academicSessionId;

    return {
      test: 'Academic Session ID Validation',
      success: sessionValid,
      details: {
        expected: academicSessionId,
        weekly: weeklySessionId,
        globalCount: globalResult.data?.length || 0,
        weeklyStatus: weeklyResult.status,
        globalStatus: globalResult.status
      }
    };
  };

  // Test 3: Teacher Deletion and Reassignment
  const testTeacherDeletionReassignment = async (): Promise<TestResult> => {
    const weekStart = getCurrentWeekStart();
    
    // Step 1: Assign a teacher to Monday Period 5
    const initialAssignment = {
      classId,
      day: 'monday',
      period: 5,
      teacherId: '32a1d2dd-715c-46fd-9a47-a144dfd7a2dd', // Anna Myers
      subjectId: '29d8eb74-576e-4ebe-a59d-b15dc09bf318', // Reading
      startTime: '10:15',
      endTime: '11:00',
      weekStart
    };

    const assign1 = await makeRequest('POST', '/timetable/assign', initialAssignment);
    
    // Step 2: Delete the assignment (set to free period)  
    const deleteAssignment = {
      ...initialAssignment,
      teacherId: '',
      subjectId: ''
    };

    const deleteResult = await makeRequest('POST', '/timetable/assign', deleteAssignment);
    
    // Step 3: Reassign with different teacher
    const reassignment = {
      ...initialAssignment,
      teacherId: '6c76da93-6b37-4747-9c1c-1e6fe29d8e9a' // Hannah Barker MD
    };

    const reassignResult = await makeRequest('POST', '/timetable/assign', reassignment);

    // Verify final state
    const verification = await makeRequest('GET', `/timetable/weekly/${classId}`);
    const finalEntry = verification.data?.timetableData?.find((entry: any) => 
      entry.day === 'monday' && entry.period === 5
    );

    const success = reassignResult.status === 200 && finalEntry?.teacherId === reassignment.teacherId;

    return {
      test: 'Teacher Deletion and Reassignment',
      success,
      details: {
        initialAssign: assign1.status,
        deletion: deleteResult.status,
        reassignment: reassignResult.status,
        finalTeacherId: finalEntry?.teacherId,
        expectedTeacherId: reassignment.teacherId
      }
    };
  };

  // Test 4: Multiple Day Assignments
  const testMultipleDayAssignments = async (): Promise<TestResult> => {
    const weekStart = getCurrentWeekStart();
    const teacherId = '78d7d9c4-eab0-4d47-b7c7-c398c367f042'; // Joshua Yoder
    const subjectId = '1ad19bb8-7698-4f36-a3f0-67914fb5dd61'; // English
    
    const assignments = [
      { day: 'tuesday', period: 7, startTime: '12:30', endTime: '13:15' },
      { day: 'wednesday', period: 7, startTime: '12:30', endTime: '13:15' },
      { day: 'thursday', period: 7, startTime: '12:30', endTime: '13:15' },
      { day: 'friday', period: 7, startTime: '12:30', endTime: '13:15' }
    ];

    const results = [];
    
    for (const assignment of assignments) {
      const testData = {
        classId,
        day: assignment.day,
        period: assignment.period,
        teacherId,
        subjectId,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        weekStart
      };

      const result = await makeRequest('POST', '/timetable/assign', testData);
      results.push({
        day: assignment.day,
        period: assignment.period,
        status: result.status,
        success: result.status === 200
      });
    }

    const allSuccess = results.every(r => r.success);

    return {
      test: 'Multiple Day Assignments',
      success: allSuccess,
      details: results
    };
  };

  // Test 5: Data Consistency Check
  const testDataConsistency = async (): Promise<TestResult> => {
    const weeklyResult = await makeRequest('GET', `/timetable/weekly/${classId}`);
    const weeklyData = weeklyResult.data;

    if (weeklyResult.status !== 200) {
      return {
        test: 'Data Consistency',
        success: false,
        details: { error: 'Could not fetch weekly data', status: weeklyResult.status }
      };
    }

    // Check for duplicate entries
    const entries = weeklyData?.timetableData || [];
    const duplicates = [];
    const seen = new Set();

    for (const entry of entries) {
      const key = `${entry.day}-${entry.period}`;
      if (seen.has(key)) {
        duplicates.push(key);
      } else {
        seen.add(key);
      }
    }

    // Check for missing required fields
    const invalidEntries = entries.filter((entry: any) => 
      !entry.day || 
      !entry.period || 
      !entry.startTime || 
      !entry.endTime
    );

    // Check academic session consistency
    const hasCorrectSession = weeklyData?.academicSessionId === academicSessionId;

    const consistent = duplicates.length === 0 && 
                     invalidEntries.length === 0 && 
                     hasCorrectSession;

    return {
      test: 'Data Consistency',
      success: consistent,
      details: {
        totalEntries: entries.length,
        duplicates,
        invalidEntries: invalidEntries.length,
        academicSessionCorrect: hasCorrectSession,
        academicSessionId: weeklyData?.academicSessionId
      }
    };
  };

  // Run all tests
  const runAllTests = async () => {
    if (!isInitialized) {
      alert('Test data not initialized. Please wait for the system to load.');
      return;
    }
    
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest('');

    const tests = [
      { name: 'Saturday Free Period Assignment', fn: testSaturdayFreePeriodAssignment },
      { name: 'Academic Session ID Validation', fn: testAcademicSessionValidation },
      { name: 'Teacher Deletion and Reassignment', fn: testTeacherDeletionReassignment },
      { name: 'Multiple Day Assignments', fn: testMultipleDayAssignments },
      { name: 'Data Consistency', fn: testDataConsistency }
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      setCurrentTest(test.name);
      const startTime = Date.now();
      
      try {
        const result = await test.fn();
        result.duration = Date.now() - startTime;
        results.push(result);
        setTestResults([...results]);
      } catch (error) {
        results.push({
          test: test.name,
          success: false,
          details: { error: error instanceof Error ? error.message : String(error) },
          duration: Date.now() - startTime
        });
        setTestResults([...results]);
      }
    }

    setCurrentTest('');
    setIsRunning(false);
  };

  const passedTests = testResults.filter(t => t.success).length;
  const totalTests = testResults.length;
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Comprehensive Timetable Testing Suite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button 
                onClick={runAllTests} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                {isRunning ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              
              {testResults.length > 0 && (
                <div className="flex items-center gap-4">
                  <Badge variant={successRate === 100 ? 'default' : successRate > 50 ? 'secondary' : 'destructive'}>
                    {passedTests}/{totalTests} Passed ({successRate}%)
                  </Badge>
                </div>
              )}
            </div>

            {currentTest && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Currently running: {currentTest}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">{result.test}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.duration && (
                        <span className="text-sm text-gray-500">
                          {result.duration}ms
                        </span>
                      )}
                      <Badge variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                  </div>
                  
                  {!result.success && result.details && (
                    <div className="mt-2 p-2 bg-white rounded text-sm">
                      <pre className="text-red-600 overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {testResults.length > 0 && passedTests < totalTests && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {totalTests - passedTests} test(s) failed. The timetable system requires attention.
            Check the detailed results above for specific issues.
          </AlertDescription>
        </Alert>
      )}

      {testResults.length > 0 && passedTests === totalTests && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All tests passed! The timetable system is functioning correctly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}