import { z } from "zod";

/**
 * Tool Definition System for Chroney AI Assistant
 * Defines all available tools that Chroney can use to interact with school data
 */

export interface ChroneyTool {
  name: string;
  description: string;
  category: 'data_fetch' | 'data_write' | 'analytics' | 'bulk_operation' | 'system';
  parameters: z.ZodSchema;
  handler: string; // Name of the handler function
  requiredRole?: string[];
  examples: string[];
}

// Parameter schemas
const studentIdentifierSchema = z.object({
  identifier: z.string().describe("Student name, admission number, or ID"),
  includeParents: z.boolean().optional().describe("Include parent information"),
  includeAttendance: z.boolean().optional().describe("Include attendance summary"),
});

const teacherIdentifierSchema = z.object({
  identifier: z.string().describe("Teacher name, email, or ID"),
  includeSchedule: z.boolean().optional().describe("Include weekly schedule"),
  includeWorkload: z.boolean().optional().describe("Include workload information"),
});

const markAttendanceSchema = z.object({
  type: z.enum(['teacher', 'student']).describe("Type of attendance (teacher or student)"),
  identifier: z.string().describe("REQUIRED: Name, ID, or admission number of the person. If the user hasn't provided a name yet, ask them for it BEFORE calling this tool. DO NOT call this tool without an identifier."),
  classFilter: z.string().optional().describe("Teacher's class (needed only if multiple teachers have the same name)"),
  date: z.string().optional().describe("MUST be today's date only - past and future dates are not allowed"),
  status: z.enum(['present', 'absent', 'late']).describe("Attendance status (present, absent, or late)"),
  confirmed: z.boolean().optional().describe("Whether user has confirmed the action"),
});

const bulkAttendanceSchema = z.object({
  type: z.enum(['teacher', 'student']).describe("Type of attendance"),
  scope: z.string().describe("'all' for all teachers/students, or class ID for specific class"),
  date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
  status: z.enum(['present', 'absent']).describe("Attendance status"),
});

const generateReportSchema = z.object({
  reportType: z.enum([
    'attendance_summary',
    'attendance_report',
    'teacher_workload',
    'class_list',
    'student_list',
    'teacher_list',
    'absent_today',
    'attendance_overview'
  ]).describe("Type of report to generate"),
  filters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional(),
    classId: z.string().optional(),
    teacherId: z.string().optional(),
    grade: z.string().optional(),
  }).optional(),
  format: z.enum(['json', 'excel', 'summary']).optional().describe("Output format"),
});

const querySchoolDataSchema = z.object({
  query: z.string().describe("The EXACT user question - preserve their wording"),
  scope: z.enum(['students', 'teachers', 'attendance', 'classes', 'all']).describe("MANDATORY: 'students' for student queries, 'teachers' for teacher queries"),
  timeframe: z.string().optional().describe("Time period like 'today', 'this week', 'last month'"),
});

const listEntitiesSchema = z.object({
  entityType: z.enum(['students', 'teachers', 'classes', 'subjects']).describe("Type of entities to list"),
  filters: z.object({
    classId: z.string().optional(),
    grade: z.string().optional(),
    section: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 10)"),
});

const fetchFeeDataSchema = z.object({
  dataType: z.enum(['invoices', 'payments', 'outstanding', 'summary']).describe("Type of fee data to retrieve"),
  filters: z.object({
    studentId: z.string().optional().describe("Specific student ID"),
    academicSessionId: z.string().optional().describe("Academic session ID"),
    status: z.enum(['paid', 'partial', 'pending', 'overdue']).optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional(),
  }).optional(),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 20)"),
});

const fetchTransportDataSchema = z.object({
  dataType: z.enum(['routes', 'vehicles', 'student_assignments', 'summary']).describe("Type of transport data to retrieve"),
  filters: z.object({
    routeId: z.string().optional(),
    vehicleId: z.string().optional(),
    studentId: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 20)"),
});

const fetchMessagesSchema = z.object({
  scope: z.enum(['conversations', 'unread', 'specific_conversation']).describe("What message data to retrieve"),
  conversationWith: z.object({
    userId: z.string(),
    userType: z.enum(['student', 'teacher', 'parent', 'admin']),
  }).optional().describe("Specific conversation to retrieve (required for specific_conversation scope)"),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 10)"),
});

