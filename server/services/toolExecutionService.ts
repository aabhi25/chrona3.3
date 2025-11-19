import { db } from "../db";
import { 
  students, teachers, classes, teacherAttendance, studentAttendance,
  classSubjectAssignments, subjects, parents, studentParents,
  timetableEntries, timetableStructures
} from "../../shared/schema";
import { eq, sql, and, or, ilike, desc, inArray } from "drizzle-orm";
import { getISTDateString } from "../../shared/utils/dateUtils";
import { getToolByName } from "../chroneyTools";
import { ToolCacheService } from "./toolCacheService";
import { getClassName, sortClasses } from '../../shared/classUtils';

/**
 * Tool Execution Service
 * Handles execution of all Chroney tools with proper validation and error handling
 */

export interface ToolExecutionContext {
  schoolId: string;
  userId: string;
  userRole: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  metadata?: {
    totalCount?: number;
    returned?: number;
    limit?: number;
    redirectUrl?: string;
    redirectLabel?: string;
    [key: string]: any;
  };
}

export class ToolExecutionService {
  /**
   * Execute a tool by name with parameters
   */
  static async executeTool(
    toolName: string,
    parameters: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = getToolByName(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    // Validate role permissions
    if (tool.requiredRole && !tool.requiredRole.includes(context.userRole)) {
      return {
        success: false,
        error: `Insufficient permissions for ${toolName}`,
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.parameters.parse(parameters);
      
      // PHASE 2: Check cache for read operations
      if (ToolCacheService.isCacheable(toolName)) {
        const cachedResult = ToolCacheService.get(toolName, validatedParams, context.schoolId);
        if (cachedResult) {
          return cachedResult;
        }
      }
      
      // Execute the appropriate handler
      let result: ToolExecutionResult;
      switch (tool.handler) {
        case "handleFetchStudentProfile":
          result = await this.handleFetchStudentProfile(validatedParams, context);
          break;
        
        case "handleFetchTeacherProfile":
          result = await this.handleFetchTeacherProfile(validatedParams, context);
          break;
        
        case "handleMarkAttendance":
          result = await this.handleMarkAttendance(validatedParams, context);
          break;
        
        case "handleBulkMarkAttendance":
          result = await this.handleBulkMarkAttendance(validatedParams, context);
          break;
        
        case "handleGenerateReport":
          result = await this.handleGenerateReport(validatedParams, context);
          break;
        
        case "handleQuerySchoolData":
          result = await this.handleQuerySchoolData(validatedParams, context);
          break;
        
        case "handleListEntities":
          result = await this.handleListEntities(validatedParams, context);
          break;
        
        case "handleFetchFeeData":
          result = await this.handleFetchFeeData(validatedParams, context);
          break;
        
        case "handleFetchTransportData":
          result = await this.handleFetchTransportData(validatedParams, context);
          break;
        
        case "handleFetchMessages":
          result = await this.handleFetchMessages(validatedParams, context);
          break;
        
        case "handleFetchLeaveRequests":
          result = await this.handleFetchLeaveRequests(validatedParams, context);
          break;
        
        case "handleFetchStudentAttendance":
          result = await this.handleFetchStudentAttendance(validatedParams, context);
          break;
        
        case "handleFetchSchoolInsights":
          result = await this.handleFetchSchoolInsights(validatedParams, context);
          break;
        
        case "handleFetchTimetable":
          result = await this.handleFetchTimetable(validatedParams, context);
          break;
        
        case "handleGenerateTimetable":
          result = await this.handleGenerateTimetable(validatedParams, context);
          break;
        
        case "handleFindFreeTeachers":
          result = await this.handleFindFreeTeachers(validatedParams, context);
          break;
        
        // PHASE 3: Advanced reporting and batch operations
        case "handleGenerateExcelExport":
          result = await this.handleGenerateExcelExport(validatedParams, context);
          break;
        
        case "handleAnalyzeTrends":
          result = await this.handleAnalyzeTrends(validatedParams, context);
          break;
        
        case "handleBulkUpdate":
          result = await this.handleBulkUpdate(validatedParams, context);
          break;
        
        // PHASE 4: Predictive analytics and smart recommendations
        case "handlePredictAttendance":
          result = await this.handlePredictAttendance(validatedParams, context);
          break;
        
        case "handleRecommendScheduleOptimization":
          result = await this.handleRecommendScheduleOptimization(validatedParams, context);
          break;
        
        case "handleGenerateInsightsReport":
          result = await this.handleGenerateInsightsReport(validatedParams, context);
          break;
        
        case "handleDetectAnomalies":
          result = await this.handleDetectAnomalies(validatedParams, context);
          break;
        
        case "handleSuggestTeacherAssignments":
          result = await this.handleSuggestTeacherAssignments(validatedParams, context);
          break;
        
        default:
          result = {
            success: false,
            error: `Handler not implemented: ${tool.handler}`,
          };
      }
      
      // PHASE 2: Cache successful read operations
      if (result.success && ToolCacheService.isCacheable(toolName)) {
        ToolCacheService.set(toolName, validatedParams, context.schoolId, result);
      }
      
      // PHASE 2: Invalidate related cache for write operations
      if (result.success && !ToolCacheService.isCacheable(toolName)) {
        ToolCacheService.invalidateRelated(toolName, context.schoolId);
      }
      
      return result;
    } catch (error: any) {
      // Handle Zod validation errors with user-friendly messages
      if (error.name === 'ZodError' && error.issues) {
        const firstIssue = error.issues[0];
        const fieldPath = firstIssue.path.join('.');
        const fieldName = fieldPath || 'parameter';
        
        if (firstIssue.code === 'invalid_enum_value') {
          return {
            success: false,
            error: `I couldn't process that request. The AI made an internal error with parameter "${fieldName}".`,
          };
        }
        
        return {
          success: false,
          error: `I couldn't process that request. There was an issue with the "${fieldName}" parameter: ${firstIssue.message}`,
        };
      }
      
      return {
        success: false,
        error: error.message || "Tool execution failed",
      };
    }
  }

  /**
   * Fetch student profile
   */
  private static async handleFetchStudentProfile(
    params: { identifier: string; includeParents?: boolean; includeAttendance?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { identifier, includeParents, includeAttendance } = params;

    // Check if identifier looks like a UUID or admission number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const looksLikeAdmissionNumber = /^(ADM|STU)\d+$/i.test(identifier); // Matches ADM001, STU0539, etc.

    let student: any = null;
    let studentClass: any = null;

    // Try exact match first for admission number or UUID (these are unique identifiers)
    if (isUUID || looksLikeAdmissionNumber) {
      const exactStudent = await db.query.students.findFirst({
        where: and(
          eq(students.schoolId, context.schoolId),
          isUUID ? eq(students.id, identifier) : eq(students.admissionNumber, identifier)
        ),
        with: {
          class: {
            columns: {
              id: true,
              grade: true,
              section: true,
              room: true,
            },
          },
        },
      });
      
      if (!exactStudent) {
        return {
          success: false,
          error: `No student found with ${isUUID ? 'ID' : 'admission number'} "${identifier}"`,
        };
      }
      
      student = exactStudent;
      studentClass = student.class && !Array.isArray(student.class) ? student.class : null;
      // Found exact match, skip to profile generation
    } else {
      // Search by name (these can have multiple matches)
      // Support both single-word searches (first or last name) and full-name searches
      const nameParts = identifier.trim().split(/\s+/);
      const conditions = [];
      
      if (nameParts.length === 1) {
        // Single word: search in both firstName and lastName
        conditions.push(
          ilike(students.firstName, `%${identifier}%`),
          ilike(students.lastName, `%${identifier}%`)
        );
      } else {
        // Multiple words: treat as "FirstName LastName" or search each part
        const [firstPart, ...restParts] = nameParts;
        const lastPart = restParts.join(' ');
        
        // Search for "FirstName LastName" combination
        conditions.push(
          and(
            ilike(students.firstName, `%${firstPart}%`),
            ilike(students.lastName, `%${lastPart}%`)
          )
        );
        
        // Also search each part individually (catch partial matches)
        nameParts.forEach(part => {
          conditions.push(
            ilike(students.firstName, `%${part}%`),
            ilike(students.lastName, `%${part}%`)
          );
        });
      }

      const matchingStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, context.schoolId),
          or(...conditions)
        ),
        limit: 10, // Limit to first 10 matches
        with: {
          class: {
            columns: {
              id: true,
              grade: true,
              section: true,
              room: true,
            },
          },
        },
      });

      if (matchingStudents.length === 0) {
        return {
          success: false,
          error: `No student found with name "${identifier}"`,
        };
      }

      // If multiple matches found, ask for confirmation
      if (matchingStudents.length > 1) {
        const studentList = matchingStudents.map(s => {
          const sClass = s.class && !Array.isArray(s.class) ? s.class : null;
          return {
            name: `${s.firstName} ${s.lastName}`,
            admissionNumber: s.admissionNumber,
            className: sClass ? getClassName(sClass.grade, sClass.section) : 'N/A',
            email: s.email,
          };
        });

        return {
          success: true,
          message: `I found ${matchingStudents.length} students named "${identifier}". Please specify which one:`,
          metadata: {
            requiresConfirmation: true,
            confirmationType: 'student_selection',
            options: studentList,
          },
        };
      }

      // Single match found, proceed with profile
      student = matchingStudents[0];
      studentClass = student.class && !Array.isArray(student.class) ? student.class : null;
    }
    
    const result: any = {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      email: student.email,
      phone: student.contactNumber,
      class: studentClass ? {
        id: studentClass.id,
        name: getClassName(studentClass.grade, studentClass.section),
        grade: studentClass.grade,
        section: studentClass.section,
        room: studentClass.room,
      } : null,
      dateOfBirth: student.dateOfBirth,
      address: student.address,
      gender: student.gender,
    };