const fetchLeaveRequestsSchema = z.object({
  filters: z.object({
    teacherId: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional(),
  }).optional(),
  includeSubstitutions: z.boolean().optional().describe("Include substitution assignments"),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 20)"),
});

const fetchSchoolInsightsSchema = z.object({
  category: z.enum(['attendance', 'performance', 'finance', 'transport', 'overall']).optional(),
  timeframe: z.string().optional().describe("Time period like 'today', 'this week', 'last month'"),
  includeRecommendations: z.boolean().optional().describe("Include AI-powered recommendations"),
});

const fetchStudentAttendanceSchema = z.object({
  filters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional(),
    status: z.enum(['present', 'absent', 'late']).optional().describe("Filter by attendance status"),
    classId: z.string().optional(),
    studentId: z.string().optional(),
  }).optional(),
  limit: z.coerce.number().optional().describe("Maximum number of results (default 20)"),
});

const fetchTimetableSchema = z.object({
  classId: z.string().optional().describe("Class ID or class name (e.g., '1A', '10-B') to fetch timetable for a class. Provide EITHER classId OR teacherId."),
  teacherId: z.string().optional().describe("Teacher ID or teacher name to fetch timetable for a teacher. Provide EITHER classId OR teacherId."),
  date: z.string().optional().describe("Specific date in YYYY-MM-DD format"),
  weekStart: z.string().optional().describe("Week start date in YYYY-MM-DD format"),
  includeChanges: z.boolean().optional().describe("Include timetable changes/substitutions (default: true)"),
});

const generateTimetableSchema = z.object({
  mode: z.enum(['all', 'missing_only']).optional().default('all').describe("'all' to regenerate for all classes (overwrite existing), 'missing_only' to only generate for classes without timetables"),
}).strict();

const findFreeTeachersSchema = z.object({
  period: z.coerce.number().describe("Period number (e.g., 1, 2, 3, etc.) to check for free teachers"),
  day: z.string().optional().describe("Day of week (monday, tuesday, etc.). Defaults to today if not specified"),
  date: z.string().optional().describe("Specific date in YYYY-MM-DD format. Overrides day parameter if provided"),
});

// PHASE 3: Advanced reporting and batch operations schemas
const generateExcelExportSchema = z.object({
  exportType: z.enum([
    'attendance_report',
    'student_list',
    'teacher_list',
    'fee_report',
    'transport_report',
    'class_roster',
    'leave_summary'
  ]).describe("Type of data to export"),
  filters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional(),
    classId: z.string().optional(),
    grade: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  includeDetails: z.boolean().optional().describe("Include detailed information (default: true)"),
});

const analyzeTrendsSchema = z.object({
  metric: z.enum([
    'attendance_trends',
    'fee_collection_trends',
    'teacher_availability',
    'student_enrollment',
    'transport_usage'
  ]).describe("What metric to analyze"),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).describe("Time range for trend analysis"),
  granularity: z.enum(['daily', 'weekly', 'monthly']).optional().describe("Data granularity (default: daily)"),
  compareWith: z.string().optional().describe("Previous period to compare with (e.g., 'last_month', 'last_year')"),
});

const bulkUpdateSchema = z.object({
  operation: z.enum([
    'update_student_status',
    'update_fee_status',
    'assign_to_class',
    'send_notifications'
  ]).describe("Type of bulk operation to perform"),
  targetIds: z.array(z.string()).describe("IDs of entities to update"),
  updateData: z.record(z.any()).describe("Data to update (key-value pairs)"),
  sendNotification: z.boolean().optional().describe("Send notification after update (default: false)"),
});

// PHASE 4: Predictive analytics and smart recommendations schemas
const predictAttendanceSchema = z.object({
  targetType: z.enum(['student', 'teacher', 'class']).describe("What to predict attendance for"),
  targetId: z.string().optional().describe("Specific ID to predict for (optional for overall predictions)"),
  forecastDays: z.coerce.number().optional().describe("Number of days to forecast (default: 7)"),
  includeRiskFactors: z.boolean().optional().describe("Include risk factors and confidence scores (default: true)"),
});

const recommendScheduleOptimizationSchema = z.object({
  analysisScope: z.enum(['school_wide', 'specific_class', 'specific_teacher']).describe("Scope of optimization analysis"),
  targetId: z.string().optional().describe("ID of class or teacher (required for specific scopes)"),
  optimizationGoals: z.array(z.enum([
    'minimize_conflicts',
    'balance_workload',
    'maximize_continuity',
    'reduce_free_periods',
    'optimize_room_usage'
  ])).optional().describe("Specific optimization goals"),
  includeActionPlan: z.boolean().optional().describe("Include step-by-step implementation plan (default: true)"),
});

const generateInsightsReportSchema = z.object({
  reportScope: z.enum([
    'weekly_summary',
    'monthly_overview',
    'academic_performance',
    'operational_efficiency',
    'financial_health',
    'custom'
  ]).describe("Type of insights report to generate"),
  focusAreas: z.array(z.string()).optional().describe("Specific areas to focus on (for custom reports)"),
  includeRecommendations: z.boolean().optional().describe("Include AI-powered action recommendations (default: true)"),
  format: z.enum(['narrative', 'bullet_points', 'structured']).optional().describe("Report format (default: narrative)"),
});

const detectAnomaliesSchema = z.object({
  dataType: z.enum([
    'attendance',
    'academic_performance',
    'fee_payments',
    'teacher_workload',
    'resource_usage',
    'all'
  ]).describe("Type of data to analyze for anomalies"),
  sensitivityLevel: z.enum(['low', 'medium', 'high']).optional().describe("Detection sensitivity (default: medium)"),
  timeWindow: z.string().optional().describe("Time window to analyze (e.g., 'last_30_days', 'this_term')"),
  includeContextualAnalysis: z.boolean().optional().describe("Include contextual explanations (default: true)"),
});

const suggestTeacherAssignmentsSchema = z.object({
  optimizationMode: z.enum([
    'balance_workload',
    'maximize_expertise',
    'minimize_gaps',
    'optimize_continuity',
    'comprehensive'
  ]).describe("Optimization strategy for assignments"),
  constraints: z.object({
    preserveExisting: z.boolean().optional().describe("Preserve current assignments where possible"),
    maxWorkloadHours: z.coerce.number().optional().describe("Maximum weekly hours per teacher"),
    requireQualification: z.boolean().optional().describe("Only suggest qualified teachers"),
  }).optional(),
  showAlternatives: z.boolean().optional().describe("Show alternative assignment options (default: true)"),
});

/**
 * Complete tool registry for Chroney
 */