    // Include parents if requested
    if (includeParents) {
      const studentParentsData = await db.query.studentParents.findMany({
        where: eq(studentParents.studentId, student.id),
        with: {
          parent: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              contactNumber: true,
              relationToStudent: true,
            },
          },
        },
      });

      result.parents = studentParentsData.map(sp => {
        const parent = !Array.isArray(sp.parent) ? sp.parent : null;
        if (!parent) return null;
        return {
          id: parent.id,
          name: `${parent.firstName} ${parent.lastName}`,
          email: parent.email,
          phone: parent.contactNumber,
          relationship: parent.relationToStudent,
        };
      }).filter(Boolean);
    }

    // Include attendance summary if requested
    if (includeAttendance) {
      const today = getISTDateString(new Date());
      const weekStart = getISTDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      const attendanceResult = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
          COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
          COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
          COUNT(*)::int as total_days
        FROM ${studentAttendance}
        WHERE student_id = ${student.id}
        AND attendance_date >= ${weekStart}
        AND attendance_date <= ${today}
      `);

      result.attendanceSummary = (attendanceResult.rows[0] as any) || {
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        total_days: 0,
      };
    }

    return {
      success: true,
      data: result,
      message: `Here's ${result.name}'s profile:`,
      metadata: {
        showProfileDialog: true,
        profileType: 'student',
        profileData: result,
      },
    };
  }

  /**
   * Fetch teacher profile
   */
  private static async handleFetchTeacherProfile(
    params: { identifier: string; includeSchedule?: boolean; includeWorkload?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { identifier, includeSchedule, includeWorkload } = params;

    // Check if identifier looks like a UUID or employee ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const looksLikeEmployeeId = /^T\d+$/i.test(identifier); // Matches T001, T123, etc.

    let teacher: any = null;

    // Try exact match first for employee ID or UUID (these are unique identifiers)
    if (isUUID || looksLikeEmployeeId) {
      teacher = await db.query.teachers.findFirst({
        where: and(
          eq(teachers.schoolId, context.schoolId),
          isUUID ? eq(teachers.id, identifier) : eq(teachers.employeeId, identifier)
        ),
      });
      
      if (!teacher) {
        return {
          success: false,
          error: `No teacher found with ${isUUID ? 'ID' : 'employee ID'} "${identifier}"`,
        };
      }
      // Found exact match, skip to profile generation
    } else {
      // Search by name or email (these can have multiple matches)
      // For names, search using partial match on the full name field
      const conditions = [
        ilike(teachers.name, `%${identifier}%`),
        eq(teachers.email, identifier),
      ];
      
      const matchingTeachers = await db.query.teachers.findMany({
        where: and(
          eq(teachers.schoolId, context.schoolId),
          or(...conditions)
        ),
        limit: 10, // Limit to first 10 matches
      });

      if (matchingTeachers.length === 0) {
        return {
          success: false,
          error: `No teacher found with name "${identifier}"`,
        };
      }

      // If multiple matches found, ask for confirmation
      if (matchingTeachers.length > 1) {
        const teacherList = matchingTeachers.map(t => ({
          name: t.name,
          schoolId: t.schoolIdNumber || t.employeeId,
          email: t.email,
          designation: t.designation,
        }));

        return {
          success: true,
          message: `I found ${matchingTeachers.length} teachers named "${identifier}". Please specify which one:`,
          metadata: {
            requiresConfirmation: true,
            confirmationType: 'teacher_selection',
            options: teacherList,
          },
        };
      }

      // Single match found, proceed with profile
      teacher = matchingTeachers[0];
    }

    const result: any = {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.contactNumber,
      schoolId: teacher.schoolIdNumber || teacher.employeeId,
      designation: teacher.designation,
      dateOfBirth: teacher.dateOfBirth,
      gender: teacher.gender,
      bloodGroup: teacher.bloodGroup,
    };

    // Include subjects taught
    const assignments = await db.query.classSubjectAssignments.findMany({
      where: eq(classSubjectAssignments.assignedTeacherId, teacher.id),
      with: {
        class: {
          columns: { grade: true, section: true },
        },
        subject: {
          columns: { name: true, code: true },
        },
      },
    });

    result.subjects = assignments.map(a => {
      const classData = !Array.isArray(a.class) ? a.class : null;
      const subjectData = !Array.isArray(a.subject) ? a.subject : null;
      return {
        className: classData ? getClassName(classData.grade, classData.section) : 'Unknown',
        subjectName: subjectData?.name || 'Unknown',
        subjectCode: subjectData?.code || '',
        periodsPerWeek: a.weeklyFrequency,
      };
    });

    // Include workload if requested
    if (includeWorkload) {
      const totalPeriods = assignments.reduce((sum, a) => sum + (a.weeklyFrequency || 0), 0);
      result.workload = {
        totalClassesAssigned: assignments.length,
        totalPeriodsPerWeek: totalPeriods,
      };
    }

    return {
      success: true,
      data: result,
      message: `Here's ${teacher.name}'s profile:`,
      metadata: {
        showProfileDialog: true,
        profileType: 'teacher',
        profileData: result,
      },
    };
  }

  /**
   * Mark attendance - Interactive flow with confirmation
   */
  private static async handleMarkAttendance(
    params: { type: 'teacher' | 'student'; identifier?: string; classFilter?: string; date?: string; status: 'present' | 'absent' | 'late'; confirmed?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { type, identifier, classFilter, status, confirmed } = params;
    const date = params.date || getISTDateString(new Date());
    
    // Debug logging to track confirmation loop
    console.log('[MARK_ATTENDANCE] Params received:', JSON.stringify({ type, identifier, status, confirmed, date }));

    if (type === 'teacher') {
      // Step 1: If no identifier provided, ask which teacher
      if (!identifier) {
        return {
          success: true,
          message: `To mark a teacher as ${status}, please provide their name and the class they teach.`,
          data: { needsInput: true, step: 'ask_teacher_name' },
        };
      }

      // Step 2: Find teacher(s)
      // Check if identifier looks like a UUID (simple check for 8-4-4-4-12 format)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      // If confirmed is true and we have a name (not UUID), try to find the teacher directly without filtering
      // This handles cases where the LLM passes confirmed=true with a name or employee ID instead of a UUID
      if (confirmed && !isUUID && classFilter) {
        // Try to find the exact teacher using name/employee ID/school ID + class filter
        const matchingTeachers = await db.query.teachers.findMany({
          where: and(
            eq(teachers.schoolId, context.schoolId),
            or(
              ilike(teachers.name, `%${identifier}%`),
              eq(teachers.employeeId, identifier),
              eq(teachers.schoolIdNumber, identifier)
            )
          ),
        });

        if (matchingTeachers.length > 0) {
          // Filter by class
          const teacherDetails = await Promise.all(
            matchingTeachers.map(async (teacher) => {
              const assignments = await db.query.classSubjectAssignments.findMany({
                where: eq(classSubjectAssignments.assignedTeacherId, teacher.id),
                with: {
                  class: { columns: { grade: true, section: true } },
                },
              });

              const classList = assignments.map(a => {
                const cls = a.class as any;
                if (!cls) return null;
                return getClassName(cls.grade, cls.section);
              }).filter(Boolean);

              return { id: teacher.id, classes: classList };
            })
          );

          // Normalize filter for flexible matching
          const normalizedFilter = classFilter.toLowerCase().replace(/^class\s*/i, '').trim();
          const filteredTeachers = teacherDetails.filter(t => 
            t.classes.some(c => {
              const normalizedClass = c.toLowerCase().replace(/^class\s*/i, '').trim();
              return normalizedClass.includes(normalizedFilter) || c.toLowerCase().includes(classFilter.toLowerCase());
            })
          );

          if (filteredTeachers.length === 1) {
            // Found exactly one match - use this teacher's ID and proceed with confirmation
            // Recursively call with the teacher ID instead of the name
            return this.handleMarkAttendance(
              { type, identifier: filteredTeachers[0].id, status, date, confirmed: true },
              context
            );
          }
        }
      }
      
      if (isUUID) {
        // If UUID, find exact match
        const teacher = await db.query.teachers.findFirst({
          where: and(
            eq(teachers.schoolId, context.schoolId),
            eq(teachers.id, identifier)
          ),
        });

        if (!teacher) {
          return { success: false, error: `Teacher not found: ${identifier}. Please try again with a different name.` };
        }

        // Continue with single teacher (skip to step 3)
      } else {
        // Check if identifier is an Employee ID (e.g., T001, T123) or School ID
        const isEmployeeId = /^T\d+$/i.test(identifier);
        
        console.log('[ATTENDANCE DEBUG] Searching for teacher:', { identifier, isEmployeeId, schoolId: context.schoolId });
        
        // If name or ID, find all matches
        const matchingTeachers = await db.query.teachers.findMany({
          where: and(
            eq(teachers.schoolId, context.schoolId),
            isEmployeeId
              ? or(
                  eq(teachers.employeeId, identifier),  // Exact match on employee_id
                  eq(teachers.schoolIdNumber, identifier)  // Exact match on school_id_number
                )
              : ilike(teachers.name, `%${identifier}%`)  // Fuzzy match for names
          ),
        });

        console.log('[ATTENDANCE DEBUG] Found teachers:', matchingTeachers.length, matchingTeachers.map(t => ({ name: t.name, employeeId: t.employeeId, schoolIdNumber: t.schoolIdNumber })));

        if (matchingTeachers.length === 0) {
          return { success: false, error: `Teacher not found: ${identifier}. Please try again with a different name or ID.` };
        }

        // If multiple matches, show clickable list immediately
        if (matchingTeachers.length > 1) {
          // Get teacher details with their classes
          const teacherDetails = await Promise.all(
            matchingTeachers.map(async (teacher) => {
              const assignments = await db.query.classSubjectAssignments.findMany({
                where: eq(classSubjectAssignments.assignedTeacherId, teacher.id),
                with: {
                  class: {
                    columns: { grade: true, section: true },
                  },
                },
              });

              const classList = assignments.map(a => {
                const cls = a.class as any;
                if (!cls) return null;
                return getClassName(cls.grade, cls.section);
              }).filter(Boolean);

              // Fetch current attendance status for today
              const todayAttendance = await db.query.teacherAttendance.findFirst({
                where: and(
                  eq(teacherAttendance.teacherId, teacher.id),
                  eq(teacherAttendance.attendanceDate, date)
                ),
              });

              return {
                id: teacher.id,
                name: teacher.name,
                schoolId: teacher.schoolIdNumber || teacher.employeeId || 'Not set',
                classes: classList,
                classesText: classList.join(', ') || 'No classes assigned',
                currentStatus: todayAttendance?.status || 'not_marked',
              };
            })
          );

          // Show the clickable list immediately
          return {
            success: true,
            message: `I found ${teacherDetails.length} teachers named "${identifier}". Please select which teacher you'd like to mark as ${status}:`,
            metadata: {
              confirmationList: {
                confirmationType: 'attendance_teacher_selection',
                options: teacherDetails.map(t => ({
                  id: t.id,
                  name: t.name,
                  schoolId: t.schoolId,
                  classes: t.classesText,
                  currentStatus: t.currentStatus,
                })),
                attendanceAction: {
                  status,
                  date,
                  type: 'teacher',
                },
              },
            },
          };
        }
      }

      // Single match found - get the teacher
      // Check if it's an employee ID (T###)
      const employeeIdRegex = /^T\d+$/i;
      const isEmployeeId = employeeIdRegex.test(identifier);
      
      const teacher = isUUID 
        ? await db.query.teachers.findFirst({
            where: and(
              eq(teachers.schoolId, context.schoolId),
              eq(teachers.id, identifier)
            ),
          })
        : isEmployeeId
        ? await db.query.teachers.findFirst({
            where: and(
              eq(teachers.schoolId, context.schoolId),
              or(
                eq(teachers.employeeId, identifier),
                eq(teachers.schoolIdNumber, identifier)
              )
            ),
          })
        : await db.query.teachers.findFirst({
            where: and(
              eq(teachers.schoolId, context.schoolId),
              ilike(teachers.name, `%${identifier}%`)
            ),
          });

      if (!teacher) {
        return { success: false, error: `Teacher not found: ${identifier}. Please try again with a different name.` };
      }

      // Step 3: Get teacher's classes and subjects
      const assignments = await db.query.classSubjectAssignments.findMany({
        where: eq(classSubjectAssignments.assignedTeacherId, teacher.id),
        with: {
          class: {
            columns: { grade: true, section: true },
          },
          subject: {
            columns: { name: true },
          },
        },
      });

      const classList = assignments.map(a => {
        const cls = a.class as any;
        if (!cls) return null;
        return getClassName(cls.grade, cls.section);
      }).filter(Boolean).join(', ') || 'No classes assigned';
      
      // Step 4: Always ask for confirmation unless explicitly confirmed
      // Never skip confirmation based on ID format - user must explicitly confirm
      if (!confirmed) {
        const schoolId = teacher.schoolIdNumber || teacher.employeeId || 'Not set';
        return {
          success: true,
          message: `📋 **Teacher Details:**\n\n**Name:** ${teacher.name}\n**School ID:** ${schoolId}\n**Classes Taught:** ${classList}\n\nAre you sure you want to mark **${teacher.name}** as **${status}** for ${date}? Please confirm (Yes/No).`,
          data: { 
            needsConfirmation: true, 
            teacherDetails: {
              id: teacher.id,
              name: teacher.name,
              schoolId: schoolId,
              classes: classList,
            },
            teacherId: teacher.id,  // Add this for easy access
            step: 'ask_confirmation',
          },
        };
      }

      // Step 5: Confirmed - mark attendance
      // Check if attendance already exists
      const existing = await db.query.teacherAttendance.findFirst({
        where: and(
          eq(teacherAttendance.teacherId, teacher.id),
          eq(teacherAttendance.attendanceDate, date)
        ),
      });

      if (existing) {
        // Update
        await db.update(teacherAttendance)
          .set({ status, updatedAt: new Date() })
          .where(eq(teacherAttendance.id, existing.id));
      } else {
        // Insert
        await db.insert(teacherAttendance).values({
          teacherId: teacher.id,
          schoolId: context.schoolId,
          attendanceDate: date,
          status,
          markedBy: context.userId,
        });
      }

      // Create detailed success message
      const schoolId = teacher.schoolIdNumber || teacher.employeeId;
      const schoolIdText = schoolId ? ` (ID: ${schoolId})` : '';
      const classesText = classList !== 'No classes assigned' ? ` - Classes: ${classList}` : '';
      
      return {
        success: true,
        message: `✅ Done. **${teacher.name}**${schoolIdText} (Teacher${classesText}) has been marked **${status}** for today.`,
        data: { teacherName: teacher.name, schoolId: schoolId, classes: classList, date, status },
      };
    } else {
      // Step 1: If no identifier provided, ask which student
      if (!identifier) {
        return {
          success: true,
          message: `To mark a student as ${status}, please provide their name or admission number.`,
          data: { needsInput: true, step: 'ask_student_name' },
        };
      }

      // Find student
      // Build search conditions based on identifier type
      const searchConditions = [
        ilike(students.firstName, `%${identifier}%`),
        ilike(students.lastName, `%${identifier}%`),
      ];
      
      // Handle full name searches (e.g., "Krishna Singh")
      // Use safe parameterized query with CONCAT and COALESCE for null handling
      searchConditions.push(
        sql`CONCAT(COALESCE(${students.firstName}, ''), ' ', COALESCE(${students.lastName}, '')) ILIKE ${'%' + identifier.trim() + '%'}`
      );
      
      // Only search by admission number if it matches the pattern (ADM### or STU###)
      const admissionNumberRegex = /^(ADM|STU)\d+$/i;
      if (admissionNumberRegex.test(identifier)) {
        searchConditions.push(ilike(students.admissionNumber, identifier));
      }
      
      // Only search by UUID if it's a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(identifier)) {
        searchConditions.push(eq(students.id, identifier));
      }
      
      const studentsList = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, context.schoolId),
          or(...searchConditions)
        ),
        limit: 1,
      });

      const student = studentsList[0];

      if (!student) {
        return { success: false, error: `Student not found: ${identifier}` };
      }

      // Get student's class details for confirmation message
      let classInfo = '';
      if (student.classId) {
        const studentClass = await db.query.classes.findFirst({
          where: eq(classes.id, student.classId),
        });
        if (studentClass) {
          classInfo = getClassName(studentClass.grade, studentClass.section);
        }
      }
      
      // Get current attendance status for today
      const todayStudentAttendance = await db.query.studentAttendance.findFirst({
        where: and(
          eq(studentAttendance.studentId, student.id),
          eq(studentAttendance.attendanceDate, date)
        ),
      });
      const currentAttendanceStatus = todayStudentAttendance?.status || 'not_marked';
      
      // Step: If not confirmed, check if we should skip confirmation
      // Skip confirmation when user provides exact admission number or UUID (clicked from list)
      const isAdmissionNumber = admissionNumberRegex.test(identifier);
      const isStudentUUID = uuidRegex.test(identifier);
      const shouldSkipStudentConfirmation = isAdmissionNumber || isStudentUUID;
      
      if (!confirmed && !shouldSkipStudentConfirmation) {
        const admissionText = student.admissionNumber ? ` (${student.admissionNumber})` : '';
        const classText = classInfo ? ` from ${classInfo}` : '';
        const statusText = currentAttendanceStatus !== 'not_marked' 
          ? `\n**Current Status:** ${currentAttendanceStatus.charAt(0).toUpperCase() + currentAttendanceStatus.slice(1)}`
          : '\n**Current Status:** Not marked yet';
        
        return {
          success: true,
          message: `📋 **Student Details:**\n\n**Name:** ${student.firstName} ${student.lastName}${admissionText}\n**Class:** ${classInfo || 'Not assigned'}${statusText}\n\nAre you sure you want to mark **${student.firstName} ${student.lastName}** as **${status}** for ${date}? Please confirm (Yes/No).`,
          data: { 
            needsConfirmation: true, 
            studentDetails: {
              id: student.id,
              name: `${student.firstName} ${student.lastName}`,
              admissionNumber: student.admissionNumber,
              class: classInfo,
              currentStatus: currentAttendanceStatus,
            },
            studentId: student.id,
            step: 'ask_confirmation',
          },
        };
      }

      // Step: Confirmed - mark attendance
      // Check if attendance already exists
      const existing = await db.query.studentAttendance.findFirst({
        where: and(
          eq(studentAttendance.studentId, student.id),
          eq(studentAttendance.attendanceDate, date)
        ),
      });

      if (existing) {
        // Update
        await db.update(studentAttendance)
          .set({ status, updatedAt: new Date() })
          .where(eq(studentAttendance.id, existing.id));
      } else {
        // Insert - classId is required for student attendance
        if (!student.classId) {
          return { success: false, error: `Student ${student.firstName} ${student.lastName} is not assigned to a class` };
        }
        
        await db.insert(studentAttendance).values({
          studentId: student.id,
          schoolId: context.schoolId,
          classId: student.classId,
          attendanceDate: date,
          status,
          markedBy: context.userId,
        });
      }

      // Format class info and admission text for success message
      const classInfoFormatted = classInfo ? ` - ${classInfo}` : '';
      const admissionText = student.admissionNumber ? ` (${student.admissionNumber})` : '';
      
      return {
        success: true,
        message: `✅ Done. **${student.firstName} ${student.lastName}**${admissionText} (Student${classInfoFormatted}) has been marked **${status}** for today.`,
        data: { 
          studentName: `${student.firstName} ${student.lastName}`, 
          admissionNumber: student.admissionNumber,
          class: classInfo,
          date, 
          status 
        },
      };
    }
  }

  /**
   * Bulk mark attendance
   */
  private static async handleBulkMarkAttendance(
    params: { type: 'teacher' | 'student'; scope: string; date?: string; status: 'present' | 'absent' },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { type, scope, status } = params;
    const date = params.date || getISTDateString(new Date());

    if (type === 'teacher') {
      const allTeachers = await db.query.teachers.findMany({
        where: eq(teachers.schoolId, context.schoolId),
      });

      let count = 0;
      for (const teacher of allTeachers) {
        const existing = await db.query.teacherAttendance.findFirst({
          where: and(
            eq(teacherAttendance.teacherId, teacher.id),
            eq(teacherAttendance.attendanceDate, date)
          ),
        });

        if (existing) {
          await db.update(teacherAttendance)
            .set({ status, updatedAt: new Date() })
            .where(eq(teacherAttendance.id, existing.id));
        } else {
          await db.insert(teacherAttendance).values({
            teacherId: teacher.id,
            schoolId: context.schoolId,
            attendanceDate: date,
            status,
            markedBy: context.userId,
          });
        }
        count++;
      }

      return {
        success: true,
        message: `Marked ${count} teachers as ${status} for ${date}`,
        data: { count, date, status },
      };
    } else {
      // Student bulk attendance
      let targetStudents;
      
      if (scope === 'all') {
        targetStudents = await db.query.students.findMany({
          where: eq(students.schoolId, context.schoolId),
        });
      } else {
        // Assume scope is classId
        targetStudents = await db.query.students.findMany({
          where: and(
            eq(students.schoolId, context.schoolId),
            eq(students.classId, scope)
          ),
        });
      }

      let count = 0;
      for (const student of targetStudents) {
        if (!student.classId) continue; // Skip students without class

        const existing = await db.query.studentAttendance.findFirst({
          where: and(
            eq(studentAttendance.studentId, student.id),
            eq(studentAttendance.attendanceDate, date)
          ),
        });

        if (existing) {
          await db.update(studentAttendance)
            .set({ status, updatedAt: new Date() })
            .where(eq(studentAttendance.id, existing.id));
        } else {
          await db.insert(studentAttendance).values({
            studentId: student.id,
            schoolId: context.schoolId,
            classId: student.classId,
            attendanceDate: date,
            status,
            markedBy: context.userId,
          });
        }
        count++;
      }

      return {
        success: true,
        message: `Marked ${count} students as ${status} for ${date}`,
        data: { count, date, status },
      };
    }
  }

  /**
   * Generate report
   */
  private static async handleGenerateReport(
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { reportType, filters = {} } = params;

    try {
      switch (reportType) {
        case 'attendance_summary':
        case 'attendance_report': {
          const dateRange = filters.dateRange || {
            start: getISTDateString(new Date()), // Default to today only for generic queries
            end: getISTDateString(new Date())
          };

          // Calculate number of days in range
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          // FOR REPORTS > 7 DAYS: Generate Excel with daily breakdown only
          if (daysInRange > 7) {
            const XLSX = await import('xlsx');
            
            // Get total counts
            const totalTeachersResult = await db.execute(sql`
              SELECT COUNT(DISTINCT id)::int as total FROM ${teachers} 
              WHERE school_id = ${context.schoolId} AND status = 'active'
            `);
            const totalTeachersCount = totalTeachersResult.rows[0]?.total || 0;
            
            const totalStudentsResult = await db.execute(sql`
              SELECT COUNT(DISTINCT id)::int as total FROM ${students} WHERE school_id = ${context.schoolId}
            `);
            const totalStudentsCount = totalStudentsResult.rows[0]?.total || 0;

            // Generate daily breakdown for Excel
            const exportData: any[] = [];
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              const dateStr = getISTDateString(new Date(d));
              
              // Get teacher attendance for this day
              const teacherDayStats = await db.execute(sql`
                SELECT 
                  COUNT(*) FILTER (WHERE status = 'present')::int as present,
                  COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
                  COUNT(*) FILTER (WHERE status = 'late')::int as late,
                  COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as on_leave
                FROM ${teacherAttendance}
                WHERE school_id = ${context.schoolId}
                AND attendance_date = ${dateStr}
              `);
              
              // Get student attendance for this day
              const studentDayStats = await db.execute(sql`
                SELECT 
                  COUNT(*) FILTER (WHERE status = 'present')::int as present,
                  COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
                  COUNT(*) FILTER (WHERE status = 'late')::int as late
                FROM ${studentAttendance}
                WHERE school_id = ${context.schoolId}
                AND attendance_date = ${dateStr}
              `);
              
              const teacherDay = teacherDayStats.rows[0];
              const studentDay = studentDayStats.rows[0];
              
              // Calculate attendance rates
              const teacherTotalMarked = teacherDay.present + teacherDay.absent + teacherDay.late + teacherDay.on_leave;
              const teacherAttendanceRate = teacherTotalMarked > 0 
                ? Math.round((teacherDay.present / teacherTotalMarked) * 100) 
                : 0;
              
              const studentTotalMarked = studentDay.present + studentDay.absent + studentDay.late;
              const studentAttendanceRate = studentTotalMarked > 0 
                ? Math.round((studentDay.present / studentTotalMarked) * 100) 
                : 0;
              
              // Add teacher row for this day
              exportData.push({
                'Date': dateStr,
                'Category': 'Teachers',
                'Total': totalTeachersCount,
                'Present': teacherDay.present,
                'Absent': teacherDay.absent,
                'Late': teacherDay.late,
                'On Leave': teacherDay.on_leave,
                'Attendance Rate': `${teacherAttendanceRate}%`
              });
              
              // Add student row for this day
              exportData.push({
                'Date': dateStr,
                'Category': 'Students',
                'Total': totalStudentsCount,
                'Present': studentDay.present,
                'Absent': studentDay.absent,
                'Late': studentDay.late,
                'On Leave': '-',
                'Attendance Rate': `${studentAttendanceRate}%`
              });
            }

            // Get list of absent teachers
            const absentTeachersResult = await db.execute(sql`
              SELECT 
                t.name,
                t.employee_id,
                t.email,
                t.contact_number,
                ta.attendance_date,
                ta.status
              FROM ${teacherAttendance} ta
              JOIN ${teachers} t ON ta.teacher_id = t.id
              WHERE ta.school_id = ${context.schoolId}
              AND ta.attendance_date >= ${dateRange.start}
              AND ta.attendance_date <= ${dateRange.end}
              AND ta.status = 'absent'
              ORDER BY ta.attendance_date DESC, t.name ASC
            `);
            
            const absentTeachersData = absentTeachersResult.rows.map(row => ({
              'Date': row.attendance_date,
              'Name': row.name,
              'Employee ID': row.employee_id,
              'Email': row.email,
              'Contact Number': row.contact_number,
              'Status': row.status
            }));
            
            // Get list of absent students
            const absentStudentsResult = await db.execute(sql`
              SELECT 
                s.first_name || ' ' || s.last_name as name,
                s.roll_number,
                s.email,
                s.contact_number,
                c.grade,
                c.section,
                sa.attendance_date,
                sa.status
              FROM ${studentAttendance} sa
              JOIN ${students} s ON sa.student_id = s.id
              JOIN ${classes} c ON s.class_id = c.id
              WHERE sa.school_id = ${context.schoolId}
              AND sa.attendance_date >= ${dateRange.start}
              AND sa.attendance_date <= ${dateRange.end}
              AND sa.status = 'absent'
              ORDER BY sa.attendance_date DESC, s.first_name ASC
            `);
            
            const absentStudentsData = absentStudentsResult.rows.map(row => ({
              'Date': row.attendance_date,
              'Name': row.name,
              'Roll Number': row.roll_number,
              'Class': `${row.grade} ${row.section}`,
              'Email': row.email,
              'Contact Number': row.contact_number,
              'Status': row.status
            }));

            // Create workbook with multiple sheets
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Attendance');
            
            // Add absent teachers sheet
            if (absentTeachersData.length > 0) {
              const absentTeachersSheet = XLSX.utils.json_to_sheet(absentTeachersData);
              XLSX.utils.book_append_sheet(workbook, absentTeachersSheet, 'Absent Teachers');
            }
            
            // Add absent students sheet
            if (absentStudentsData.length > 0) {
              const absentStudentsSheet = XLSX.utils.json_to_sheet(absentStudentsData);
              XLSX.utils.book_append_sheet(workbook, absentStudentsSheet, 'Absent Students');
            }
            
            const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            const base64Data = excelBuffer.toString('base64');

            return {
              success: true,
              data: {
                action: 'download_excel',
                actionData: {
                  filename: `attendance_daily_${dateRange.start}_to_${dateRange.end}.xlsx`,
                  base64Data
                }
              },
              message: `Attendance report for ${daysInRange} days (${dateRange.start} to ${dateRange.end}) is ready for download. The date range exceeds 7 days, so I've prepared an Excel file for you.`,
            };
          }

          // FOR REPORTS ≤ 7 DAYS: Show day-by-day breakdown
          
          // Generate array of dates
          const dailyBreakdown: any[] = [];
          const totalTeachersResult = await db.execute(sql`
            SELECT COUNT(DISTINCT id)::int as total FROM ${teachers} 
            WHERE school_id = ${context.schoolId} AND status = 'active'
          `);
          const totalTeachers = totalTeachersResult.rows[0]?.total || 0;
          
          const totalStudentsResult = await db.execute(sql`
            SELECT COUNT(DISTINCT id)::int as total FROM ${students} WHERE school_id = ${context.schoolId}
          `);
          const totalStudents = totalStudentsResult.rows[0]?.total || 0;

          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = getISTDateString(new Date(d));
            
            // Get teacher attendance for this day
            const teacherDayStats = await db.execute(sql`
              SELECT 
                COUNT(*) FILTER (WHERE status = 'present')::int as present,
                COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
                COUNT(*) FILTER (WHERE status = 'late')::int as late,
                COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as on_leave
              FROM ${teacherAttendance}
              WHERE school_id = ${context.schoolId}
              AND attendance_date = ${dateStr}
            `);
            
            // Get student attendance for this day
            const studentDayStats = await db.execute(sql`
              SELECT 
                COUNT(*) FILTER (WHERE status = 'present')::int as present,
                COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
                COUNT(*) FILTER (WHERE status = 'late')::int as late
              FROM ${studentAttendance}
              WHERE school_id = ${context.schoolId}
              AND attendance_date = ${dateStr}
            `);
            
            const tStats = teacherDayStats.rows[0];
            const sStats = studentDayStats.rows[0];
            
            dailyBreakdown.push({
              date: dateStr,
              teachers: {
                total: totalTeachers,
                present: tStats.present || 0,
                absent: tStats.absent || 0,
                late: tStats.late || 0,
                on_leave: tStats.on_leave || 0,
                attendance_rate: totalTeachers > 0 ? Math.round(((tStats.present || 0) / totalTeachers) * 100) : 0
              },
              students: {
                total: totalStudents,
                present: sStats.present || 0,
                absent: sStats.absent || 0,
                late: sStats.late || 0,
                attendance_rate: totalStudents > 0 ? Math.round(((sStats.present || 0) / totalStudents) * 100) : 0
              }
            });
          }

          let teacherStats, studentStats;

          if (filters.teacherId) {
            const teacherResult = await db.execute(sql`
              SELECT 
                COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
                COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
                COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
                COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as leave_count,
                COUNT(*)::int as total_records
              FROM ${teacherAttendance}
              WHERE teacher_id = ${filters.teacherId}
              AND school_id = ${context.schoolId}
              AND attendance_date >= ${dateRange.start}
              AND attendance_date <= ${dateRange.end}
            `);
            const stats = teacherResult.rows[0];
            teacherStats = {
              ...stats,
              total_teachers: 1,
              days_in_range: daysInRange,
              attendance_rate: stats.total_records > 0 
                ? Math.round((stats.present_count / stats.total_records) * 100) 
                : 0
            };
          } else {
            // Use already-fetched total teachers count from daily breakdown
            // const totalTeachers is already declared above

            const teacherResult = await db.execute(sql`
              SELECT 
                COUNT(DISTINCT teacher_id)::int as teachers_with_records,
                COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
                COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
                COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
                COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as leave_count,
                COUNT(*)::int as total_records
              FROM ${teacherAttendance}
              WHERE school_id = ${context.schoolId}
              AND attendance_date >= ${dateRange.start}
              AND attendance_date <= ${dateRange.end}
            `);
            const stats = teacherResult.rows[0];
            teacherStats = {
              ...stats,
              total_teachers: totalTeachers,
              days_in_range: daysInRange,
              expected_records: totalTeachers * daysInRange,
              attendance_rate: stats.total_records > 0 
                ? Math.round((stats.present_count / stats.total_records) * 100) 
                : 0
            };
          }

          const studentWhereClause = filters.classId 
            ? sql`class_id = ${filters.classId} AND school_id = ${context.schoolId}`
            : sql`school_id = ${context.schoolId}`;

          // Get total students count (only re-query if filtered by class, otherwise use existing totalStudents)
          let totalStudentsForStats = totalStudents; // Use already-fetched count
          if (filters.classId) {
            const studentCountResult = await db.execute(sql`
              SELECT COUNT(DISTINCT id)::int as total_students FROM ${students} WHERE class_id = ${filters.classId} AND school_id = ${context.schoolId}
            `);
            totalStudentsForStats = studentCountResult.rows[0]?.total_students || 0;
          }

          const studentResult = await db.execute(sql`
            SELECT 
              COUNT(DISTINCT student_id)::int as students_with_records,
              COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
              COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
              COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
              COUNT(*)::int as total_records
            FROM ${studentAttendance}
            WHERE ${studentWhereClause}
            AND attendance_date >= ${dateRange.start}
            AND attendance_date <= ${dateRange.end}
          `);
          const studentStatsRaw = studentResult.rows[0];
          studentStats = {
            ...studentStatsRaw,
            total_students: totalStudentsForStats,
            days_in_range: daysInRange,
            expected_records: totalStudentsForStats * daysInRange,
            attendance_rate: studentStatsRaw.total_records > 0 
              ? Math.round((studentStatsRaw.present_count / studentStatsRaw.total_records) * 100) 
              : 0
          };

          // Also generate Excel export data for the button
          const XLSX = await import('xlsx');
          
          // Prepare export data with daily breakdown (filterable format)
          const exportData: any[] = [];
          
          // Add daily breakdown rows
          for (const day of dailyBreakdown) {
            // Teacher row for this day
            exportData.push({
              'Date': day.date,
              'Category': 'Teachers',
              'Total': day.teachers.total,
              'Present': day.teachers.present,
              'Absent': day.teachers.absent,
              'Late': day.teachers.late,
              'On Leave': day.teachers.on_leave,
              'Attendance Rate': `${day.teachers.attendance_rate}%`
            });
            
            // Student row for this day
            exportData.push({
              'Date': day.date,
              'Category': 'Students',
              'Total': day.students.total,
              'Present': day.students.present,
              'Absent': day.students.absent,
              'Late': day.students.late,
              'On Leave': '-',
              'Attendance Rate': `${day.students.attendance_rate}%`
            });
          }
          
          // Get list of absent teachers
          const absentTeachersResult = await db.execute(sql`
            SELECT 
              t.name,
              t.employee_id,
              t.email,
              t.contact_number,
              ta.attendance_date,
              ta.status
            FROM ${teacherAttendance} ta
            JOIN ${teachers} t ON ta.teacher_id = t.id
            WHERE ta.school_id = ${context.schoolId}
            AND ta.attendance_date >= ${dateRange.start}
            AND ta.attendance_date <= ${dateRange.end}
            AND ta.status = 'absent'
            ORDER BY ta.attendance_date DESC, t.name ASC
          `);
          
          const absentTeachersData = absentTeachersResult.rows.map(row => ({
            'Date': row.attendance_date,
            'Name': row.name,
            'Employee ID': row.employee_id,
            'Email': row.email,
            'Contact Number': row.contact_number,
            'Status': row.status
          }));
          
          // Get list of absent students
          const absentStudentsResult = await db.execute(sql`
            SELECT 
              s.first_name || ' ' || s.last_name as name,
              s.roll_number,
              s.email,
              s.contact_number,
              c.grade,
              c.section,
              sa.attendance_date,
              sa.status
            FROM ${studentAttendance} sa
            JOIN ${students} s ON sa.student_id = s.id
            JOIN ${classes} c ON s.class_id = c.id
            WHERE sa.school_id = ${context.schoolId}
            AND sa.attendance_date >= ${dateRange.start}
            AND sa.attendance_date <= ${dateRange.end}
            AND sa.status = 'absent'
            ORDER BY sa.attendance_date DESC, s.first_name ASC
          `);
          
          const absentStudentsData = absentStudentsResult.rows.map(row => ({
            'Date': row.attendance_date,
            'Name': row.name,
            'Roll Number': row.roll_number,
            'Class': `${row.grade} ${row.section}`,
            'Email': row.email,
            'Contact Number': row.contact_number,
            'Status': row.status
          }));

          // Create workbook with multiple sheets
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Attendance');
          
          // Add absent teachers sheet
          if (absentTeachersData.length > 0) {
            const absentTeachersSheet = XLSX.utils.json_to_sheet(absentTeachersData);
            XLSX.utils.book_append_sheet(workbook, absentTeachersSheet, 'Absent Teachers');
          }
          
          // Add absent students sheet
          if (absentStudentsData.length > 0) {
            const absentStudentsSheet = XLSX.utils.json_to_sheet(absentStudentsData);
            XLSX.utils.book_append_sheet(workbook, absentStudentsSheet, 'Absent Students');
          }
          
          // Generate buffer and base64
          const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          const base64Data = excelBuffer.toString('base64');

          return {
            success: true,
            data: {
              action: 'show_attendance_report', // Special action to show report with export button
              actionData: {
                dateRange,
                teachers: teacherStats,
                students: studentStats,
                dailyBreakdown, // Include day-by-day breakdown for ≤ 7 days
                exportData: {
                  filename: `attendance_summary_${dateRange.start}_to_${dateRange.end}.xlsx`,
                  base64Data
                }
              }
            },
            message: `Attendance summary from ${dateRange.start} to ${dateRange.end} (${daysInRange} days)`,
          };
        }

        case 'teacher_workload': {
          const workloadQuery = filters.teacherId
            ? await db.query.classSubjectAssignments.findMany({
                where: eq(classSubjectAssignments.assignedTeacherId, filters.teacherId),
                with: {
                  teacher: { columns: { name: true, employeeId: true } },
                  class: { columns: { grade: true, section: true } },
                  subject: { columns: { name: true, code: true } },
                },
              })
            : await db.query.teachers.findMany({
                where: eq(teachers.schoolId, context.schoolId),
                with: {
                  classSubjectAssignments: {
                    with: {
                      class: { columns: { grade: true, section: true } },
                      subject: { columns: { name: true, code: true } },
                    },
                  },
                },
              });

          if (filters.teacherId) {
            const totalPeriods = workloadQuery.reduce((sum, a) => sum + (a.weeklyFrequency || 0), 0);
            const teacherData = workloadQuery[0]?.teacher;
            
            return {
              success: true,
              data: {
                teacher: teacherData ? { name: teacherData.name, employeeId: teacherData.employeeId } : null,
                assignments: workloadQuery.map(a => {
                  const classData = !Array.isArray(a.class) ? a.class : null;
                  const subjectData = !Array.isArray(a.subject) ? a.subject : null;
                  return {
                    className: classData ? getClassName(classData.grade, classData.section) : 'Unknown',
                    subject: subjectData?.name || 'Unknown',
                    periodsPerWeek: a.weeklyFrequency || 0,
                  };
                }),
                totalPeriodsPerWeek: totalPeriods,
                totalClassesAssigned: workloadQuery.length,
              },
              message: `Workload for teacher`,
            };
          } else {
            const workloadData = workloadQuery.map(teacher => {
              const assignments = !Array.isArray(teacher.classSubjectAssignments) ? [] : teacher.classSubjectAssignments;
              const totalPeriods = assignments.reduce((sum: number, a: any) => sum + (a.weeklyFrequency || 0), 0);
              return {
                teacherId: teacher.id,
                teacherName: teacher.name,
                employeeId: teacher.employeeId,
                totalPeriodsPerWeek: totalPeriods,
                totalClassesAssigned: assignments.length,
              };
            });

            return {
              success: true,
              data: workloadData,
              message: `Workload summary for ${workloadData.length} teachers`,
            };
          }
        }

        case 'class_list': {
          if (!filters.classId) {
            return { success: false, error: 'classId filter is required for class_list report' };
          }

          const classData = await db.query.classes.findFirst({
            where: eq(classes.id, filters.classId),
          });

          const studentsList = await db.query.students.findMany({
            where: eq(students.classId, filters.classId),
          });

          return {
            success: true,
            data: {
              class: classData ? {
                id: classData.id,
                name: getClassName(classData.grade, classData.section),
                grade: classData.grade,
                section: classData.section,
                room: classData.room,
              } : null,
              students: studentsList.map(s => ({
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                admissionNumber: s.admissionNumber,
                rollNumber: s.rollNumber,
                email: s.email,
                contactNumber: s.contactNumber,
              })),
              totalStudents: studentsList.length,
            },
            message: `Found ${studentsList.length} students in class`,
          };
        }

        case 'student_list': {
          let query = eq(students.schoolId, context.schoolId);
          
          if (filters.classId) {
            query = and(query, eq(students.classId, filters.classId));
          }
          if (filters.grade) {
            const classesList = await db.query.classes.findMany({
              where: and(
                eq(classes.schoolId, context.schoolId),
                eq(classes.grade, filters.grade)
              ),
            });
            const classIds = classesList.map(c => c.id);
            if (classIds.length > 0) {
              query = and(query, or(...classIds.map(id => eq(students.classId, id))));
            }
          }

          const studentsList = await db.query.students.findMany({
            where: query,
            with: {
              class: { columns: { grade: true, section: true } },
            },
          });

          return {
            success: true,
            data: studentsList.map(s => {
              const classData = s.class && !Array.isArray(s.class) ? s.class : null;
              return {
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                admissionNumber: s.admissionNumber,
                className: classData ? getClassName(classData.grade, classData.section) : null,
                email: s.email,
                contactNumber: s.contactNumber,
                status: s.status,
              };
            }),
            message: `Found ${studentsList.length} students`,
          };
        }

        case 'teacher_list': {
          const teachersList = await db.query.teachers.findMany({
            where: eq(teachers.schoolId, context.schoolId),
          });

          return {
            success: true,
            data: teachersList.map(t => ({
              id: t.id,
              name: t.name,
              employeeId: t.employeeId,
              email: t.email,
              contactNumber: t.contactNumber,
              designation: t.designation,
              status: t.status,
            })),
            message: `Found ${teachersList.length} teachers`,
          };
        }

        case 'absent_today': {
          const today = getISTDateString(new Date());

          const absentTeachers = await db.query.teacherAttendance.findMany({
            where: and(
              eq(teacherAttendance.schoolId, context.schoolId),
              eq(teacherAttendance.attendanceDate, today),
              or(
                eq(teacherAttendance.status, 'absent'),
                eq(teacherAttendance.status, 'on_leave'),
                eq(teacherAttendance.status, 'medical_leave'),
                eq(teacherAttendance.status, 'personal_leave')
              )
            ),
            with: {
              teacher: { columns: { name: true, employeeId: true } },
            },
          });

          const absentStudents = await db.query.studentAttendance.findMany({
            where: and(
              eq(studentAttendance.schoolId, context.schoolId),
              eq(studentAttendance.attendanceDate, today),
              eq(studentAttendance.status, 'absent')
            ),
            with: {
              student: { 
                columns: { firstName: true, lastName: true, admissionNumber: true },
                with: { class: { columns: { grade: true, section: true } } },
              },
            },
          });

          return {
            success: true,
            data: {
              date: today,
              absentTeachers: absentTeachers.map(at => {
                const teacher = !Array.isArray(at.teacher) ? at.teacher : null;
                return {
                  name: teacher?.name || 'Unknown',
                  employeeId: teacher?.employeeId || '',
                  status: at.status,
                  reason: at.reason,
                };
              }),
              absentStudents: absentStudents.map(as => {
                const student = !Array.isArray(as.student) ? as.student : null;
                const classData = student?.class && !Array.isArray(student.class) ? student.class : null;
                return {
                  name: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
                  admissionNumber: student?.admissionNumber || '',
                  className: classData ? getClassName(classData.grade, classData.section) : null,
                };
              }),
              totalAbsentTeachers: absentTeachers.length,
              totalAbsentStudents: absentStudents.length,
            },
            message: `Absent report for ${today}`,
          };
        }

        case 'attendance_overview': {
          const today = getISTDateString(new Date());

          const totalTeachersResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(teachers)
            .where(eq(teachers.schoolId, context.schoolId));
          const totalTeachers = totalTeachersResult[0]?.count || 0;

          const totalStudentsResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(students)
            .where(eq(students.schoolId, context.schoolId));
          const totalStudents = totalStudentsResult[0]?.count || 0;

          const teacherAttendanceToday = await db.execute(sql`
            SELECT 
              COUNT(*) FILTER (WHERE status = 'present')::int as present,
              COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
              COUNT(*) FILTER (WHERE status = 'late')::int as late,
              COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as on_leave
            FROM ${teacherAttendance}
            WHERE school_id = ${context.schoolId}
            AND attendance_date = ${today}
          `);

          const studentAttendanceToday = await db.execute(sql`
            SELECT 
              COUNT(*) FILTER (WHERE status = 'present')::int as present,
              COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
              COUNT(*) FILTER (WHERE status = 'late')::int as late
            FROM ${studentAttendance}
            WHERE school_id = ${context.schoolId}
            AND attendance_date = ${today}
          `);

          // Fetch absent teachers for detailed list
          const absentTeachers = await db.query.teacherAttendance.findMany({
            where: and(
              eq(teacherAttendance.schoolId, context.schoolId),
              eq(teacherAttendance.attendanceDate, today),
              eq(teacherAttendance.status, 'absent')
            ),
            with: {
              teacher: { columns: { name: true } },
            },
          });

          const teacherStats: any = teacherAttendanceToday.rows[0] || {};
          const studentStats: any = studentAttendanceToday.rows[0] || {};
          
          const teacherPresent = teacherStats.present || 0;
          const studentPresent = studentStats.present || 0;
          
          const teacherPercentage = totalTeachers > 0 ? Math.round((teacherPresent / totalTeachers) * 100) : 0;
          const studentPercentage = totalStudents > 0 ? Math.round((studentPresent / totalStudents) * 100) : 0;
          
          // Format date as "22 Oct 2025"
          const dateObj = new Date(today);
          const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          
          // Build message
          let message = `📅 ${formattedDate} | Attendance Overview\n\n`;
          message += `👩‍🏫 Teachers → ${teacherPresent}/${totalTeachers} Present (${teacherPercentage}%)\n`;
          message += `👨‍🎓 Students → ${studentPresent}/${totalStudents} Present (${studentPercentage}%)`;
          
          // Add absent teachers list if any
          if (absentTeachers.length > 0) {
            message += `\n\n🔍 Teachers Absent Today\n`;
            absentTeachers.forEach((at, index) => {
              const teacher = !Array.isArray(at.teacher) ? at.teacher : null;
              const teacherName = teacher?.name || 'Unknown';
              message += `${String.fromCharCode(97 + index)}. ${teacherName}\n`;
            });
          }

          return {
            success: true,
            data: {
              date: today,
              teachers: {
                total: totalTeachers,
                present: teacherPresent,
                absent: teacherStats.absent || 0,
                late: teacherStats.late || 0,
                onLeave: teacherStats.on_leave || 0,
                notMarked: totalTeachers - ((teacherPresent) + (teacherStats.absent || 0) + (teacherStats.late || 0) + (teacherStats.on_leave || 0)),
              },
              students: {
                total: totalStudents,
                present: studentPresent,
                absent: studentStats.absent || 0,
                late: studentStats.late || 0,
                notMarked: totalStudents - ((studentPresent) + (studentStats.absent || 0) + (studentStats.late || 0)),
              },
            },
            message: message.trim(),
          };
        }

        default:
          return {
            success: false,
            error: `Unknown report type: ${reportType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate report: ${error.message}`,
      };
    }
  }

  /**
   * Query school data
   */
  private static async handleQuerySchoolData(
    params: { query: string; scope?: string; timeframe?: string },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { query, scope = 'all', timeframe } = params;

    try {
      const { startDate, endDate } = this.parseTimeframe(timeframe);
      const queryLower = query.toLowerCase();

      if (scope === 'attendance' || queryLower.includes('attendance') || queryLower.includes('absent') || queryLower.includes('present')) {
        const teacherAttendanceResult = await db.execute(sql`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
            COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
            COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
            COUNT(*) FILTER (WHERE status IN ('on_leave', 'medical_leave', 'personal_leave'))::int as leave_count,
            COUNT(*)::int as total_records
          FROM ${teacherAttendance}
          WHERE school_id = ${context.schoolId}
          AND attendance_date >= ${startDate}
          AND attendance_date <= ${endDate}
        `);

        const studentAttendanceResult = await db.execute(sql`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'present')::int as present_count,
            COUNT(*) FILTER (WHERE status = 'absent')::int as absent_count,
            COUNT(*) FILTER (WHERE status = 'late')::int as late_count,
            COUNT(*)::int as total_records
          FROM ${studentAttendance}
          WHERE school_id = ${context.schoolId}
          AND attendance_date >= ${startDate}
          AND attendance_date <= ${endDate}
        `);

        const teacherData = teacherAttendanceResult.rows[0];
        const studentData = studentAttendanceResult.rows[0];

        // Fetch names for absent students if requested
        let absentStudentsList: any[] = [];
        // Use scope parameter if provided, otherwise fall back to keyword detection
        const isQueryingStudents = scope === 'students' || queryLower.includes('student');
        if (isQueryingStudents && queryLower.includes('absent')) {
          const absentStudentsData = await db.execute(sql`
            SELECT s.first_name, s.last_name, c.grade, c.section, sa.status
            FROM ${studentAttendance} sa
            JOIN ${students} s ON sa.student_id = s.id
            LEFT JOIN ${classes} c ON s.class_id = c.id
            WHERE sa.school_id = ${context.schoolId}
            AND sa.attendance_date >= ${startDate}
            AND sa.attendance_date <= ${endDate}
            AND sa.status = 'absent'
            ORDER BY s.first_name, s.last_name
          `);
          absentStudentsList = absentStudentsData.rows.map((row: any) => ({
            name: `${row.first_name} ${row.last_name}`,
            class: row.grade && row.section ? getClassName(row.grade, row.section) : 'N/A',
          }));
        }

        // Fetch absent teacher names only when query is about teachers (not students)
        let absentTeachersList: any[] = [];
        
        // Use scope parameter if provided, otherwise fall back to keyword detection
        const isAboutStudents = scope === 'students' || queryLower.includes('student') || queryLower.includes('pupil');
        const isAboutTeachers = scope === 'teachers' || queryLower.includes('teacher') || queryLower.includes('staff') || queryLower.includes('faculty');
        const needsDetails = queryLower.includes('name') || queryLower.includes('who') || queryLower.includes('show') || queryLower.includes('list');
        
        // Fetch teacher names if: explicitly about teachers OR asking for details but NOT about students
        if (isAboutTeachers || (needsDetails && !isAboutStudents && queryLower.includes('absent'))) {
          const absentTeachersData = await db.execute(sql`
            SELECT DISTINCT t.name, t.employee_id
            FROM ${teacherAttendance} ta
            JOIN ${teachers} t ON ta.teacher_id = t.id
            WHERE ta.school_id = ${context.schoolId}
            AND ta.attendance_date >= ${startDate}
            AND ta.attendance_date <= ${endDate}
            AND ta.status = 'absent'
            ORDER BY t.name
          `);
          absentTeachersList = absentTeachersData.rows.map((row: any) => ({
            name: row.name,
            employeeId: row.employee_id,
          }));
        }

        // Generate a clear, specific message based on the query
        let message = `Attendance data from ${startDate} to ${endDate}`;
        
        // Determine the time reference from the query
        const timeRef = queryLower.includes('yesterday') ? 'yesterday' : 
                       queryLower.includes('last week') ? 'last week' :
                       queryLower.includes('this week') ? 'this week' : 'today';
        
        // Check for teacher queries FIRST (higher priority)
        if (isAboutTeachers && (queryLower.includes('absent') || queryLower.includes('name') || queryLower.includes('who'))) {
          const count = teacherData?.absent_count || 0;
          const totalRecords = teacherData?.total_records || 0;
          
          if (totalRecords === 0) {
            message = `No attendance data available for ${timeRef}.`;
          } else if (count === 0) {
            message = `No teachers are absent ${timeRef}.`;
          } else {
            // Include names in the message if we have them
            if (absentTeachersList.length > 0) {
              const teacherNames = absentTeachersList.map(t => t.name).join(', ');
              message = count === 1 
                ? `${teacherNames} is absent ${timeRef}.`
                : `${count} teachers are absent ${timeRef}: ${teacherNames}`;
            } else {
              message = count === 1 
                ? `1 teacher is absent ${timeRef}.`
                : `${count} teachers are absent ${timeRef}.`;
            }
          }
        } else if (queryLower.includes('teacher') && queryLower.includes('present')) {
          const count = teacherData?.present_count || 0;
          message = `${count} teachers are present ${timeRef}.`;
        } else if (queryLower.includes('student') && queryLower.includes('absent')) {
          const count = studentData?.absent_count || 0;
          const totalRecords = studentData?.total_records || 0;
          
          if (totalRecords === 0) {
            message = `No attendance data available for ${timeRef}.`;
          } else {
            message = count === 0 
              ? `No students are absent ${timeRef}.`
              : count === 1 
              ? `1 student is absent ${timeRef}.`
              : `${count} students are absent ${timeRef}.`;
          }
        } else if (queryLower.includes('student') && queryLower.includes('present')) {
          const count = studentData?.present_count || 0;
          message = `${count} students are present ${timeRef}.`;
        }

        // Build response data based on what was queried
        const responseData: any = {
          query,
          scope: 'attendance',
          timeframe: { start: startDate, end: endDate },
        };
        
        console.log('[ATTENDANCE QUERY]', {
          query: queryLower,
          isAboutStudents,
          isAboutTeachers,
          willIncludeTeachers: isAboutTeachers || !isAboutStudents,
          willIncludeStudents: isAboutStudents || !isAboutTeachers,
        });
        
        // Only include teacher data if explicitly about teachers
        if (isAboutTeachers && !isAboutStudents) {
          responseData.teachers = teacherData;
          if (absentTeachersList.length > 0) {
            responseData.absentTeachers = absentTeachersList;
          }
        }
        
        // Only include student data if explicitly about students  
        if (isAboutStudents && !isAboutTeachers) {
          responseData.students = studentData;
          if (absentStudentsList.length > 0) {
            responseData.absentStudents = absentStudentsList;
          }
        }
        
        // If neither specified OR both specified, include both
        if ((!isAboutStudents && !isAboutTeachers) || (isAboutStudents && isAboutTeachers)) {
          responseData.teachers = teacherData;
          responseData.students = studentData;
          if (absentTeachersList.length > 0) {
            responseData.absentTeachers = absentTeachersList;
          }
          if (absentStudentsList.length > 0) {
            responseData.absentStudents = absentStudentsList;
          }
        }

        return {
          success: true,
          data: responseData,
          message,
        };
      }

      if (scope === 'students' || queryLower.includes('student')) {
        let studentQuery = eq(students.schoolId, context.schoolId);

        if (queryLower.includes('count') || queryLower.includes('how many') || queryLower.includes('total')) {
          const totalStudentsResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(students)
            .where(studentQuery);
          const totalStudents = totalStudentsResult[0]?.count || 0;

          const byClass = await db.execute(sql`
            SELECT c.grade, c.section, COUNT(s.id)::int as student_count
            FROM ${students} s
            LEFT JOIN ${classes} c ON s.class_id = c.id
            WHERE s.school_id = ${context.schoolId}
            GROUP BY c.grade, c.section
            ORDER BY c.grade, c.section
          `);

          return {
            success: true,
            data: {
              query,
              scope: 'students',
              totalStudents,
              byClass: byClass.rows,
            },
            message: `Found ${totalStudents} students`,
          };
        }

        if (queryLower.includes('active') || queryLower.includes('status')) {
          const statusBreakdown = await db.execute(sql`
            SELECT status, COUNT(*)::int as count
            FROM ${students}
            WHERE school_id = ${context.schoolId}
            GROUP BY status
          `);

          return {
            success: true,
            data: {
              query,
              scope: 'students',
              statusBreakdown: statusBreakdown.rows,
            },
            message: 'Student status breakdown',
          };
        }

        const studentsList = await db.query.students.findMany({
          where: studentQuery,
          limit: 20,
          with: {
            class: { columns: { grade: true, section: true } },
          },
        });

        return {
          success: true,
          data: {
            query,
            scope: 'students',
            students: studentsList.map(s => {
              const classData = s.class && !Array.isArray(s.class) ? s.class : null;
              return {
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                admissionNumber: s.admissionNumber,
                className: classData ? getClassName(classData.grade, classData.section) : null,
              };
            }),
            total: studentsList.length,
          },
          message: `Found ${studentsList.length} students (showing first 20)`,
        };
      }

      if (scope === 'teachers' || queryLower.includes('teacher')) {
        if (queryLower.includes('count') || queryLower.includes('how many') || queryLower.includes('total')) {
          const totalTeachersResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(teachers)
            .where(eq(teachers.schoolId, context.schoolId));
          const totalTeachers = totalTeachersResult[0]?.count || 0;

          const statusBreakdown = await db.execute(sql`
            SELECT status, COUNT(*)::int as count
            FROM ${teachers}
            WHERE school_id = ${context.schoolId}
            GROUP BY status
          `);

          return {
            success: true,
            data: {
              query,
              scope: 'teachers',
              totalTeachers,
              statusBreakdown: statusBreakdown.rows,
            },
            message: `Found ${totalTeachers} teachers`,
          };
        }

        if (queryLower.includes('workload') || queryLower.includes('load') || queryLower.includes('assigned')) {
          const workloadData = await db.execute(sql`
            SELECT 
              t.id,
              t.name,
              t.employee_id,
              COUNT(csa.id)::int as total_assignments,
              COALESCE(SUM(csa.weekly_frequency), 0)::int as total_periods
            FROM ${teachers} t
            LEFT JOIN ${classSubjectAssignments} csa ON t.id = csa.assigned_teacher_id
            WHERE t.school_id = ${context.schoolId}
            GROUP BY t.id, t.name, t.employee_id
            ORDER BY total_periods DESC
            LIMIT 20
          `);

          return {
            success: true,
            data: {
              query,
              scope: 'teachers',
              workload: workloadData.rows,
            },
            message: 'Teacher workload data',
          };
        }

        const teachersList = await db.query.teachers.findMany({
          where: eq(teachers.schoolId, context.schoolId),
          limit: 20,
        });

        return {
          success: true,
          data: {
            query,
            scope: 'teachers',
            teachers: teachersList.map(t => ({
              id: t.id,
              name: t.name,
              employeeId: t.employeeId,
              designation: t.designation,
            })),
            total: teachersList.length,
          },
          message: `Found ${teachersList.length} teachers (showing first 20)`,
        };
      }

      if (scope === 'classes' || queryLower.includes('class')) {
        const classesList = await db.query.classes.findMany({
          where: eq(classes.schoolId, context.schoolId),
        });

        const classData = await db.execute(sql`
          SELECT 
            c.id,
            c.grade,
            c.section,
            c.room,
            COUNT(s.id)::int as student_count
          FROM ${classes} c
          LEFT JOIN ${students} s ON c.id = s.class_id
          WHERE c.school_id = ${context.schoolId}
          GROUP BY c.id, c.grade, c.section, c.room
          ORDER BY c.grade, c.section
        `);

        return {
          success: true,
          data: {
            query,
            scope: 'classes',
            classes: classData.rows,
            totalClasses: classesList.length,
          },
          message: `Found ${classesList.length} classes`,
        };
      }

      if (queryLower.includes('absent') && (queryLower.includes('today') || queryLower.includes('currently'))) {
        const today = getISTDateString(new Date());

        const absentTeachers = await db.query.teacherAttendance.findMany({
          where: and(
            eq(teacherAttendance.schoolId, context.schoolId),
            eq(teacherAttendance.attendanceDate, today),
            or(
              eq(teacherAttendance.status, 'absent'),
              eq(teacherAttendance.status, 'on_leave'),
              eq(teacherAttendance.status, 'medical_leave'),
              eq(teacherAttendance.status, 'personal_leave')
            )
          ),
          with: {
            teacher: { columns: { name: true, employeeId: true } },
          },
        });

        const absentStudents = await db.query.studentAttendance.findMany({
          where: and(
            eq(studentAttendance.schoolId, context.schoolId),
            eq(studentAttendance.attendanceDate, today),
            eq(studentAttendance.status, 'absent')
          ),
          with: {
            student: { 
              columns: { firstName: true, lastName: true, admissionNumber: true },
              with: { class: { columns: { grade: true, section: true } } },
            },
          },
        });

        return {
          success: true,
          data: {
            query,
            scope: 'absence',
            date: today,
            absentTeachers: absentTeachers.map(at => {
              const teacher = !Array.isArray(at.teacher) ? at.teacher : null;
              return {
                name: teacher?.name || 'Unknown',
                employeeId: teacher?.employeeId || '',
                status: at.status,
              };
            }),
            absentStudents: absentStudents.map(as => {
              const student = !Array.isArray(as.student) ? as.student : null;
              const classData = student?.class && !Array.isArray(student.class) ? student.class : null;
              return {
                name: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
                admissionNumber: student?.admissionNumber || '',
                className: classData ? getClassName(classData.grade, classData.section) : null,
              };
            }),
          },
          message: `Absent data for ${today}`,
        };
      }

      return {
        success: true,
        data: {
          query,
          scope,
          message: 'Query processed. Please be more specific or use a defined scope (students, teachers, attendance, classes).',
        },
        message: 'General query processed',
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to query school data: ${error.message}`,
      };
    }
  }

  private static parseTimeframe(timeframe?: string): { startDate: string; endDate: string } {
    const today = new Date();
    const todayStr = getISTDateString(today);

    if (!timeframe || timeframe === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }

    if (timeframe === 'yesterday') {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = getISTDateString(yesterday);
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    }

    if (timeframe === 'this week') {
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      return { startDate: getISTDateString(weekStart), endDate: todayStr };
    }

    if (timeframe === 'last week') {
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diff - 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return { startDate: getISTDateString(weekStart), endDate: getISTDateString(weekEnd) };
    }

    if (timeframe === 'this month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: getISTDateString(monthStart), endDate: todayStr };
    }

    if (timeframe === 'last month') {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: getISTDateString(lastMonthStart), endDate: getISTDateString(lastMonthEnd) };
    }

    return { startDate: todayStr, endDate: todayStr };
  }

  /**
   * Helper: Resolve class name to UUID
   * Converts user-friendly class names like "1A", "10-B", "Playschool-A" to actual class UUID
   */
  private static async resolveClassNameToId(
    className: string,
    schoolId: string
  ): Promise<string | null> {
    // Try to parse the class name
    // Patterns: "1A" -> Class 1-A, "10B" -> Class 10-B, "Playschool-A" -> Playschool-A
    
    // First check if it's already a UUID (starts with valid UUID pattern)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(className)) {
      return className; // Already a UUID
    }

    // Parse class name patterns
    let grade: string | null = null;
    let section: string | null = null;

    // Pattern 1: "1A", "2B", "10C" (grade + section without separator)
    const match1 = className.match(/^(\d+)([A-Z])$/i);
    if (match1) {
      grade = match1[1]; // Just the number, e.g., "1", "10"
      section = match1[2].toUpperCase();
    }

    // Pattern 2: "1-A", "10-B" (grade-section with dash)
    const match2 = className.match(/^(\d+)-([A-Z])$/i);
    if (match2) {
      grade = match2[1]; // Just the number, e.g., "1", "10"
      section = match2[2].toUpperCase();
    }

    // Pattern 3: "Playschool-A", "Nursery-B"
    const match3 = className.match(/^([A-Za-z]+)-([A-Z])$/i);
    if (match3) {
      grade = match3[1].charAt(0).toUpperCase() + match3[1].slice(1).toLowerCase();
      section = match3[2].toUpperCase();
    }

    if (!grade || !section) {
      return null; // Could not parse
    }

    // Look up the class
    const classRecord = await db.query.classes.findFirst({
      where: and(
        eq(classes.schoolId, schoolId),
        eq(classes.grade, grade),
        eq(classes.section, section)
      ),
      columns: { id: true },
    });

    return classRecord?.id || null;
  }

  /**
   * List entities
   */
  private static async handleListEntities(
    params: { entityType: string; filters?: any; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { entityType, filters = {}, limit = 10 } = params;

    switch (entityType) {
      case 'students': {
        // Build where conditions for students
        const conditions: any[] = [eq(students.schoolId, context.schoolId)];
        
        if (filters.classId) {
          // Resolve class name to UUID if needed
          const resolvedClassId = await this.resolveClassNameToId(filters.classId, context.schoolId);
          
          if (!resolvedClassId) {
            return {
              success: true,
              data: [],
              message: `No class found matching "${filters.classId}" in this school.`,
              metadata: {
                totalCount: 0,
                returned: 0,
                limit,
                redirectUrl: '/students',
                redirectLabel: 'View all students',
              },
            };
          }
          
          conditions.push(eq(students.classId, resolvedClassId));
        }

        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

        // Get total count with same filters
        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(students)
          .where(whereClause)
          .then(result => result[0]?.count || 0);

        const studentsList = await db.query.students.findMany({
          where: whereClause,
          limit,
          with: {
            class: {
              columns: { grade: true, section: true },
            },
          },
        });

        const messagePrefix = filters.classId 
          ? `Found ${totalCount} student${totalCount !== 1 ? 's' : ''} in this class.`
          : `The school has ${totalCount} students in total.`;

        return {
          success: true,
          data: studentsList.map(s => {
            const classData = s.class && !Array.isArray(s.class) ? s.class : null;
            return {
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              admissionNumber: s.admissionNumber,
              className: classData ? getClassName(classData.grade, classData.section) : null,
            };
          }),
          message: messagePrefix,
          metadata: {
            totalCount,
            returned: studentsList.length,
            limit,
            redirectUrl: '/students',
            redirectLabel: 'Click here to view list',
          },
        };
      }

      case 'teachers': {
        if (filters.classId) {
          // Resolve class name to UUID if needed
          const resolvedClassId = await this.resolveClassNameToId(filters.classId, context.schoolId);
          
          if (!resolvedClassId) {
            return {
              success: true,
              data: [],
              message: `No class found matching "${filters.classId}" in this school.`,
              metadata: {
                totalCount: 0,
                returned: 0,
                limit,
                redirectUrl: '/teachers',
                redirectLabel: 'View all teachers',
              },
            };
          }

          // For teachers filtered by class, we need to join with classSubjectAssignments
          // Get the class info for the message
          const classExists = await db.query.classes.findFirst({
            where: and(
              eq(classes.schoolId, context.schoolId),
              eq(classes.id, resolvedClassId)
            ),
            columns: { grade: true, section: true },
          });

          // Get distinct teachers who teach this class
          const teachersForClass = await db
            .selectDistinct({
              id: teachers.id,
              name: teachers.name,
              email: teachers.email,
              employeeId: teachers.employeeId,
              schoolIdNumber: teachers.schoolIdNumber,
            })
            .from(classSubjectAssignments)
            .innerJoin(teachers, eq(classSubjectAssignments.assignedTeacherId, teachers.id))
            .where(
              and(
                eq(classSubjectAssignments.classId, resolvedClassId),
                eq(teachers.schoolId, context.schoolId)
              )
            )
            .limit(limit);

          // Get total count of unique teachers for this class
          const totalCountResult = await db
            .select({ count: sql<number>`count(distinct ${teachers.id})` })
            .from(classSubjectAssignments)
            .innerJoin(teachers, eq(classSubjectAssignments.assignedTeacherId, teachers.id))
            .where(
              and(
                eq(classSubjectAssignments.classId, resolvedClassId),
                eq(teachers.schoolId, context.schoolId)
              )
            )
            .then(result => result[0]?.count || 0);

          const className = getClassName(classExists.grade, classExists.section);

          return {
            success: true,
            data: teachersForClass,
            message: `Found ${totalCountResult} teacher${totalCountResult !== 1 ? 's' : ''} teaching ${className}.`,
            metadata: {
              totalCount: totalCountResult,
              returned: teachersForClass.length,
              limit,
              redirectUrl: '/teachers',
              redirectLabel: 'Click here to view list',
            },
          };
        } else {
          // No filter - return all teachers
          const totalCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(teachers)
            .where(eq(teachers.schoolId, context.schoolId))
            .then(result => result[0]?.count || 0);

          const teachersList = await db.query.teachers.findMany({
            where: eq(teachers.schoolId, context.schoolId),
            limit,
          });

          return {
            success: true,
            data: teachersList.map(t => ({
              id: t.id,
              name: t.name,
              email: t.email,
              employeeId: t.employeeId,
              schoolIdNumber: t.schoolIdNumber,
            })),
            message: `The school has ${totalCount} teachers in total.`,
            metadata: {
              totalCount,
              returned: teachersList.length,
              limit,
              redirectUrl: '/teachers',
              redirectLabel: 'Click here to view list',
            },
          };
        }
      }

      case 'classes': {
        const classesList = await db.query.classes.findMany({
          where: eq(classes.schoolId, context.schoolId),
          limit,
        });

        return {
          success: true,
          data: classesList.map(c => ({
            id: c.id,
            name: getClassName(c.grade, c.section),
            grade: c.grade,
            section: c.section,
            room: c.room,
          })),
          message: `Found ${classesList.length} classes`,
        };
      }

      case 'subjects': {
        const subjectsList = await db.query.subjects.findMany({
          where: eq(subjects.schoolId, context.schoolId),
          limit,
        });

        return {
          success: true,
          data: subjectsList.map(s => ({
            id: s.id,
            name: s.name,
            code: s.code,
          })),
          message: `Found ${subjectsList.length} subjects`,
        };
      }

      default:
        return {
          success: false,
          error: `Unknown entity type: ${entityType}`,
        };
    }
  }

  /**
   * Fetch fee data - PHASE 2
   */
  private static async handleFetchFeeData(
    params: { dataType: string; filters?: any; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { storage } = await import("../storage");
    const { dataType, filters = {}, limit = 20 } = params;

    try {
      switch (dataType) {
        case 'invoices': {
          const invoices = await storage.getFeeInvoices(context.schoolId);
          let filteredInvoices = invoices;

          if (filters.studentId) {
            filteredInvoices = filteredInvoices.filter(inv => inv.studentId === filters.studentId);
          }
          if (filters.status) {
            filteredInvoices = filteredInvoices.filter(inv => inv.status === filters.status);
          }

          return {
            success: true,
            data: filteredInvoices.slice(0, limit),
            message: `Found ${filteredInvoices.length} fee invoices`,
          };
        }

        case 'payments': {
          const payments = await storage.getAllFeePayments(context.schoolId);
          return {
            success: true,
            data: payments.slice(0, limit),
            message: `Found ${payments.length} fee payments`,
          };
        }

        case 'outstanding': {
          const invoices = await storage.getFeeInvoices(context.schoolId);
          const outstanding = invoices.filter(inv => inv.status !== 'paid');
          return {
            success: true,
            data: outstanding.slice(0, limit),
            message: `Found ${outstanding.length} outstanding fee invoices`,
          };
        }

        case 'summary': {
          const invoices = await storage.getFeeInvoices(context.schoolId);
          const summary = {
            total: invoices.length,
            paid: invoices.filter(inv => inv.status === 'paid').length,
            partial: invoices.filter(inv => inv.status === 'partial').length,
            pending: invoices.filter(inv => inv.status === 'pending').length,
            overdue: invoices.filter(inv => inv.status === 'overdue').length,
          };
          return {
            success: true,
            data: summary,
            message: `Fee summary generated`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown fee data type: ${dataType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch fee data: ${error.message}`,
      };
    }
  }

  /**
   * Fetch transport data - PHASE 2
   */
  private static async handleFetchTransportData(
    params: { dataType: string; filters?: any; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { storage } = await import("../storage");
    const { dataType, filters = {}, limit = 20 } = params;

    try {
      switch (dataType) {
        case 'routes': {
          const routes = await storage.getTransportRoutes(context.schoolId);
          return {
            success: true,
            data: routes.slice(0, limit),
            message: `Found ${routes.length} transport routes`,
          };
        }

        case 'vehicles': {
          const vehicles = await storage.getTransportVehicles(context.schoolId);
          return {
            success: true,
            data: vehicles.slice(0, limit),
            message: `Found ${vehicles.length} transport vehicles`,
          };
        }

        case 'student_assignments': {
          const assignments = await storage.getStudentTransportAssignments(context.schoolId);
          let filtered = assignments;

          if (filters.routeId) {
            filtered = filtered.filter(a => a.transportRouteId === filters.routeId);
          }
          if (filters.studentId) {
            filtered = filtered.filter(a => a.studentId === filters.studentId);
          }

          return {
            success: true,
            data: filtered.slice(0, limit),
            message: `Found ${filtered.length} student transport assignments`,
          };
        }

        case 'summary': {
          const routes = await storage.getTransportRoutes(context.schoolId);
          const vehicles = await storage.getTransportVehicles(context.schoolId);
          const assignments = await storage.getStudentTransportAssignments(context.schoolId);

          return {
            success: true,
            data: {
              totalRoutes: routes.length,
              totalVehicles: vehicles.length,
              studentsAssigned: assignments.length,
            },
            message: `Transport summary generated`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown transport data type: ${dataType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch transport data: ${error.message}`,
      };
    }
  }

  /**
   * Fetch messages - PHASE 2
   */
  private static async handleFetchMessages(
    params: { scope: string; conversationWith?: any; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { storage } = await import("../storage");
    const { scope, conversationWith, limit = 10 } = params;

    try {
      switch (scope) {
        case 'conversations': {
          const conversations = await storage.getUserConversations(
            context.userId,
            'admin',
            context.schoolId
          );
          return {
            success: true,
            data: conversations.slice(0, limit),
            message: `Found ${conversations.length} conversations`,
          };
        }

        case 'unread': {
          const unreadCount = await storage.getUnreadMessageCount(
            context.userId,
            'admin',
            context.schoolId
          );
          return {
            success: true,
            data: { unreadCount },
            message: `You have ${unreadCount} unread messages`,
          };
        }

        case 'specific_conversation': {
          if (!conversationWith) {
            return {
              success: false,
              error: 'conversationWith parameter required for specific_conversation scope',
            };
          }

          const messages = await storage.getConversationMessages(
            context.userId,
            'admin',
            conversationWith.userId,
            conversationWith.userType,
            context.schoolId,
            { limit, offset: 0 }
          );

          return {
            success: true,
            data: messages,
            message: `Found ${messages.length} messages`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown messages scope: ${scope}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch messages: ${error.message}`,
      };
    }
  }

  /**
   * Fetch leave requests - PHASE 2
   */
  private static async handleFetchLeaveRequests(
    params: { filters?: any; includeSubstitutions?: boolean; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { storage } = await import("../storage");
    const { filters = {}, includeSubstitutions = false, limit = 20 } = params;

    try {
      const leaves = await storage.getTeacherAbsences(context.schoolId);
      let filtered = leaves;

      if (filters.teacherId) {
        filtered = filtered.filter(leave => leave.teacherId === filters.teacherId);
      }
      if (filters.status) {
        filtered = filtered.filter(leave => leave.status === filters.status);
      }
      if (filters.dateRange) {
        // Parse relative dates like "yesterday", "today", "last week"
        const { getISTDateString } = await import("../../shared/utils/dateUtils");
        let startDate = filters.dateRange.start;
        let endDate = filters.dateRange.end;
        
        // Handle relative date terms
        const now = new Date();
        if (startDate === 'yesterday' || endDate === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = getISTDateString(yesterday);
          if (startDate === 'yesterday') startDate = yesterdayStr;
          if (endDate === 'yesterday') endDate = yesterdayStr;
        }
        if (startDate === 'today' || endDate === 'today') {
          const todayStr = getISTDateString(now);
          if (startDate === 'today') startDate = todayStr;
          if (endDate === 'today') endDate = todayStr;
        }
        
        filtered = filtered.filter(leave => {
          const leaveDate = leave.attendanceDate || leave.startDate;
          return leaveDate >= startDate && leaveDate <= endDate;
        });
      }

      const result = filtered.slice(0, limit).map(leave => ({
        id: leave.id,
        teacherId: leave.teacherId,
        teacherName: (leave.teacher as any)?.name,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        status: leave.status,
      }));

      return {
        success: true,
        data: result,
        message: `Found ${filtered.length} leave requests`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch leave requests: ${error.message}`,
      };
    }
  }

  /**
   * Fetch student attendance - NEW
   */
  private static async handleFetchStudentAttendance(
    params: { filters?: any; limit?: number },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { filters = {}, limit = 20 } = params;
    const { db } = await import("../db");
    const { studentAttendance, students } = await import("../../shared/schema");
    const { eq, and, gte, lte, sql } = await import("drizzle-orm");

    try {
      const { getISTDateString } = await import("../../shared/utils/dateUtils");
      
      // Build where conditions
      const conditions: any[] = [eq(students.schoolId, context.schoolId)];
      
      // Handle date range filtering with relative date parsing
      if (filters.dateRange) {
        let startDate = filters.dateRange.start;
        let endDate = filters.dateRange.end;
        
        // Parse relative dates
        const now = new Date();
        if (startDate === 'yesterday' || endDate === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = getISTDateString(yesterday);
          if (startDate === 'yesterday') startDate = yesterdayStr;
          if (endDate === 'yesterday') endDate = yesterdayStr;
        }
        if (startDate === 'today' || endDate === 'today') {
          const todayStr = getISTDateString(now);
          if (startDate === 'today') startDate = todayStr;
          if (endDate === 'today') endDate = todayStr;
        }
        
        conditions.push(gte(studentAttendance.attendanceDate, startDate));
        conditions.push(lte(studentAttendance.attendanceDate, endDate));
      }
      
      if (filters.status) {
        conditions.push(eq(studentAttendance.status, filters.status));
      }
      
      if (filters.classId) {
        conditions.push(eq(studentAttendance.classId, filters.classId));
      }
      
      if (filters.studentId) {
        conditions.push(eq(studentAttendance.studentId, filters.studentId));
      }

      // Fetch attendance records with student names
      const records = await db
        .select({
          id: studentAttendance.id,
          studentId: studentAttendance.studentId,
          studentName: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
          firstName: students.firstName,
          lastName: students.lastName,
          admissionNumber: students.admissionNumber,
          attendanceDate: studentAttendance.attendanceDate,
          status: studentAttendance.status,
          classId: studentAttendance.classId,
        })
        .from(studentAttendance)
        .innerJoin(students, eq(studentAttendance.studentId, students.id))
        .where(and(...conditions))
        .orderBy(sql`${studentAttendance.attendanceDate} DESC`)
        .limit(limit);

      const result = records.map(r => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.studentName,
        admissionNumber: r.admissionNumber,
        date: r.attendanceDate,
        status: r.status,
        classId: r.classId,
      }));

      return {
        success: true,
        data: result,
        message: `Found ${result.length} student attendance records`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch student attendance: ${error.message}`,
      };
    }
  }

  /**
   * Fetch school insights - PHASE 2
   */
  private static async handleFetchSchoolInsights(
    params: { category?: string; timeframe?: string; includeRecommendations?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { storage } = await import("../storage");
    const { category = 'overall', includeRecommendations = false } = params;

    try {
      const insights = await storage.getAllSchoolInsights(context.schoolId);
      let filtered = insights;

      if (category !== 'overall') {
        filtered = filtered.filter(insight => insight.category === category);
      }

      const summary = {
        totalInsights: filtered.length,
        bySeverity: {
          critical: filtered.filter(i => i.severity === 'critical').length,
          high: filtered.filter(i => i.severity === 'high').length,
          medium: filtered.filter(i => i.severity === 'medium').length,
          low: filtered.filter(i => i.severity === 'low').length,
        },
        byCategory: {
          attendance: filtered.filter(i => i.category === 'attendance').length,
          workload: filtered.filter(i => i.category === 'workload').length,
          scheduling: filtered.filter(i => i.category === 'scheduling').length,
          performance: filtered.filter(i => i.category === 'performance').length,
        },
        insights: filtered.map(i => ({
          title: i.title,
          message: i.message,
          severity: i.severity,
          category: i.category,
          actionable: i.isActionable,
        })),
      };

      return {
        success: true,
        data: summary,
        message: `Generated insights for ${category} category`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch school insights: ${error.message}`,
      };
    }
  }

  /**
   * Fetch timetable/schedule for class or teacher
   */
  private static async handleFetchTimetable(
    params: { classId?: string; teacherId?: string; date?: string; weekStart?: string; includeChanges?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { classId, teacherId, date, includeChanges = true } = params;
    
    // Validate that at least one of classId or teacherId is provided
    if (!classId && !teacherId) {
      return {
        success: false,
        error: "Please specify which timetable you'd like to see. You can request:\n- A class timetable (e.g., 'show timetable for class 1A')\n- A teacher's timetable (e.g., 'show teacher schedule for Aarav')\n\nWhich would you like?"
      };
    }
    const { storage } = await import("../storage");

    try {
      // Resolve class ID from class name if needed
      let resolvedClassId = classId;
      
      // Check if classId is a UUID (36 chars with hyphens in specific positions)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
      
      if (classId && classId.trim() && !isUUID) {
        // Check for generic/ambiguous words that need clarification
        const genericWords = ['class', 'classes', 'classroom', 'grade', 'section', 'student', 'students'];
        if (genericWords.includes(classId.toLowerCase().trim())) {
          const classes = await storage.getClasses(context.schoolId);
          const sortedClasses = sortClasses(classes);
          const classList = sortedClasses.map(c => getClassName(c.grade, c.section)).join(', ');
          return {
            success: false,
            error: `Which class would you like to see the timetable for? Available classes: ${classList}\n\nPlease specify a class (e.g., "show timetable for 1A" or "timetable for 10-B")`,
          };
        }
        
        // Try to find class by name (e.g., "1A", "1-A", "10B" -> find class with grade and section)
        const classes = await storage.getClasses(context.schoolId);
        const className = classId.toUpperCase().replace(/\s+/g, '');
        
        // Try multiple patterns: "1A", "1-A", "10B", "10-B", etc.
        const match = className.match(/^(\d+)-?([A-Z])$/);
        
        if (match) {
          const [, grade, section] = match;
          const foundClass = classes.find(c => 
            c.grade === grade && c.section.toUpperCase() === section
          );
          if (foundClass) {
            resolvedClassId = foundClass.id;
          } else {
            return {
              success: false,
              error: `Class ${className} not found. Available classes: ${classes.map(c => getClassName(c.grade, c.section)).join(', ')}`,
            };
          }
        } else {
          const sortedClasses = sortClasses(classes);
          const classList = sortedClasses.map(c => getClassName(c.grade, c.section)).join(', ');
          return {
            success: false,
            error: `I couldn't find class "${classId}". Available classes: ${classList}\n\nPlease provide the class in the format "1A", "10-B", etc.`,
          };
        }
      }

      // Resolve teacher ID from teacher name if needed
      let resolvedTeacherId = teacherId;
      if (teacherId) {
        const isTeacherUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
        
        if (!isTeacherUUID) {
          // Check for generic/ambiguous words that need clarification
          const genericWords = ['teacher', 'teachers', 'staff', 'faculty', 'instructor', 'person'];
          if (genericWords.includes(teacherId.toLowerCase().trim())) {
            return {
              success: false,
              error: `Please specify which teacher's timetable you'd like to see. You can provide a teacher's name (e.g., "Rajesh Kumar", "Priya Sharma") or ask me to list available teachers.`,
            };
          }
          
          const teachers = await storage.getTeachers(context.schoolId);
          const foundTeacher = teachers.find(t => 
            t.name.toLowerCase().includes(teacherId.toLowerCase()) ||
            t.email?.toLowerCase().includes(teacherId.toLowerCase())
          );
          if (foundTeacher) {
            resolvedTeacherId = foundTeacher.id;
          } else {
            return {
              success: false,
              error: `Teacher "${teacherId}" not found. Please provide a teacher's full name or ask me to list available teachers.`,
            };
          }
        }
      }

      // Get weekly timetable data (not global)
      let timetable;
      let weekStartStr: string;
      let weekEndStr: string;
      
      if (resolvedClassId) {
        // Fetch WEEKLY timetable for current week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(today.setDate(diff));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5);
        
        weekStartStr = weekStart.toISOString().split('T')[0];
        weekEndStr = weekEnd.toISOString().split('T')[0];
        
        // Get weekly timetable
        const weeklyTimetable = await storage.getWeeklyTimetable(
          resolvedClassId,
          weekStart
        );
        
        if (weeklyTimetable && weeklyTimetable.timetableData) {
          // Weekly timetable data is stored as JSON array, convert to timetable entry format
          timetable = weeklyTimetable.timetableData.map((entry: any) => ({
            day: entry.day,
            period: entry.period,
            startTime: entry.startTime,
            endTime: entry.endTime,
            teacherId: entry.teacherId,
            subjectId: entry.subjectId,
            room: entry.room,
            classId: resolvedClassId,
          }));
        } else {
          // Fallback to global timetable if no weekly timetable exists
          timetable = await storage.getTimetableForClass(resolvedClassId);
          // Calculate week dates for display
          const today2 = new Date();
          const dayOfWeek2 = today2.getDay();
          const diff2 = today2.getDate() - dayOfWeek2 + (dayOfWeek2 === 0 ? -6 : 1);
          const weekStart2 = new Date(today2.setDate(diff2));
          const weekEnd2 = new Date(weekStart2);
          weekEnd2.setDate(weekStart2.getDate() + 5);
          weekStartStr = weekStart2.toISOString().split('T')[0];
          weekEndStr = weekEnd2.toISOString().split('T')[0];
        }
      } else if (resolvedTeacherId) {
        timetable = await storage.getTimetableForTeacher(resolvedTeacherId);
        // Calculate week dates
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(today.setDate(diff));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5);
        weekStartStr = weekStart.toISOString().split('T')[0];
        weekEndStr = weekEnd.toISOString().split('T')[0];
      } else {
        return {
          success: false,
          error: 'Either classId or teacherId must be provided',
        };
      }

      // Get related data for enrichment
      const [teachers, subjects, classes] = await Promise.all([
        storage.getTeachers(context.schoolId),
        storage.getSubjects(context.schoolId),
        storage.getClasses(context.schoolId),
      ]);

      // Enrich timetable with related data
      const enrichedTimetable = timetable.map(entry => {
        const teacher = teachers.find(t => t.id === entry.teacherId);
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          day: entry.day,
          startTime: entry.startTime,
          endTime: entry.endTime,
          subject: subject?.name || 'Unknown',
          teacher: teacher?.name || 'Unknown',
          room: entry.room || 'Not assigned',
          class: classData ? getClassName(classData.grade, classData.section) : 'Unknown',
        };
      });

      const classData = classes.find(c => c.id === resolvedClassId);
      const teacherData = teachers.find(t => t.id === resolvedTeacherId);

      // Get time slots from timetable structure
      const { storage: storageImport } = await import("../storage");
      const timetableStructure = await storageImport.getTimetableStructureBySchool(context.schoolId);
      
      console.log('[TIMETABLE DEBUG] Structure:', timetableStructure ? JSON.stringify(timetableStructure).substring(0, 200) : 'undefined');
      
      // Build time slots array from timeSlots field (not periods)
      const timeSlots = timetableStructure?.timeSlots?.map((p: any) => ({
        period: p.period,
        startTime: p.startTime,
        endTime: p.endTime,
        isBreak: p.type === 'break'
      })) || [];

      // Working days
      const workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      // Format timetable data with period numbers
      const formattedTimetableData = timetable.map(entry => {
        const teacher = teachers.find(t => t.id === entry.teacherId);
        const subject = subjects.find(s => s.id === entry.subjectId);
        const entryClass = classes.find(c => c.id === entry.classId);
        
        return {
          day: entry.day.toLowerCase(),
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          teacher: teacher ? { name: teacher.name } : undefined,
          subject: subject ? { name: subject.name, color: subject.color } : undefined,
          class: entryClass ? { grade: entryClass.grade, section: entryClass.section } : undefined,
          room: entry.room || undefined,
        };
      });

      // Create a detailed message with actual timetable data for AI analysis
      const className = classData ? getClassName(classData.grade, classData.section) : (teacherData ? teacherData.name : 'Unknown');
      
      // Build a text representation of the timetable organized by day
      const timetableByDay: { [key: string]: any[] } = {};
      formattedTimetableData.forEach(entry => {
        const day = entry.day.charAt(0).toUpperCase() + entry.day.slice(1);
        if (!timetableByDay[day]) {
          timetableByDay[day] = [];
        }
        timetableByDay[day].push(entry);
      });
      
      // Sort each day's entries by period
      Object.keys(timetableByDay).forEach(day => {
        timetableByDay[day].sort((a, b) => a.period - b.period);
      });
      
      // Build detailed text summary
      let timetableText = `${classData ? 'Class' : 'Teacher'}: ${className}\n`;
      timetableText += `Week: ${weekStartStr} to ${weekEndStr}\n\n`;
      timetableText += `WEEKLY SCHEDULE:\n`;
      
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOrder.forEach(day => {
        const entries = timetableByDay[day] || [];
        if (entries.length > 0) {
          timetableText += `\n${day.toUpperCase()}:\n`;
          entries.forEach(entry => {
            const timeSlot = timeSlots.find(t => t.period === entry.period);
            const time = timeSlot ? `${timeSlot.startTime}-${timeSlot.endTime}` : 'Unknown time';
            const subject = entry.subject?.name || 'Free';
            const teacher = entry.teacher?.name || '-';
            const room = entry.room || '-';
            
            if (classData) {
              // For class timetable: show period, time, subject, teacher
              timetableText += `  P${entry.period} (${time}): ${subject} - ${teacher}${room !== '-' ? ` (Room ${room})` : ''}\n`;
            } else {
              // For teacher timetable: show period, time, subject, class
              const classInfo = entry.class ? `${entry.class.grade}${entry.class.section}` : 'Unknown';
              timetableText += `  P${entry.period} (${time}): ${subject} - Class ${classInfo}${room !== '-' ? ` (Room ${room})` : ''}\n`;
            }
          });
        } else {
          timetableText += `\n${day.toUpperCase()}: No classes scheduled\n`;
        }
      });
      
      // Add free periods info
      const allPeriods = new Set(timeSlots.filter(t => !t.isBreak).map(t => t.period));
      const scheduledPeriods = new Set(formattedTimetableData.map(e => e.period));
      const freePeriods = Array.from(allPeriods).filter(p => !scheduledPeriods.has(p));
      
      if (freePeriods.length > 0) {
        timetableText += `\nFREE PERIODS: ${freePeriods.map(p => `P${p}`).join(', ')}\n`;
      }
      
      const result = {
        success: true,
        data: {
          action: 'show_timetable',
          actionData: {
            classInfo: {
              grade: classData?.grade || '',
              section: classData?.section || '',
            },
            teacherInfo: teacherData ? { name: teacherData.name } : undefined,
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            timetableData: formattedTimetableData,
            timeSlots: timeSlots,
            workingDays: workingDays,
          },
          // Keep timetableDisplay for backward compatibility
          timetableDisplay: {
            classInfo: {
              grade: classData?.grade || '',
              section: classData?.section || '',
            },
            teacherInfo: teacherData ? { name: teacherData.name } : undefined,
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            timetableData: formattedTimetableData,
            timeSlots: timeSlots,
            workingDays: workingDays,
          }
        },
        message: timetableText,
      };
      
      console.log(`[TIMETABLE DEBUG] Returning timetable for ${classData?.grade}-${classData?.section}:`);
      console.log(`  - Timetable entries: ${timetable.length}`);
      console.log(`  - Time slots: ${timeSlots.length}`);
      console.log(`  - Working days: ${workingDays.length}`);
      console.log(`  - Formatted data: ${formattedTimetableData.length}`);
      console.log(`[TIMETABLE SUMMARY] Message being sent to AI:\n${result.message}`);
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch timetable: ${error.message}`,
      };
    }
  }

  /**
   * Open timetable generation dialog
   */
  private static async handleGenerateTimetable(
    params: { mode?: 'all' | 'missing_only' },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Simply return an action to open the dialog in the frontend
    return {
      success: true,
      message: "Opening the timetable generation dialog. Please select your preferred generation mode.",
      data: {
        action: 'open_timetable_generation_dialog',
      },
    };
  }

  /**
   * Find free teachers for a specific period
   */
  private static async handleFindFreeTeachers(
    params: { period: number; day?: string; date?: string },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    try {
      const { period, date } = params;
      let { day } = params;

      // If date is provided, determine the day from it
      if (date) {
        const dateObj = new Date(date);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = dayNames[dateObj.getDay()];
      } else if (!day) {
        // Default to today
        const today = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = dayNames[today.getDay()];
      }

      day = day.toLowerCase();

      // Get the timetable structure for the school
      const structure = await db.query.timetableStructures.findFirst({
        where: eq(timetableStructures.schoolId, context.schoolId),
      });

      if (!structure) {
        return {
          success: false,
          error: 'No timetable structure found for your school. Please set up the timetable structure first.',
        };
      }

      // Check if the requested period is a break
      const timeSlots = structure.timeSlots as any[];
      const requestedSlot = timeSlots.find(slot => slot.period === period);

      if (!requestedSlot) {
        return {
          success: false,
          error: `Period ${period} does not exist in your school's timetable structure.`,
        };
      }

      if (requestedSlot.isBreak) {
        return {
          success: true,
          message: `⏸️ Period ${period} (${requestedSlot.startTime} - ${requestedSlot.endTime}) is a **break period**. All teachers are free during breaks.`,
          data: { isBreak: true, period, timeSlot: requestedSlot },
        };
      }

      // Get all active teachers for the school
      const allTeachers = await db.query.teachers.findMany({
        where: and(
          eq(teachers.schoolId, context.schoolId),
          eq(teachers.status, 'active')
        ),
        columns: {
          id: true,
          name: true,
          employeeId: true,
          schoolIdNumber: true,
          email: true,
        },
      });

      if (allTeachers.length === 0) {
        return {
          success: true,
          message: 'No active teachers found in your school.',
          data: { freeTeachers: [], period, day, timeSlot: requestedSlot },
        };
      }

      // Get all classes for this school to filter timetable entries
      const schoolClasses = await db.query.classes.findMany({
        where: eq(classes.schoolId, context.schoolId),
        columns: { id: true },
      });
      
      const schoolClassIds = schoolClasses.map(c => c.id);
      
      if (schoolClassIds.length === 0) {
        return {
          success: true,
          message: 'No classes found in your school.',
          data: { freeTeachers: allTeachers, period, day, timeSlot: requestedSlot },
        };
      }

      // Get all timetable entries for this period and day for classes in this school
      const busyTeacherEntries = await db.query.timetableEntries.findMany({
        where: and(
          eq(timetableEntries.day, day),
          eq(timetableEntries.period, period),
          eq(timetableEntries.isActive, true)
        ),
        with: {
          subject: {
            columns: { name: true },
          },
          class: {
            columns: { grade: true, section: true, schoolId: true },
          },
        },
      });
      
      // Filter to only include entries from this school
      const schoolBusyTeacherEntries = busyTeacherEntries.filter(
        entry => entry.class && schoolClassIds.includes(entry.classId)
      );

      // Get IDs of busy teachers
      const busyTeacherIds = new Set(
        schoolBusyTeacherEntries
          .filter(entry => entry.teacherId)
          .map(entry => entry.teacherId)
      );

      // Filter to get free teachers
      const freeTeachers = allTeachers.filter(teacher => !busyTeacherIds.has(teacher.id));

      // Build response message
      const dayDisplay = day.charAt(0).toUpperCase() + day.slice(1);
      const timeDisplay = `${requestedSlot.startTime} - ${requestedSlot.endTime}`;
      
      if (freeTeachers.length === 0) {
        return {
          success: true,
          message: `📋 **Free Teachers for Period ${period}** (${dayDisplay}, ${timeDisplay})\n\n❌ All teachers are scheduled during this period. No free teachers available.`,
          data: { 
            freeTeachers: [], 
            period, 
            day, 
            timeSlot: requestedSlot,
            totalTeachers: allTeachers.length,
            busyTeachers: busyTeacherIds.size,
          },
        };
      }

      // Get class assignments for free teachers to show what they teach
      // Only query if there are free teachers (avoid empty inArray which causes SQL error)
      const teacherClassesMap = new Map<string, string[]>();
      const freeTeacherIds = freeTeachers.map(t => t.id);
      
      if (freeTeacherIds.length > 0) {
        const classAssignments = await db.query.classSubjectAssignments.findMany({
          where: inArray(classSubjectAssignments.assignedTeacherId, freeTeacherIds),
          with: {
            class: {
              columns: { grade: true, section: true },
            },
            subject: {
              columns: { name: true },
            },
          },
        });

        // Group assignments by teacher
        for (const assignment of classAssignments) {
          if (!teacherClassesMap.has(assignment.assignedTeacherId!)) {
            teacherClassesMap.set(assignment.assignedTeacherId!, []);
          }
          const className = assignment.class ? `${assignment.class.grade} ${assignment.class.section}` : '';
          if (className && !teacherClassesMap.get(assignment.assignedTeacherId!)!.includes(className)) {
            teacherClassesMap.get(assignment.assignedTeacherId!)!.push(className);
          }
        }
      }

      // Format the list of free teachers
      const teacherList = freeTeachers.map((teacher, index) => {
        const schoolIdText = (teacher.schoolIdNumber || teacher.employeeId) ? ` (ID: ${teacher.schoolIdNumber || teacher.employeeId})` : '';
        return `${index + 1}. **${teacher.name}**${schoolIdText}`;
      }).join('\n');

      const message = `📋 **Free Teachers for Period ${period}** (${dayDisplay}, ${timeDisplay})\n\n✅ **${freeTeachers.length} teacher(s) available:**\n\n${teacherList}\n\n📊 **Summary:** ${freeTeachers.length} free out of ${allTeachers.length} total teachers`;

      return {
        success: true,
        message,
        data: {
          freeTeachers: freeTeachers.map(t => ({
            id: t.id,
            name: t.name,
            schoolId: t.schoolIdNumber || t.employeeId,
            email: t.email,
            classesTaught: teacherClassesMap.get(t.id)?.join(', ') || 'None',
          })),
          period,
          day,
          timeSlot: requestedSlot,
          totalTeachers: allTeachers.length,
          busyTeachers: busyTeacherIds.size,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to find free teachers: ${error.message}`,
      };
    }
  }

  /**
   * Generate Excel export - PHASE 3
   */
  private static async handleGenerateExcelExport(
    params: { exportType: string; filters?: any; includeDetails?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { exportType, filters = {}, includeDetails = true } = params;
    const XLSX = await import('xlsx');

    try {
      let data: any[] = [];
      let filename = '';
      let columns: string[] = [];

      switch (exportType) {
        case 'attendance_report': {
          const { dateRange } = filters;
          if (!dateRange) {
            return {
              success: false,
              error: 'Date range required for attendance report',
            };
          }

          // Get attendance data
          const attendanceRecords = await db.execute(sql`
            SELECT 
              s.first_name, s.last_name, s.admission_number,
              c.grade, c.section,
              sa.attendance_date, sa.status
            FROM ${studentAttendance} sa
            JOIN ${students} s ON s.id = sa.student_id
            LEFT JOIN ${classes} c ON c.id = s.class_id
            WHERE s.school_id = ${context.schoolId}
            AND sa.attendance_date >= ${dateRange.start}
            AND sa.attendance_date <= ${dateRange.end}
            ORDER BY sa.attendance_date DESC, s.last_name, s.first_name
          `);

          data = attendanceRecords.rows.map((row: any) => ({
            'Student Name': `${row.first_name} ${row.last_name}`,
            'Admission Number': row.admission_number,
            'Class': getClassName(row.grade, row.section),
            'Date': row.attendance_date,
            'Status': row.status,
          }));

          filename = `attendance_report_${dateRange.start}_to_${dateRange.end}.xlsx`;
          break;
        }

        case 'student_list': {
          const studentsQuery = await db.query.students.findMany({
            where: and(
              eq(students.schoolId, context.schoolId),
              filters.classId ? eq(students.classId, filters.classId) : undefined
            ),
            with: {
              class: true,
            },
          });

          data = studentsQuery.map(student => ({
            'Name': `${student.firstName} ${student.lastName}`,
            'Admission Number': student.admissionNumber,
            'Email': student.email || '',
            'Phone': student.contactNumber || '',
            'Class': student.class ? getClassName((student.class as any).grade, (student.class as any).section) : 'N/A',
            'Date of Birth': student.dateOfBirth || '',
            'Gender': student.gender || '',
            'Address': includeDetails ? (student.address || '') : '',
          }));

          filename = filters.classId ? `students_class_${filters.classId}.xlsx` : 'all_students.xlsx';
          break;
        }

        case 'teacher_list': {
          const teachersQuery = await db.query.teachers.findMany({
            where: eq(teachers.schoolId, context.schoolId),
          });

          data = teachersQuery.map(teacher => ({
            'Name': teacher.name,
            'Email': teacher.email,
            'Phone': teacher.contactNumber || '',
            'Qualification': teacher.qualification || '',
            'Experience (Years)': teacher.experienceYears || 0,
            'Specialization': teacher.specialization || '',
          }));

          filename = 'teachers_list.xlsx';
          break;
        }

        case 'class_roster': {
          if (!filters.classId) {
            return {
              success: false,
              error: 'Class ID required for class roster',
            };
          }

          const classData = await db.query.classes.findFirst({
            where: and(
              eq(classes.id, filters.classId),
              eq(classes.schoolId, context.schoolId)
            ),
          });

          if (!classData) {
            return { success: false, error: 'Class not found' };
          }

          const studentsQuery = await db.query.students.findMany({
            where: and(
              eq(students.classId, filters.classId),
              eq(students.schoolId, context.schoolId)
            ),
          });

          data = studentsQuery.map((student, index) => ({
            'Roll No': index + 1,
            'Name': `${student.firstName} ${student.lastName}`,
            'Admission Number': student.admissionNumber,
            'Email': student.email || '',
            'Phone': student.contactNumber || '',
            'Date of Birth': student.dateOfBirth || '',
            'Gender': student.gender || '',
          }));

          filename = `class_roster_${classData.grade}_${classData.section}.xlsx`;
          break;
        }

        default:
          return {
            success: false,
            error: `Unsupported export type: ${exportType}`,
          };
      }

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

      // Generate buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Data = excelBuffer.toString('base64');

      return {
        success: true,
        data: {
          action: 'download_excel', // Direct download action - bypasses LLM
          actionData: {
            filename,
            recordCount: data.length,
            base64Data, // Can be used to download on frontend
          }
        },
        message: `Successfully generated Excel report with ${data.length} records. Downloading ${filename}...`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate Excel export: ${error.message}`,
      };
    }
  }

  /**
   * Analyze trends - PHASE 3
   */
  private static async handleAnalyzeTrends(
    params: { metric: string; timeRange: { start: string; end: string }; granularity?: string; compareWith?: string },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { metric, timeRange, granularity = 'daily', compareWith } = params;

    try {
      let trendData: any[] = [];
      let comparisonData: any[] = [];

      switch (metric) {
        case 'attendance_trends': {
          // Get attendance data grouped by date
          const attendanceQuery = await db.execute(sql`
            SELECT 
              sa.attendance_date::date as date,
              COUNT(*) FILTER (WHERE sa.status = 'present')::int as present_count,
              COUNT(*) FILTER (WHERE sa.status = 'absent')::int as absent_count,
              COUNT(*)::int as total_count,
              ROUND(COUNT(*) FILTER (WHERE sa.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as attendance_rate
            FROM ${studentAttendance} sa
            JOIN ${students} s ON s.id = sa.student_id
            WHERE s.school_id = ${context.schoolId}
            AND sa.attendance_date >= ${timeRange.start}
            AND sa.attendance_date <= ${timeRange.end}
            GROUP BY sa.attendance_date
            ORDER BY sa.attendance_date
          `);

          trendData = attendanceQuery.rows.map((row: any) => ({
            date: row.date,
            presentCount: row.present_count,
            absentCount: row.absent_count,
            totalCount: row.total_count,
            attendanceRate: parseFloat(row.attendance_rate),
          }));

          break;
        }

        case 'teacher_availability': {
          // Get teacher attendance trends
          const teacherQuery = await db.execute(sql`
            SELECT 
              ta.attendance_date::date as date,
              COUNT(*) FILTER (WHERE ta.status = 'present')::int as present_count,
              COUNT(*) FILTER (WHERE ta.status = 'absent')::int as absent_count,
              COUNT(*)::int as total_count,
              ROUND(COUNT(*) FILTER (WHERE ta.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as availability_rate
            FROM ${teacherAttendance} ta
            JOIN ${teachers} t ON t.id = ta.teacher_id
            WHERE t.school_id = ${context.schoolId}
            AND ta.attendance_date >= ${timeRange.start}
            AND ta.attendance_date <= ${timeRange.end}
            GROUP BY ta.attendance_date
            ORDER BY ta.attendance_date
          `);

          trendData = teacherQuery.rows.map((row: any) => ({
            date: row.date,
            presentCount: row.present_count,
            absentCount: row.absent_count,
            totalCount: row.total_count,
            availabilityRate: parseFloat(row.availability_rate),
          }));

          break;
        }

        case 'student_enrollment': {
          // Get student enrollment over time (by admission date or count by month)
          const enrollmentQuery = await db.execute(sql`
            SELECT 
              DATE_TRUNC('month', s.created_at) as month,
              COUNT(*)::int as student_count
            FROM ${students} s
            WHERE s.school_id = ${context.schoolId}
            AND s.created_at >= ${timeRange.start}
            AND s.created_at <= ${timeRange.end}
            GROUP BY DATE_TRUNC('month', s.created_at)
            ORDER BY month
          `);

          trendData = enrollmentQuery.rows.map((row: any) => ({
            month: row.month,
            studentCount: row.student_count,
          }));

          break;
        }

        default:
          return {
            success: false,
            error: `Unsupported metric: ${metric}`,
          };
      }

      // Calculate statistics
      const values = trendData.map(d => 
        d.attendanceRate || d.availabilityRate || d.studentCount || 0
      );
      
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;
      const min = values.length > 0 ? Math.min(...values) : 0;

      return {
        success: true,
        data: {
          metric,
          timeRange,
          granularity,
          dataPoints: trendData,
          statistics: {
            average: Number(avg.toFixed(2)),
            maximum: Number(max.toFixed(2)),
            minimum: Number(min.toFixed(2)),
            totalDataPoints: trendData.length,
          },
          comparisonData: comparisonData.length > 0 ? comparisonData : null,
        },
        message: `Analyzed ${metric} from ${timeRange.start} to ${timeRange.end}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to analyze trends: ${error.message}`,
      };
    }
  }

  /**
   * Bulk update - PHASE 3
   */
  private static async handleBulkUpdate(
    params: { operation: string; targetIds: string[]; updateData: Record<string, any>; sendNotification?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { operation, targetIds, updateData, sendNotification = false } = params;

    if (!targetIds || targetIds.length === 0) {
      return {
        success: false,
        error: 'No target IDs provided',
      };
    }

    try {
      let updatedCount = 0;
      let operationDescription = '';

      switch (operation) {
        case 'update_student_status': {
          if (!updateData.status) {
            return { success: false, error: 'Status required in updateData' };
          }

          const result = await db.execute(sql`
            UPDATE ${students}
            SET status = ${updateData.status}
            WHERE id = ANY(${targetIds})
            AND school_id = ${context.schoolId}
          `);

          updatedCount = result.rowCount || 0;
          operationDescription = `Updated status to '${updateData.status}' for ${updatedCount} students`;
          break;
        }

        case 'assign_to_class': {
          if (!updateData.classId) {
            return { success: false, error: 'classId required in updateData' };
          }

          const result = await db.execute(sql`
            UPDATE ${students}
            SET class_id = ${updateData.classId}
            WHERE id = ANY(${targetIds})
            AND school_id = ${context.schoolId}
          `);

          updatedCount = result.rowCount || 0;
          operationDescription = `Assigned ${updatedCount} students to class ${updateData.classId}`;
          break;
        }

        case 'send_notifications': {
          // This would integrate with a notification service
          // For now, we'll just log the operation
          updatedCount = targetIds.length;
          operationDescription = `Queued ${updatedCount} notifications for sending`;
          
          // TODO: Integrate with actual notification service
          console.log(`[BULK_UPDATE] Sending notifications to ${targetIds.length} users:`, updateData);
          break;
        }

        default:
          return {
            success: false,
            error: `Unsupported bulk operation: ${operation}`,
          };
      }

      return {
        success: true,
        data: {
          operation,
          updatedCount,
          targetIds,
        },
        message: operationDescription,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to perform bulk update: ${error.message}`,
      };
    }
  }

  /**
   * Predict attendance - PHASE 4
   */
  private static async handlePredictAttendance(
    params: { targetType: string; targetId?: string; forecastDays?: number; includeRiskFactors?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { targetType, targetId, forecastDays = 7, includeRiskFactors = true } = params;

    try {
      // Get historical attendance data for the past 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      let historicalData: any[] = [];
      let predictions: any[] = [];
      let riskAssessment: any = {};

      if (targetType === 'student') {
        // Get student attendance history
        const attendanceQuery = await db.execute(sql`
          SELECT 
            sa.attendance_date,
            COUNT(*) FILTER (WHERE sa.status = 'present')::int as present_count,
            COUNT(*) FILTER (WHERE sa.status = 'absent')::int as absent_count,
            COUNT(*)::int as total_count
          FROM ${studentAttendance} sa
          JOIN ${students} s ON s.id = sa.student_id
          WHERE s.school_id = ${context.schoolId}
          ${targetId ? sql`AND sa.student_id = ${targetId}` : sql``}
          AND sa.attendance_date >= ${thirtyDaysAgoStr}
          GROUP BY sa.attendance_date
          ORDER BY sa.attendance_date
        `);

        historicalData = attendanceQuery.rows;

        // Calculate attendance rate
        const totalPresent = historicalData.reduce((sum, row: any) => sum + row.present_count, 0);
        const totalDays = historicalData.reduce((sum, row: any) => sum + row.total_count, 0);
        const attendanceRate = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;

        // Simple prediction: use moving average with slight trend
        const recentRate = historicalData.slice(-7).reduce((sum, row: any) => {
          return sum + (row.present_count / (row.total_count || 1)) * 100;
        }, 0) / 7;

        // Generate predictions for next N days
        const today = new Date();
        for (let i = 1; i <= forecastDays; i++) {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + i);
          
          // Simple model: blend overall rate with recent trend
          const predictedRate = (attendanceRate * 0.6) + (recentRate * 0.4);
          const confidence = Math.max(0.5, 1 - (i * 0.05)); // Confidence decreases over time

          predictions.push({
            date: futureDate.toISOString().split('T')[0],
            predictedAttendanceRate: Number(predictedRate.toFixed(2)),
            confidence: Number(confidence.toFixed(2)),
            expectedStatus: predictedRate > 75 ? 'normal' : 'at_risk',
          });
        }

        // Risk assessment
        if (includeRiskFactors) {
          riskAssessment = {
            overallRisk: attendanceRate < 75 ? 'high' : attendanceRate < 85 ? 'medium' : 'low',
            historicalRate: Number(attendanceRate.toFixed(2)),
            recentTrend: recentRate > attendanceRate ? 'improving' : recentRate < attendanceRate ? 'declining' : 'stable',
            riskFactors: [
              attendanceRate < 75 && 'Low overall attendance rate',
              recentRate < attendanceRate && 'Recent attendance declining',
            ].filter(Boolean),
          };
        }
      } else if (targetType === 'teacher') {
        // Similar logic for teachers
        const attendanceQuery = await db.execute(sql`
          SELECT 
            ta.attendance_date,
            COUNT(*) FILTER (WHERE ta.status = 'present')::int as present_count,
            COUNT(*) FILTER (WHERE ta.status = 'absent')::int as absent_count,
            COUNT(*)::int as total_count
          FROM ${teacherAttendance} ta
          JOIN ${teachers} t ON t.id = ta.teacher_id
          WHERE t.school_id = ${context.schoolId}
          ${targetId ? sql`AND ta.teacher_id = ${targetId}` : sql``}
          AND ta.attendance_date >= ${thirtyDaysAgoStr}
          GROUP BY ta.attendance_date
          ORDER BY ta.attendance_date
        `);

        historicalData = attendanceQuery.rows;

        const totalPresent = historicalData.reduce((sum, row: any) => sum + row.present_count, 0);
        const totalDays = historicalData.reduce((sum, row: any) => sum + row.total_count, 0);
        const availabilityRate = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;

        const recentRate = historicalData.slice(-7).reduce((sum, row: any) => {
          return sum + (row.present_count / (row.total_count || 1)) * 100;
        }, 0) / 7;

        const today = new Date();
        for (let i = 1; i <= forecastDays; i++) {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + i);
          
          const predictedRate = (availabilityRate * 0.6) + (recentRate * 0.4);
          const confidence = Math.max(0.5, 1 - (i * 0.05));

          predictions.push({
            date: futureDate.toISOString().split('T')[0],
            predictedAvailabilityRate: Number(predictedRate.toFixed(2)),
            confidence: Number(confidence.toFixed(2)),
            expectedStatus: predictedRate > 90 ? 'normal' : 'concern',
          });
        }

        if (includeRiskFactors) {
          riskAssessment = {
            overallRisk: availabilityRate < 85 ? 'high' : availabilityRate < 92 ? 'medium' : 'low',
            historicalRate: Number(availabilityRate.toFixed(2)),
            recentTrend: recentRate > availabilityRate ? 'improving' : recentRate < availabilityRate ? 'declining' : 'stable',
            riskFactors: [
              availabilityRate < 85 && 'Low teacher availability',
              recentRate < availabilityRate && 'Recent availability declining',
            ].filter(Boolean),
          };
        }
      }

      return {
        success: true,
        data: {
          targetType,
          targetId,
          forecastPeriod: `${forecastDays} days`,
          predictions,
          riskAssessment: includeRiskFactors ? riskAssessment : undefined,
          historicalDataPoints: historicalData.length,
        },
        message: `Generated ${forecastDays}-day attendance forecast for ${targetType}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to predict attendance: ${error.message}`,
      };
    }
  }

  /**
   * Recommend schedule optimization - PHASE 4
   */
  private static async handleRecommendScheduleOptimization(
    params: { analysisScope: string; targetId?: string; optimizationGoals?: string[]; includeActionPlan?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { analysisScope, targetId, optimizationGoals = ['balance_workload'], includeActionPlan = true } = params;

    try {
      const recommendations: any[] = [];
      const issues: any[] = [];
      const actionPlan: any[] = [];

      // Get current week's timetable data
      const { getWeekStart, getWeekEnd } = await import('../utils/istDateUtils');
      const today = new Date();
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);

      if (analysisScope === 'school_wide' || analysisScope === 'specific_class') {
        // Analyze teacher workload distribution
        const workloadQuery = await db.execute(sql`
          SELECT 
            t.id as teacher_id,
            t.name as teacher_name,
            COUNT(DISTINCT wt.id) as total_periods,
            COUNT(DISTINCT wt.class_id) as classes_taught,
            COUNT(DISTINCT cs.subject_id) as subjects_taught
          FROM ${teachers} t
          LEFT JOIN ${weeklyTimetables} wt ON wt.teacher_id = t.id AND wt.week_start_date = ${weekStart}
          LEFT JOIN ${classSubjects} cs ON cs.teacher_id = t.id
          WHERE t.school_id = ${context.schoolId}
          ${analysisScope === 'specific_class' && targetId ? sql`AND wt.class_id = ${targetId}` : sql``}
          GROUP BY t.id, t.name
          ORDER BY total_periods DESC
        `);

        const workloads = workloadQuery.rows;
        
        // Calculate statistics
        const periods = workloads.map((w: any) => w.total_periods);
        const avgWorkload = periods.reduce((a, b) => a + b, 0) / (periods.length || 1);
        const maxWorkload = Math.max(...periods);
        const minWorkload = Math.min(...periods);
        const workloadVariance = maxWorkload - minWorkload;

        // Detect workload imbalances
        if (workloadVariance > 10) {
          issues.push({
            type: 'workload_imbalance',
            severity: 'high',
            description: `Large workload variance detected (${workloadVariance} periods difference)`,
            affectedTeachers: workloads.filter((w: any) => w.total_periods > avgWorkload + 5 || w.total_periods < avgWorkload - 5)
              .map((w: any) => ({ name: w.teacher_name, periods: w.total_periods })),
          });

          recommendations.push({
            goal: 'balance_workload',
            priority: 'high',
            suggestion: `Redistribute periods to balance workload. Target: ${Math.round(avgWorkload)} periods per teacher`,
            impact: `Will reduce variance from ${workloadVariance} to approximately ${Math.round(workloadVariance / 2)} periods`,
            implementation: 'Identify teachers with extra load and reassign some periods to underloaded teachers',
          });

          if (includeActionPlan) {
            actionPlan.push({
              step: 1,
              action: 'Identify teachers with >15 periods and <5 periods',
              responsible: 'Admin',
            });
            actionPlan.push({
              step: 2,
              action: 'Review subject qualifications for potential reassignments',
              responsible: 'Admin',
            });
            actionPlan.push({
              step: 3,
              action: 'Reassign 2-3 periods from overloaded to underloaded teachers',
              responsible: 'Admin',
            });
          }
        }

        // Check for scheduling conflicts
        const conflictsQuery = await db.execute(sql`
          SELECT 
            wt1.teacher_id,
            t.name as teacher_name,
            wt1.day_of_week,
            wt1.period_index,
            COUNT(*) as conflict_count
          FROM ${weeklyTimetables} wt1
          JOIN ${weeklyTimetables} wt2 ON 
            wt1.teacher_id = wt2.teacher_id AND
            wt1.day_of_week = wt2.day_of_week AND
            wt1.period_index = wt2.period_index AND
            wt1.id != wt2.id
          JOIN ${teachers} t ON t.id = wt1.teacher_id
          WHERE wt1.week_start_date = ${weekStart}
          AND t.school_id = ${context.schoolId}
          GROUP BY wt1.teacher_id, t.name, wt1.day_of_week, wt1.period_index
          HAVING COUNT(*) > 1
        `);

        if (conflictsQuery.rows.length > 0) {
          issues.push({
            type: 'scheduling_conflicts',
            severity: 'critical',
            description: `Found ${conflictsQuery.rows.length} scheduling conflicts where teachers are assigned to multiple classes simultaneously`,
            conflicts: conflictsQuery.rows,
          });

          recommendations.push({
            goal: 'minimize_conflicts',
            priority: 'critical',
            suggestion: 'Resolve all scheduling conflicts immediately by reassigning periods to different time slots',
            impact: 'Eliminates double-booking and ensures proper class coverage',
            implementation: 'Use timetable editor to move conflicting periods to available slots',
          });
        }
      }

      return {
        success: true,
        data: {
          analysisScope,
          targetId,
          optimizationGoals,
          issues,
          recommendations,
          actionPlan: includeActionPlan ? actionPlan : undefined,
          summary: {
            totalIssues: issues.length,
            criticalIssues: issues.filter(i => i.severity === 'critical').length,
            recommendationsCount: recommendations.length,
          },
        },
        message: `Analyzed ${analysisScope} schedule and generated ${recommendations.length} optimization recommendations`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate schedule optimization: ${error.message}`,
      };
    }
  }

  /**
   * Generate insights report - PHASE 4
   */
  private static async handleGenerateInsightsReport(
    params: { reportScope: string; focusAreas?: string[]; includeRecommendations?: boolean; format?: string },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { reportScope, focusAreas = [], includeRecommendations = true, format = 'narrative' } = params;

    try {
      const { SchoolContextService } = await import('./schoolContextService');
      const schoolContext = await SchoolContextService.getSchoolContext(context.schoolId, context.userId);

      let reportContent = '';
      const insights: any[] = [];
      const recommendations: any[] = [];

      if (reportScope === 'weekly_summary' || reportScope === 'monthly_overview') {
        // Generate narrative summary
        const stats = schoolContext.statistics;
        
        reportContent = `# ${reportScope === 'weekly_summary' ? 'Weekly' : 'Monthly'} School Performance Report\n\n`;
        reportContent += `**Generated on:** ${new Date().toLocaleDateString()}\n\n`;
        reportContent += `## Overview\n`;
        reportContent += `Your school currently has ${stats.totalStudents} students enrolled across ${stats.totalClasses} classes, with ${stats.totalTeachers} teachers on staff.\n\n`;

        // Attendance insights
        if (stats.studentAttendanceToday !== undefined) {
          const attendanceRate = (stats.studentAttendanceToday / stats.totalStudents) * 100;
          reportContent += `## Attendance\n`;
          reportContent += `Today's student attendance is ${Math.round(attendanceRate)}% (${stats.studentAttendanceToday}/${stats.totalStudents} students present). `;
          
          if (attendanceRate >= 90) {
            reportContent += `This is excellent attendance! 🎉\n\n`;
            insights.push({ category: 'attendance', sentiment: 'positive', message: 'Strong attendance rate maintained' });
          } else if (attendanceRate >= 80) {
            reportContent += `This is good, but there's room for improvement.\n\n`;
            insights.push({ category: 'attendance', sentiment: 'neutral', message: 'Attendance is acceptable but could be improved' });
            if (includeRecommendations) {
              recommendations.push({ 
                area: 'attendance', 
                action: 'Consider implementing attendance tracking reminders for parents',
                priority: 'medium'
              });
            }
          } else {
            reportContent += `⚠️ This is below the ideal threshold and requires attention.\n\n`;
            insights.push({ category: 'attendance', sentiment: 'negative', message: 'Attendance rate is concerning' });
            if (includeRecommendations) {
              recommendations.push({ 
                area: 'attendance', 
                action: 'Urgent: Investigate reasons for low attendance and implement intervention measures',
                priority: 'high'
              });
            }
          }
        }

        // Teacher availability
        if (stats.teacherAttendanceToday !== undefined) {
          const teacherRate = (stats.teacherAttendanceToday / stats.totalTeachers) * 100;
          reportContent += `## Staffing\n`;
          reportContent += `Teacher attendance today is ${Math.round(teacherRate)}% (${stats.teacherAttendanceToday}/${stats.totalTeachers} teachers present). `;
          
          if (teacherRate >= 95) {
            reportContent += `Excellent staffing availability.\n\n`;
          } else if (teacherRate >= 85) {
            reportContent += `Good availability with some absences managed through substitutions.\n\n`;
          } else {
            reportContent += `⚠️ Multiple teacher absences detected. Ensure substitution coverage is in place.\n\n`;
            if (includeRecommendations) {
              recommendations.push({ 
                area: 'staffing', 
                action: 'Review substitute teacher assignments and consider hiring additional staff',
                priority: 'high'
              });
            }
          }
        }

        // Recent activities
        if (schoolContext.recentActivity && schoolContext.recentActivity.length > 0) {
          reportContent += `## Recent Activities\n`;
          reportContent += `Here are key activities from the past week:\n\n`;
          schoolContext.recentActivity.slice(0, 5).forEach((activity: any) => {
            reportContent += `- ${activity.description}\n`;
          });
          reportContent += `\n`;
        }
      } else if (reportScope === 'operational_efficiency') {
        reportContent = `# Operational Efficiency Report\n\n`;
        reportContent += `This report analyzes the operational efficiency of your school based on various metrics.\n\n`;
        
        // Add operational metrics
        const stats = schoolContext.statistics;
        const studentTeacherRatio = stats.totalTeachers > 0 ? (stats.totalStudents / stats.totalTeachers).toFixed(1) : 'N/A';
        
        reportContent += `## Key Metrics\n`;
        reportContent += `- **Student-Teacher Ratio:** ${studentTeacherRatio}:1\n`;
        reportContent += `- **Class Utilization:** ${stats.totalClasses} classes active\n`;
        reportContent += `- **Subject Coverage:** ${stats.totalSubjects || 'N/A'} subjects offered\n\n`;

        insights.push({
          category: 'efficiency',
          message: `Current student-teacher ratio is ${studentTeacherRatio}:1`,
          sentiment: parseFloat(studentTeacherRatio) < 20 ? 'positive' : 'neutral',
        });
      }

      // Format output
      let formattedReport = reportContent;
      if (format === 'bullet_points') {
        formattedReport = reportContent.split('\n').filter(line => line.trim()).map(line => 
          line.startsWith('#') ? line : `• ${line}`
        ).join('\n');
      } else if (format === 'structured') {
        formattedReport = JSON.stringify({
          reportScope,
          generatedAt: new Date().toISOString(),
          content: reportContent,
          insights,
          recommendations: includeRecommendations ? recommendations : undefined,
        }, null, 2);
      }

      return {
        success: true,
        data: {
          reportScope,
          format,
          report: formattedReport,
          insights,
          recommendations: includeRecommendations ? recommendations : undefined,
          metadata: {
            generatedAt: new Date().toISOString(),
            wordCount: reportContent.split(/\s+/).length,
            insightsCount: insights.length,
            recommendationsCount: recommendations.length,
          },
        },
        message: `Generated ${reportScope} insights report in ${format} format`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate insights report: ${error.message}`,
      };
    }
  }

  /**
   * Detect anomalies - PHASE 4
   */
  private static async handleDetectAnomalies(
    params: { dataType: string; sensitivityLevel?: string; timeWindow?: string; includeContextualAnalysis?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { dataType, sensitivityLevel = 'medium', timeWindow = 'last_30_days', includeContextualAnalysis = true } = params;

    try {
      const anomalies: any[] = [];
      
      // Calculate time window
      const daysAgo = timeWindow === 'last_7_days' ? 7 : timeWindow === 'last_30_days' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Set threshold based on sensitivity (number of standard deviations)
      const threshold = sensitivityLevel === 'low' ? 3 : sensitivityLevel === 'medium' ? 2 : 1.5;

      if (dataType === 'attendance' || dataType === 'all') {
        // Analyze attendance anomalies
        const attendanceQuery = await db.execute(sql`
          SELECT 
            sa.attendance_date,
            COUNT(*) FILTER (WHERE sa.status = 'absent')::int as absent_count,
            COUNT(*)::int as total_count,
            ROUND(COUNT(*) FILTER (WHERE sa.status = 'absent')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as absence_rate
          FROM ${studentAttendance} sa
          JOIN ${students} s ON s.id = sa.student_id
          WHERE s.school_id = ${context.schoolId}
          AND sa.attendance_date >= ${startDateStr}
          GROUP BY sa.attendance_date
          ORDER BY sa.attendance_date
        `);

        const data = attendanceQuery.rows;
        if (data.length > 0) {
          // Calculate mean and standard deviation
          const absenceRates = data.map((d: any) => parseFloat(d.absence_rate));
          const mean = absenceRates.reduce((a, b) => a + b, 0) / absenceRates.length;
          const variance = absenceRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / absenceRates.length;
          const stdDev = Math.sqrt(variance);

          // Detect anomalies
          data.forEach((row: any) => {
            const rate = parseFloat(row.absence_rate);
            const zScore = (rate - mean) / (stdDev || 1);
            
            if (Math.abs(zScore) > threshold) {
              anomalies.push({
                type: 'attendance',
                severity: Math.abs(zScore) > 3 ? 'critical' : Math.abs(zScore) > 2 ? 'high' : 'medium',
                date: row.attendance_date,
                metric: 'absence_rate',
                value: rate,
                expectedRange: `${(mean - stdDev).toFixed(2)}% - ${(mean + stdDev).toFixed(2)}%`,
                deviation: `${Math.abs(zScore).toFixed(2)} standard deviations`,
                context: includeContextualAnalysis ? 
                  rate > mean ? `Unusually high absence rate on ${row.attendance_date}. ${row.absent_count} students absent (${rate}% vs typical ${mean.toFixed(1)}%)` :
                  `Unusually low absence rate (possibly data entry issue or special event)` : undefined,
              });
            }
          });
        }
      }

      if (dataType === 'teacher_workload' || dataType === 'all') {
        // Analyze teacher workload anomalies
        const workloadQuery = await db.execute(sql`
          SELECT 
            t.id,
            t.name,
            COUNT(wt.id) as period_count
          FROM ${teachers} t
          LEFT JOIN ${weeklyTimetables} wt ON wt.teacher_id = t.id
          WHERE t.school_id = ${context.schoolId}
          GROUP BY t.id, t.name
          HAVING COUNT(wt.id) > 0
        `);

        const workloads = workloadQuery.rows.map((w: any) => w.period_count);
        if (workloads.length > 0) {
          const mean = workloads.reduce((a: number, b: number) => a + b, 0) / workloads.length;
          const variance = workloads.reduce((sum: number, count: number) => sum + Math.pow(count - mean, 2), 0) / workloads.length;
          const stdDev = Math.sqrt(variance);

          workloadQuery.rows.forEach((teacher: any) => {
            const zScore = (teacher.period_count - mean) / (stdDev || 1);
            
            if (Math.abs(zScore) > threshold) {
              anomalies.push({
                type: 'teacher_workload',
                severity: Math.abs(zScore) > 3 ? 'critical' : 'high',
                teacherId: teacher.id,
                teacherName: teacher.name,
                metric: 'period_count',
                value: teacher.period_count,
                expectedRange: `${Math.round(mean - stdDev)} - ${Math.round(mean + stdDev)} periods`,
                deviation: `${Math.abs(zScore).toFixed(2)} standard deviations`,
                context: includeContextualAnalysis ?
                  teacher.period_count > mean ? `${teacher.name} has unusually high workload (${teacher.period_count} periods vs average ${Math.round(mean)})` :
                  `${teacher.name} has unusually low workload (may need additional assignments)` : undefined,
              });
            }
          });
        }
      }

      return {
        success: true,
        data: {
          dataType,
          timeWindow,
          sensitivityLevel,
          analysisDate: new Date().toISOString(),
          anomaliesDetected: anomalies.length,
          anomalies,
          summary: {
            critical: anomalies.filter(a => a.severity === 'critical').length,
            high: anomalies.filter(a => a.severity === 'high').length,
            medium: anomalies.filter(a => a.severity === 'medium').length,
          },
        },
        message: `Detected ${anomalies.length} anomalies in ${dataType} data using ${sensitivityLevel} sensitivity`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to detect anomalies: ${error.message}`,
      };
    }
  }

  /**
   * Suggest teacher assignments - PHASE 4
   */
  private static async handleSuggestTeacherAssignments(
    params: { optimizationMode: string; constraints?: any; showAlternatives?: boolean },
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const { optimizationMode, constraints = {}, showAlternatives = true } = params;

    try {
      const suggestions: any[] = [];
      const alternatives: any[] = [];

      // Get current assignments
      const currentAssignments = await db.query.classSubjects.findMany({
        where: eq(classSubjects.schoolId, context.schoolId),
        with: {
          class: true,
          subject: true,
          teacher: true,
        },
      });

      // Get all teachers with their qualifications
      const allTeachers = await db.query.teachers.findMany({
        where: eq(teachers.schoolId, context.schoolId),
      });

      // Calculate current workload for each teacher
      const workloadMap = new Map<string, number>();
      currentAssignments.forEach(assignment => {
        if (assignment.teacherId) {
          const current = workloadMap.get(assignment.teacherId) || 0;
          workloadMap.set(assignment.teacherId, current + (assignment.periodsPerWeek || 5));
        }
      });

      if (optimizationMode === 'balance_workload' || optimizationMode === 'comprehensive') {
        // Find overloaded and underloaded teachers
        const workloadArray = Array.from(workloadMap.entries()).map(([teacherId, periods]) => ({
          teacherId,
          teacher: allTeachers.find(t => t.id === teacherId),
          periods,
        }));

        const avgWorkload = workloadArray.reduce((sum, t) => sum + t.periods, 0) / (workloadArray.length || 1);
        const maxAllowed = constraints.maxWorkloadHours || 30;

        workloadArray.forEach(({ teacherId, teacher, periods }) => {
          if (periods > avgWorkload + 5) {
            suggestions.push({
              type: 'reduce_workload',
              priority: 'high',
              teacherId,
              teacherName: teacher?.name,
              currentWorkload: periods,
              targetWorkload: Math.round(avgWorkload),
              recommendation: `Reduce ${teacher?.name}'s workload by ${periods - Math.round(avgWorkload)} periods to achieve balance`,
              action: 'Reassign some classes/subjects to teachers with lighter loads',
            });
          } else if (periods < avgWorkload - 5 && periods < maxAllowed) {
            suggestions.push({
              type: 'increase_workload',
              priority: 'medium',
              teacherId,
              teacherName: teacher?.name,
              currentWorkload: periods,
              targetWorkload: Math.round(avgWorkload),
              recommendation: `${teacher?.name} has capacity for ${Math.round(avgWorkload) - periods} more periods`,
              action: 'Consider assigning additional classes/subjects to optimize utilization',
            });
          }
        });
      }

      if (optimizationMode === 'maximize_expertise' || optimizationMode === 'comprehensive') {
        // Find subjects taught by non-specialized teachers
        currentAssignments.forEach(assignment => {
          const teacher = assignment.teacher as any;
          const subject = assignment.subject as any;
          
          if (teacher && subject) {
            const isQualified = teacher.specialization && 
              teacher.specialization.toLowerCase().includes(subject.name.toLowerCase());
            
            if (!isQualified && constraints.requireQualification) {
              // Find better-qualified teacher
              const qualifiedTeacher = allTeachers.find(t => 
                t.specialization && 
                t.specialization.toLowerCase().includes(subject.name.toLowerCase()) &&
                (workloadMap.get(t.id) || 0) < (constraints.maxWorkloadHours || 30)
              );

              if (qualifiedTeacher) {
                suggestions.push({
                  type: 'improve_qualification_match',
                  priority: 'medium',
                  currentTeacher: teacher.name,
                  suggestedTeacher: qualifiedTeacher.name,
                  subject: subject.name,
                  className: getClassName((assignment.class as any)?.grade, (assignment.class as any)?.section),
                  recommendation: `Assign ${subject.name} to ${qualifiedTeacher.name} who is specialized in this subject`,
                  rationale: `${qualifiedTeacher.name} has expertise in ${qualifiedTeacher.specialization}`,
                });

                if (showAlternatives) {
                  // Find other qualified alternatives
                  const otherQualified = allTeachers.filter(t => 
                    t.id !== qualifiedTeacher.id &&
                    t.specialization && 
                    t.specialization.toLowerCase().includes(subject.name.toLowerCase())
                  );
                  
                  otherQualified.slice(0, 2).forEach(alt => {
                    alternatives.push({
                      for: `${subject.name} in ${getClassName((assignment.class as any)?.grade, (assignment.class as any)?.section)}`,
                      teacherName: alt.name,
                      qualification: alt.specialization,
                      currentWorkload: workloadMap.get(alt.id) || 0,
                    });
                  });
                }
              }
            }
          }
        });
      }

      return {
        success: true,
        data: {
          optimizationMode,
          suggestions,
          alternatives: showAlternatives ? alternatives : undefined,
          summary: {
            totalSuggestions: suggestions.length,
            highPriority: suggestions.filter(s => s.priority === 'high').length,
            mediumPriority: suggestions.filter(s => s.priority === 'medium').length,
            alternativesProvided: alternatives.length,
          },
          metadata: {
            analysisDate: new Date().toISOString(),
            teachersAnalyzed: allTeachers.length,
            currentAssignments: currentAssignments.length,
          },
        },
        message: `Generated ${suggestions.length} teacher assignment suggestions using ${optimizationMode} optimization`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to suggest teacher assignments: ${error.message}`,
      };
    }
  }
}