export const CHRONEY_TOOLS: ChroneyTool[] = [
  {
    name: "fetch_student_profile",
    description: "Get student details (profile, attendance, parents)",
    category: "data_fetch",
    parameters: studentIdentifierSchema,
    handler: "handleFetchStudentProfile",
    requiredRole: ["admin"],
    examples: [
      "Show me Aarav Kumar's profile",
      "Get details for student with admission number ADM001",
      "Tell me about student Priya Sharma",
    ],
  },
  {
    name: "fetch_teacher_profile",
    description: "Get teacher details (contact, subjects, schedule, workload)",
    category: "data_fetch",
    parameters: teacherIdentifierSchema,
    handler: "handleFetchTeacherProfile",
    requiredRole: ["admin"],
    examples: [
      "Show me Rajesh Kumar's profile",
      "Get teacher details for raj.kumar@school.com",
      "Tell me about teacher with ID T123",
    ],
  },
  {
    name: "mark_attendance",
    description: "Mark attendance for teachers or students. CRITICAL: You MUST have a name/ID before calling this tool. If the user says 'mark a student absent' without providing a name, ask 'Which student would you like to mark as absent?' BEFORE calling this tool. DO NOT call this tool without an identifier parameter. When user specifies 'STUDENT' or 'TEACHER', extract that type and ask for the name if missing.",
    category: "data_write",
    parameters: markAttendanceSchema,
    handler: "handleMarkAttendance",
    requiredRole: ["admin"],
    examples: [
      "Mark teacher Amit Singh as absent today",
      "Set attendance present for student Neha Reddy",
      "Mark Priya as late for today",
      "Mark teacher present",
      "Mark student absent",
      "teacher is absent",
      "student is late",
    ],
  },
  {
    name: "bulk_mark_attendance",
    description: "Mark attendance for all teachers/students or class",
    category: "bulk_operation",
    parameters: bulkAttendanceSchema,
    handler: "handleBulkMarkAttendance",
    requiredRole: ["admin"],
    examples: [
      "Mark all teachers present for today",
      "Set all Grade 10-A students as present",
      "Mark everyone present",
    ],
  },
  {
    name: "generate_report",
    description: "Generate attendance summaries, workload reports, and entity lists. MUST be used for ALL attendance report/summary requests with time periods (today, yesterday, last X days, this week, last month, etc.).",
    category: "analytics",
    parameters: generateReportSchema,
    handler: "handleGenerateReport",
    requiredRole: ["admin"],
    examples: [
      "show me attendance report",
      "attendance report",
      "show attendance summary",
      "attendance overview",
      "attendance for last 3 days",
      "attendance for last week",
      "show me attendance for last 5 days",
      "attendance for today",
      "attendance for yesterday",
      "attendance for this month",
      "for last 7 days",
      "for last 15 days",
      "Generate attendance report for last week",
      "Show me teacher workload distribution",
      "Create a list of all students in Grade 10",
      "Export teacher attendance for this month",
    ],
  },
  {
    name: "query_school_data",
    description: "Answer questions about school data, attendance, and who's absent/present today (PREFERRED for current day attendance queries)",
    category: "analytics",
    parameters: querySchoolDataSchema,
    handler: "handleQuerySchoolData",
    requiredRole: ["admin"],
    examples: [
      "Who's absent today?",
      "Show me teachers absent today",
      "How many students are absent today?",
      "Which class has the most students?",
      "What is the average teacher workload?",
      "Show me attendance trend for last month",
    ],
  },
  {
    name: "list_entities",
    description: "List students, teachers, classes, or subjects. Supports filtering by classId, grade, section. Use filters.classId to get teachers/students for a specific class.",
    category: "data_fetch",
    parameters: listEntitiesSchema,
    handler: "handleListEntities",
    requiredRole: ["admin"],
    examples: [
      "List all students in Grade 10-A",
      "Show me all teachers",
      "Show teachers from class 1A",
      "List students in class 10-B",
      "List classes for Grade 9",
      "Show all subjects",
    ],
  },
  {
    name: "fetch_fee_data",
    description: "Get fee data (invoices, payments, outstanding)",
    category: "data_fetch",
    parameters: fetchFeeDataSchema,
    handler: "handleFetchFeeData",
    requiredRole: ["admin"],
    examples: [
      "Show me all pending fee payments",
      "What are the outstanding fees for this month?",
      "Get all invoices for student Aarav Kumar",
      "Show fee payment summary for this academic session",
      "List all overdue fees",
    ],
  },
  {
    name: "fetch_transport_data",
    description: "Get transport data (routes, vehicles, assignments)",
    category: "data_fetch",
    parameters: fetchTransportDataSchema,
    handler: "handleFetchTransportData",
    requiredRole: ["admin"],
    examples: [
      "Show me all transport routes",
      "Which students are assigned to Route 5?",
      "List all school vehicles",
      "Show transport summary",
      "Get vehicle details for bus BUS-001",
    ],
  },
  {
    name: "fetch_messages",
    description: "Get messages (conversations, unread, history)",
    category: "data_fetch",
    parameters: fetchMessagesSchema,
    handler: "handleFetchMessages",
    requiredRole: ["admin"],
    examples: [
      "Show me all unread messages",
      "List my recent conversations",
      "Get messages with teacher Rajesh Kumar",
      "How many unread messages do I have?",
    ],
  },
  {
    name: "fetch_leave_requests",
    description: "Get teacher leave requests and approval status (for historical/pending leave data, NOT for today's absences)",
    category: "data_fetch",
    parameters: fetchLeaveRequestsSchema,
    handler: "handleFetchLeaveRequests",
    requiredRole: ["admin"],
    examples: [
      "Show me pending leave requests",
      "List all leave requests with substitution details",
      "Get approved leaves for this month",
      "Which teachers requested leave for next week?",
    ],
  },
  {
    name: "fetch_student_attendance",
    description: "Get student attendance WITH NAMES by date",
    category: "data_fetch",
    parameters: fetchStudentAttendanceSchema,
    handler: "handleFetchStudentAttendance",
    requiredRole: ["admin"],
    examples: [
      "Which students were absent yesterday?",
      "Show me absent students today",
      "List students who were late this week",
      "Who was absent on October 5th?",
    ],
  },
  {
    name: "fetch_school_insights",
    description: "Get AI insights about school ops and performance",
    category: "analytics",
    parameters: fetchSchoolInsightsSchema,
    handler: "handleFetchSchoolInsights",
    requiredRole: ["admin"],
    examples: [
      "Show me overall school insights",
      "What are the attendance trends this week?",
      "Give me financial insights for this month",
      "Show transport analytics with recommendations",
      "What insights do you have about school performance?",
    ],
  },
  {
    name: "fetch_timetable",
    description: "Get COMPLETE WEEKLY timetable/schedule for a SPECIFIC named class or SPECIFIC named teacher. Returns ALL periods for ALL days (Monday-Saturday) with subjects, teachers, times, and rooms. Always present the FULL weekly schedule, not just one day. CRITICAL: This shows ONE person's/class's full schedule. If user asks 'which teachers are free' or 'show free teachers', use find_free_teachers instead - NOT this tool.",
    category: "data_fetch",
    parameters: fetchTimetableSchema,
    handler: "handleFetchTimetable",
    requiredRole: ["admin"],
    examples: [
      "Show me timetable for class 1A",
      "What is the schedule for class 10-B today?",
      "Get teacher Rajesh Kumar's timetable",
      "Show this week's timetable for grade 5-A",
      "Display the class schedule for Monday",
    ],
  },
  {
    name: "generate_timetable",
    description: "Generate/regenerate AI-powered timetables for the school. Triggers the smart timetable generation process.",
    category: "system",
    parameters: generateTimetableSchema,
    handler: "handleGenerateTimetable",
    requiredRole: ["admin"],
    examples: [
      "Generate timetable",
      "Create timetables for all classes",
      "Regenerate timetables",
      "Generate smart timetable",
      "Create timetables for classes without one",
    ],
  },
  {
    name: "find_free_teachers",
    description: "**PRIMARY TOOL** for finding which teachers are FREE/AVAILABLE (not teaching/busy) during a specific period. Shows LIST of teacher names who DON'T have classes scheduled. Use this WHENEVER user asks 'which teachers are free', 'show free teachers', 'teachers available', 'who is free'. Returns table of available teachers with names and IDs. NEVER use fetch_timetable for free teacher queries.",
    category: "data_fetch",
    parameters: findFreeTeachersSchema,
    handler: "handleFindFreeTeachers",
    requiredRole: ["admin"],
    examples: [
      "Show me teachers free on 6th Period today",
      "Show me list of teachers free on 3rd period today",
      "Which teachers are free during period 5?",
      "Who is free on period 2 on Monday?",
      "List free teachers for period 4 tomorrow",
      "Show available teachers for period 6 on Wednesday",
      "teachers free on period 3",
      "list of free teachers period 4",
    ],
  },
  // PHASE 3: Advanced reporting and batch operations tools
  {
    name: "generate_excel_export",
    description: "Generate Excel reports with filters",
    category: "analytics",
    parameters: generateExcelExportSchema,
    handler: "handleGenerateExcelExport",
    requiredRole: ["admin"],
    examples: [
      "Export attendance report for last month to Excel",
      "Generate student list Excel for Grade 10",
      "Create Excel report of all fee payments this term",
      "Export teacher list with contact details",
      "Download class roster for 10-A",
    ],
  },
  {
    name: "analyze_trends",
    description: "Analyze historical trends with comparisons",
    category: "analytics",
    parameters: analyzeTrendsSchema,
    handler: "handleAnalyzeTrends",
    requiredRole: ["admin"],
    examples: [
      "Show me attendance trends for the past 3 months",
      "Analyze fee collection trends compared to last year",
      "What are the teacher availability trends this term?",
      "Show student enrollment trends month by month",
      "Analyze transport usage patterns over last quarter",
    ],
  },
  {
    name: "bulk_update",
    description: "Bulk update statuses or send notifications",
    category: "bulk_operation",
    parameters: bulkUpdateSchema,
    handler: "handleBulkUpdate",
    requiredRole: ["admin"],
    examples: [
      "Update status for 10 students to 'active'",
      "Send fee reminder notifications to all students with pending payments",
      "Assign selected students to Class 10-A",
      "Bulk update fee status to 'paid' for these invoices",
    ],
  },
  // PHASE 4: Predictive analytics and smart recommendations tools
  {
    name: "predict_attendance",
    description: "Forecast attendance with ML + identify at-risk",
    category: "analytics",
    parameters: predictAttendanceSchema,
    handler: "handlePredictAttendance",
    requiredRole: ["admin"],
    examples: [
      "Predict attendance for next week",
      "Which students are at risk of poor attendance?",
      "Forecast teacher availability for the next 7 days",
      "What's the predicted attendance rate for Class 10-A next month?",
      "Identify students likely to be absent",
    ],
  },
  {
    name: "recommend_schedule_optimization",
    description: "Suggest timetable improvements to fix conflicts/gaps",
    category: "analytics",
    parameters: recommendScheduleOptimizationSchema,
    handler: "handleRecommendScheduleOptimization",
    requiredRole: ["admin"],
    examples: [
      "Optimize the school-wide timetable",
      "Suggest improvements for Class 10-A schedule",
      "How can we reduce teacher workload imbalances?",
      "Analyze and optimize teacher Rajesh's schedule",
      "Find ways to minimize timetable conflicts",
    ],
  },
  {
    name: "generate_insights_report",
    description: "Create AI narrative reports with recommendations",
    category: "analytics",
    parameters: generateInsightsReportSchema,
    handler: "handleGenerateInsightsReport",
    requiredRole: ["admin"],
    examples: [
      "Generate a weekly summary report",
      "Create monthly operational efficiency report",
      "Give me an AI summary of this month's performance",
      "Generate comprehensive academic performance insights",
      "Create a narrative report on financial health",
    ],
  },
  {
    name: "detect_anomalies",
    description: "Find unusual patterns/outliers with AI analysis",
    category: "analytics",
    parameters: detectAnomaliesSchema,
    handler: "handleDetectAnomalies",
    requiredRole: ["admin"],
    examples: [
      "Detect any anomalies in attendance data",
      "Are there unusual patterns in fee payments?",
      "Identify anomalies across all school data",
      "Check for unusual teacher workload patterns",
      "Find outliers in student performance",
    ],
  },
  {
    name: "suggest_teacher_assignments",
    description: "Recommend optimal teacher-subject-class matches",
    category: "analytics",
    parameters: suggestTeacherAssignmentsSchema,
    handler: "handleSuggestTeacherAssignments",
    requiredRole: ["admin"],
    examples: [
      "Suggest optimal teacher assignments for next term",
      "How should I distribute subjects among teachers?",
      "Recommend teacher assignments to balance workload",
      "Who should teach which subjects for maximum efficiency?",
      "Optimize teacher-subject assignments",
    ],
  },
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): ChroneyTool | undefined {
  return CHRONEY_TOOLS.find(tool => tool.name === name);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ChroneyTool['category']): ChroneyTool[] {
  return CHRONEY_TOOLS.filter(tool => tool.category === category);
}

/**
 * Smart tool selection based on query analysis
 * Returns only relevant tools instead of all 19
 */
export function selectRelevantTools(query: string): ChroneyTool[] {
  const lowerQuery = query.toLowerCase();
  const selectedTools: Set<string> = new Set();
  
  // Core tools - ALWAYS include these (critical for basic operations)
  const coreTools = ['list_entities', 'query_school_data'];
  coreTools.forEach(t => selectedTools.add(t));
  
  // Student-related queries
  if (/student|pupil|learner|admission|enroll/i.test(query)) {
    selectedTools.add('fetch_student_profile');
    selectedTools.add('fetch_student_attendance');
  }
  
  // Teacher-related queries
  if (/teacher|staff|faculty|instructor/i.test(query)) {
    selectedTools.add('fetch_teacher_profile');
    selectedTools.add('fetch_leave_requests');
    selectedTools.add('suggest_teacher_assignments');
  }
  
  // Attendance queries - include if they mention marking, absent, attendance, etc.
  if (/mark|absent|attendance|present|late|leave|away|off/i.test(query)) {
    selectedTools.add('mark_attendance');
    selectedTools.add('bulk_mark_attendance');
    selectedTools.add('fetch_student_attendance');
    selectedTools.add('fetch_leave_requests');
    selectedTools.add('predict_attendance');
    
    // Add generate_report for attendance summary/overview/report queries OR time-period queries
    if (/summary|overview|report|last\s+\d+\s+days?|last\s+week|last\s+month|this\s+week|this\s+month|yesterday|today|for\s+last/i.test(query)) {
      selectedTools.add('generate_report');
      selectedTools.add('generate_excel_export');
    }
  }
  
  // Fee/finance queries
  if (/fee|payment|invoice|financial|paid|pending|due|money/i.test(query)) {
    selectedTools.add('fetch_fee_data');
  }
  
  // Transport queries
  if (/transport|bus|vehicle|route|driver/i.test(query)) {
    selectedTools.add('fetch_transport_data');
  }
  
  // Timetable/schedule queries
  if (/generate.*timetable|create.*timetable|regenerate.*timetable|make.*timetable/i.test(query)) {
    selectedTools.add('generate_timetable');
  } else if (
    // Explicit schedule keywords
    /timetable|schedule|period|class.*timing|today.*class|weekly.*schedule/i.test(query) ||
    // Implicit schedule questions with time indicators
    /(what|which|when).*(class|teach|teaching|subject|lesson).*(after|before|next|first|last|now|today|tomorrow|this|during)/i.test(query) ||
    /(what|which|when).*(after|before|next|first|last).*(class|teach|period|lesson)/i.test(query) ||
    // Free period questions
    /(is|are).*(free|available|busy|teaching).*((now|today|tomorrow|period|time)|(\d+))/i.test(query) ||
    // Time-specific questions (e.g., "what at 2pm", "class at 10:00")
    /(what|which).*(class|teach|subject|lesson).*(\d{1,2}(:\d{2})?\s*(am|pm|AM|PM)?|lunch|break|morning|afternoon)/i.test(query) ||
    // After/before questions (e.g., "after lunch", "after period 3")
    /(after|before|following).*(lunch|break|period|class|recess)/i.test(query)
  ) {
    selectedTools.add('fetch_timetable');
  }
  
  // Free teachers queries - detect requests to find which teachers are free
  if (/(free|available|not.*busy).*(teacher|staff|faculty|instructor).*(period|\d+(st|nd|rd|th)|time|slot)/i.test(query) ||
      /(teacher|staff|faculty|instructor).*(free|available|not.*busy).*(period|\d+(st|nd|rd|th)|time|slot)/i.test(query) ||
      /(list|show|who|which).*(teacher|staff|faculty).*(free|available)/i.test(query)) {
    selectedTools.add('find_free_teachers');
  }
  
  // Messaging queries
  if (/message|chat|conversation|text|send|notify/i.test(query)) {
    selectedTools.add('fetch_messages');
    selectedTools.add('bulk_update'); // For bulk notifications
  }
  
  // Report/export queries
  if (/report|export|excel|download|generate.*report/i.test(query)) {
    selectedTools.add('generate_report');
    selectedTools.add('generate_excel_export');
  }
  
  // Trend/analytics queries
  if (/trend|pattern|analysis|compare|historical|over time/i.test(query)) {
    selectedTools.add('analyze_trends');
    selectedTools.add('fetch_school_insights');
  }
  
  // Optimization/recommendation queries
  if (/optimize|improve|suggest|recommend|better|efficiency/i.test(query)) {
    selectedTools.add('recommend_schedule_optimization');
    selectedTools.add('suggest_teacher_assignments');
    selectedTools.add('fetch_school_insights');
  }
  
  // Prediction queries
  if (/predict|forecast|future|next week|next month|likely/i.test(query)) {
    selectedTools.add('predict_attendance');
  }
  
  // Insights/summary queries
  if (/insight|summary|overview|performance|what.*happening/i.test(query)) {
    selectedTools.add('fetch_school_insights');
    selectedTools.add('generate_insights_report');
  }
  
  // Anomaly/unusual queries
  if (/anomal|unusual|strange|outlier|weird|different/i.test(query)) {
    selectedTools.add('detect_anomalies');
  }
  
  // Bulk operation queries
  if (/bulk|all.*update|mass|everyone/i.test(query)) {
    selectedTools.add('bulk_update');
    selectedTools.add('bulk_mark_attendance');
  }
  
  // Get the actual tool objects
  const tools = CHRONEY_TOOLS.filter(tool => selectedTools.has(tool.name));
  
  // Ensure we have at least 5 tools (minimum for robust context)
  if (tools.length < 5) {
    // Add essential fallback tools not already selected
    const fallbackTools = [
      'generate_report',
      'fetch_school_insights', 
      'mark_attendance',
      'fetch_student_profile',
      'fetch_teacher_profile'
    ];
    
    for (const toolName of fallbackTools) {
      if (!selectedTools.has(toolName) && tools.length < 5) {
        const tool = CHRONEY_TOOLS.find(t => t.name === toolName);
        if (tool) tools.push(tool);
      }
    }
  }
  
  console.log(`[TOOL SELECTION] Query: "${query.substring(0, 50)}..." → Selected ${tools.length}/${CHRONEY_TOOLS.length} tools (saved ${Math.round((1 - tools.length/CHRONEY_TOOLS.length) * 100)}%):`, tools.map(t => t.name));
  return tools;
}

/**
 * Format tools for LLAMA function calling
 */
export function formatToolsForLLAMA(tools?: ChroneyTool[]): any[] {
  const toolsToFormat = tools || CHRONEY_TOOLS;
  return toolsToFormat.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: zodSchemaToJsonSchema(tool.parameters),
        required: getRequiredFields(tool.parameters),
      },
    },
  }));
}

/**
 * Convert Zod schema to JSON Schema (simplified)
 */
function zodSchemaToJsonSchema(schema: z.ZodSchema): any {
  // This is a simplified converter - for production, use zod-to-json-schema library
  const shape = (schema as any)._def?.shape?.();
  if (!shape) return {};
  
  const properties: any = {};
  Object.keys(shape).forEach(key => {
    let field = shape[key];
    const description = field._def?.description || '';
    
    // Unwrap all wrapper types (multiple levels)
    while (field._def?.typeName === 'ZodOptional' || 
           field._def?.typeName === 'ZodDefault' || 
           field._def?.typeName === 'ZodEffects') {
      if (field._def?.typeName === 'ZodOptional' || field._def?.typeName === 'ZodDefault') {
        field = field._def.innerType;
      } else if (field._def?.typeName === 'ZodEffects') {
        field = field._def.schema;
      }
    }
    
    if (field._def?.typeName === 'ZodString') {
      properties[key] = { type: 'string', description };
    } else if (field._def?.typeName === 'ZodNumber') {
      properties[key] = { type: 'number', description };
    } else if (field._def?.typeName === 'ZodBoolean') {
      properties[key] = { type: 'boolean', description };
    } else if (field._def?.typeName === 'ZodEnum') {
      properties[key] = { 
        type: 'string', 
        enum: field._def?.values || [],
        description 
      };
    } else if (field._def?.typeName === 'ZodObject') {
      properties[key] = {
        type: 'object',
        properties: zodSchemaToJsonSchema(field),
        description
      };
    } else if (field._def?.typeName === 'ZodArray') {
      // Get the array element type
      const elementType = field._def?.type;
      let items: any = { type: 'string' }; // default
      
      if (elementType?._def?.typeName === 'ZodString') {
        items = { type: 'string' };
      } else if (elementType?._def?.typeName === 'ZodNumber') {
        items = { type: 'number' };
      } else if (elementType?._def?.typeName === 'ZodBoolean') {
        items = { type: 'boolean' };
      } else if (elementType?._def?.typeName === 'ZodObject') {
        items = {
          type: 'object',
          properties: zodSchemaToJsonSchema(elementType)
        };
      }
      
      properties[key] = {
        type: 'array',
        items,
        description
      };
    }
  });
  
  return properties;
}

/**
 * Get required fields from Zod schema
 */
function getRequiredFields(schema: z.ZodSchema): string[] {
  const shape = (schema as any)._def?.shape?.();
  if (!shape) return [];
  
  return Object.keys(shape).filter(key => {
    const field = shape[key];
    return field._def?.typeName !== 'ZodOptional';
  });
}

/**
 * Tool descriptions for system prompt
 */
export function getToolDescriptionsForPrompt(): string {
  return CHRONEY_TOOLS.map(tool => 
    `- ${tool.name}: ${tool.description}\n  Examples: ${tool.examples.slice(0, 2).join(', ')}`
  ).join('\n');
}
