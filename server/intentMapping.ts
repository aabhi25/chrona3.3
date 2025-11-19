import axios from 'axios';
import { storage } from './storage';
import llamaService from './llamaService';
import { analyticsService } from './services/analyticsService';

interface IntentHandler {
  handler: (entities: Record<string, any>, schoolId: string, userRole: string) => Promise<ApiResponse>;
  requiredEntities: string[];
  allowedRoles: string[];
  entityQuestions?: Record<string, string>; // User-friendly questions for missing entities
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  action?: string;
  actionData?: any;
}

/**
 * Extensible intent-to-API mapping system for Chrona modules
 */
export class IntentMappingService {
  private intentHandlers: Map<string, IntentHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register all default intent handlers for Chrona modules
   */
  private registerDefaultHandlers() {
    // ATTENDANCE MODULE
    this.registerHandler('MARK_ATTENDANCE', {
      handler: this.handleMarkAttendance.bind(this),
      requiredEntities: ['person_name', 'status'],
      allowedRoles: ['admin', 'teacher'],
      entityQuestions: {
        'person_name': 'Which teacher would you like to mark attendance for? Please provide their name.',
        'status': 'What status would you like to set? (present, absent, or late)'
      }
    });


    // CLASSES MODULE
    this.registerHandler('CREATE_CLASS', {
      handler: this.handleCreateClass.bind(this),
      requiredEntities: [], // No required entities - dialog will collect all info
      allowedRoles: ['admin', 'super_admin']
    });

    // TIMETABLE MODULE
    this.registerHandler('VIEW_TIMETABLE', {
      handler: this.handleViewTimetable.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher', 'student', 'parent']
    });

    // FEES MODULE (extensible for future)
    this.registerHandler('MANAGE_FEES', {
      handler: this.handleManageFees.bind(this),
      requiredEntities: ['action_type'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'action_type': 'What would you like to do with fees? (e.g., view, create invoice, record payment)'
      }
    });

    // EXAMS MODULE (extensible for future)
    this.registerHandler('SCHEDULE_EXAM', {
      handler: this.handleScheduleExam.bind(this),
      requiredEntities: ['subject', 'date'],
      allowedRoles: ['admin', 'super_admin', 'teacher'],
      entityQuestions: {
        'subject': 'Which subject is the exam for?',
        'date': 'When should the exam be scheduled? Please provide the date.'
      }
    });

    // COMMUNICATION MODULE (extensible for future)
    this.registerHandler('SEND_COMMUNICATION', {
      handler: this.handleSendCommunication.bind(this),
      requiredEntities: ['message_type'],
      allowedRoles: ['admin', 'super_admin', 'teacher'],
      entityQuestions: {
        'message_type': 'What type of message would you like to send? (announcement, notification, reminder)'
      }
    });

    // REPORTS MODULE (extensible for future)
    this.registerHandler('VIEW_REPORTS', {
      handler: this.handleViewReports.bind(this),
      requiredEntities: ['report_type'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'report_type': 'Which report would you like to view? (attendance, fees, performance, etc.)'
      }
    });

    // STUDENT MANAGEMENT MODULE
    this.registerHandler('CREATE_STUDENT', {
      handler: this.handleCreateStudent.bind(this),
      requiredEntities: [], // No required entities - dialog will collect all info
      allowedRoles: ['admin', 'super_admin']
    });

    this.registerHandler('VIEW_STUDENTS', {
      handler: this.handleViewStudents.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher']
    });

    this.registerHandler('UPDATE_STUDENT', {
      handler: this.handleUpdateStudent.bind(this),
      requiredEntities: ['student_id'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'student_id': 'Which student would you like to update? Please provide the student name or ID.'
      }
    });

    // TEACHER MANAGEMENT MODULE
    this.registerHandler('CREATE_TEACHER', {
      handler: this.handleCreateTeacher.bind(this),
      requiredEntities: [], // No required entities - dialog will collect all info
      allowedRoles: ['admin', 'super_admin']
    });

    this.registerHandler('VIEW_TEACHERS', {
      handler: this.handleViewTeachers.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher']
    });

    this.registerHandler('UPDATE_TEACHER', {
      handler: this.handleUpdateTeacher.bind(this),
      requiredEntities: ['teacher_id'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'teacher_id': 'Which teacher would you like to update? Please provide the teacher name or ID.'
      }
    });

    // DOWNLOAD/EXPORT MODULE
    this.registerHandler('DOWNLOAD_STUDENT_LIST', {
      handler: this.handleDownloadStudentList.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher']
    });

    this.registerHandler('DOWNLOAD_TEACHER_LIST', {
      handler: this.handleDownloadTeacherList.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin']
    });

    // SUBJECT MANAGEMENT MODULE
    this.registerHandler('CREATE_SUBJECT', {
      handler: this.handleCreateSubject.bind(this),
      requiredEntities: ['subject_name'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'subject_name': 'What is the name of the subject you want to create?'
      }
    });

    this.registerHandler('VIEW_SUBJECTS', {
      handler: this.handleViewSubjects.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher', 'student', 'parent']
    });

    // TIMETABLE ADVANCED MODULE
    this.registerHandler('GENERATE_TIMETABLE', {
      handler: this.handleGenerateTimetable.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin']
    });

    this.registerHandler('MODIFY_TIMETABLE', {
      handler: this.handleModifyTimetable.bind(this),
      requiredEntities: ['class_id', 'period', 'day'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'class_id': 'Which class timetable would you like to modify?',
        'period': 'Which period should I modify?',
        'day': 'Which day of the week?'
      }
    });

    // ANALYTICS MODULE - Consolidated into ANALYTICS_QUERY for data-driven results

    this.registerHandler('TEACHER_WORKLOAD', {
      handler: this.handleTeacherWorkload.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin']
    });

    // ADVANCED ANALYTICS MODULE
    this.registerHandler('ANALYTICS_QUERY', {
      handler: this.handleAnalyticsQuery.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin']
    });

    this.registerHandler('EXPORT_ANALYTICS', {
      handler: this.handleExportAnalytics.bind(this),
      requiredEntities: ['export_format'],
      allowedRoles: ['admin', 'super_admin'],
      entityQuestions: {
        'export_format': 'What format would you like to export in? (Excel, PDF, CSV)'
      }
    });

    // THEME AND SETTINGS MODULE
    this.registerHandler('CHANGE_THEME', {
      handler: this.handleChangeTheme.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher', 'student', 'parent']
    });

    this.registerHandler('OPEN_SETTINGS', {
      handler: this.handleOpenSettings.bind(this),
      requiredEntities: [],
      allowedRoles: ['admin', 'super_admin', 'teacher', 'student', 'parent']
    });
  }

  /**
   * Register a new intent handler (for extensibility)
   */
  registerHandler(intent: string, handler: IntentHandler) {
    this.intentHandlers.set(intent, handler);
  }

  /**
   * Execute intent by mapping to appropriate API
   */
  async executeIntent(
    intent: string, 
    entities: Record<string, any>, 
    schoolId: string, 
    userRole: string,
    originalMessage?: string,
    conversationContext?: string
  ): Promise<ApiResponse> {
    // For analytics queries, add the original message to entities
    if (intent === 'ANALYTICS_QUERY' && originalMessage) {
      entities.original_query = originalMessage;
    }
    // Handle UNKNOWN intents with helpful menu (classification happens in chatService now)
    if (intent === 'UNKNOWN') {
      return {
        success: true,
        message: "🤔 I don't have specific information about that in your school database right now. I can help you with:\n\n📋 **Attendance**: Mark teachers/students present/absent\n👥 **People**: View teachers, students, create new records\n📅 **Timetables**: View class/teacher schedules\n🏫 **Classes**: View and manage school classes\n\nWhat would you like me to help you with?"
      };
    }

    const handler = this.intentHandlers.get(intent);

    if (!handler) {
      return {
        success: false,
        message: `🤔 I don't know how to handle "${intent}" yet. Try asking about attendance, classes, or timetables!`
      };
    }

    // Check role permissions
    if (!handler.allowedRoles.includes(userRole)) {
      return {
        success: false,
        message: `🚫 Sorry, you don't have permission to perform this action. This requires: ${handler.allowedRoles.join(', ')} role.`
      };
    }

    // Check required entities
    const missingEntities = handler.requiredEntities.filter(entity => !entities[entity]);
    if (missingEntities.length > 0) {
      // Use custom entity questions if available
      if (handler.entityQuestions) {
        const questions = missingEntities
          .map(entity => handler.entityQuestions![entity] || entity)
          .join('\n\n');
        return {
          success: false,
          message: `❓ ${questions}`
        };
      }
      
      // Fallback to generic message
      return {
        success: false,
        message: `❓ I need more information: ${missingEntities.join(', ')}. Please provide these details.`
      };
    }

    try {
      return await handler.handler(entities, schoolId, userRole);
    } catch (error: any) {
      console.error(`Error executing intent ${intent}:`, error);
      return {
        success: false,
        message: `⚠️ Something went wrong while processing your request. Please try again.`
      };
    }
  }

  // ===== INTENT HANDLERS =====


  /**
   * Handle attendance marking (students and teachers)
   */
  private async handleMarkAttendance(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { person_name, status, class_name } = entities;
    const today = new Date().toISOString().split('T')[0];

    try {
      // First, try to find as teacher
      const teachers = await storage.getTeachers(schoolId);
      const teacher = teachers.find(t => 
        t.name.toLowerCase().includes(person_name.toLowerCase()) ||
        person_name.toLowerCase().includes(t.name.toLowerCase())
      );

      if (teacher) {
        // Mark teacher attendance
        await storage.markTeacherAttendance({
          teacherId: teacher.id,
          schoolId,
          attendanceDate: today,
          status: status.toLowerCase(),
          reason: `Marked ${status} via AI assistant`
        });

        return {
          success: true,
          message: `✅ Marked ${teacher.name} as ${status} for today. Teacher attendance updated successfully!`,
          action: 'refresh_attendance',
          actionData: { type: 'teacher', teacherId: teacher.id }
        };
      }

      // If not found as teacher, try to find as student
      let students = await storage.getStudents(schoolId);
      
      // Filter by class if provided
      if (class_name) {
        const classes = await storage.getClasses(schoolId);
        const targetClass = classes.find(c => {
          const className = `${c.grade}${c.section}`;
          return className.toLowerCase().includes(class_name.toLowerCase()) ||
                 class_name.toLowerCase().includes(className.toLowerCase());
        });
        
        if (targetClass) {
          students = students.filter(s => s.classId === targetClass.id);
        }
      }

      const student = students.find(s => {
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        return fullName.includes(person_name.toLowerCase()) ||
               person_name.toLowerCase().includes(fullName);
      });

      if (student) {
        // Mark student attendance - need classId for the API
        await storage.markStudentAttendance({
          studentId: student.id,
          schoolId,
          classId: student.classId!,
          attendanceDate: today,
          status: status.toLowerCase(),
          reason: `Marked ${status} via AI assistant`
        });

        const studentName = `${student.firstName} ${student.lastName}`;
        return {
          success: true,
          message: `✅ Marked ${studentName} as ${status} for today. Student attendance updated successfully!`,
          action: 'refresh_attendance',
          actionData: { type: 'student', studentId: student.id }
        };
      }

      // Person not found
      return {
        success: false,
        message: `🔍 I couldn't find "${person_name}" in your school. Please check the spelling or try the full name.`
      };

    } catch (error: any) {
      console.error('Mark attendance error:', error);
      return {
        success: false,
        message: `⚠️ Failed to mark attendance: ${error.message}`
      };
    }
  }

  /**
   * Handle class creation - opens create class dialog
   */
  private async handleCreateClass(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { class_name, subject, teacher_name } = entities;

    try {
      return {
        success: true,
        message: `🏫 I'll help you create a new class. Opening the class creation form...`,
        action: 'open_create_class_dialog',
        actionData: { className: class_name, subject, teacherName: teacher_name }
      };

    } catch (error: any) {
      console.error('Create class error:', error);
      return {
        success: false,
        message: `⚠️ Failed to create class: ${error.message}`
      };
    }
  }

  /**
   * Handle timetable viewing - fetch and display class timetable
   */
  private async handleViewTimetable(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { class_name, teacher_name, subject } = entities;

    try {
      if (class_name) {
        const classes = await storage.getClasses(schoolId);
        const foundClass = classes.find(c => {
          const className = `${c.grade}${c.section}`;
          return className.toLowerCase().includes(class_name.toLowerCase()) ||
                 class_name.toLowerCase().includes(className.toLowerCase());
        });

        if (!foundClass) {
          return {
            success: false,
            message: `🔍 Class "${class_name}" not found. Please check the class name.`
          };
        }

        // Fetch detailed timetable data for the class
        const allTimetableEntries = await storage.getTimetableEntriesWithDetails();
        const timetableEntries = allTimetableEntries.filter(entry => entry.classId === foundClass.id);
        
        if (!timetableEntries || timetableEntries.length === 0) {
          return {
            success: false,
            message: `📅 No timetable found for Class ${foundClass.grade}${foundClass.section}. Please generate a timetable first.`
          };
        }

        // Fetch timetable structure for proper display
        const structure = await storage.getTimetableStructureBySchool(schoolId);
        const workingDays = structure?.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const timeSlots = structure?.timeSlots || [
          { period: 1, startTime: "07:30", endTime: "08:15", isBreak: false },
          { period: 2, startTime: "08:15", endTime: "09:00", isBreak: false },
          { period: 3, startTime: "09:00", endTime: "09:45", isBreak: false },
          { period: 4, startTime: "09:45", endTime: "10:15", isBreak: false },
          { period: 5, startTime: "11:00", endTime: "11:45", isBreak: false },
          { period: 6, startTime: "11:45", endTime: "12:30", isBreak: false },
          { period: 7, startTime: "12:30", endTime: "13:15", isBreak: false }
        ];

        const className = `${foundClass.grade}${foundClass.section}`;
        return {
          success: true,
          message: `📅 Showing timetable for Class ${className}`,
          action: 'display-timetable',
          actionData: { 
            classId: foundClass.id, 
            className,
            timetableEntries,
            workingDays,
            timeSlots,
            userRole
          }
        };

      } else {
        // No specific class requested - ask which class they want to see
        const classes = await storage.getClasses(schoolId);
        
        if (classes.length === 0) {
          return {
            success: false,
            message: "📅 No classes found in your school. Please create classes first before viewing timetables."
          };
        }
        
        // Sort classes properly by grade and section
        const sortedClasses = classes.sort((a, b) => {
          // First sort by grade (numerical)
          const gradeA = parseInt(a.grade) || 0;
          const gradeB = parseInt(b.grade) || 0;
          
          if (gradeA !== gradeB) {
            return gradeA - gradeB;
          }
          
          // If grades are the same, sort by section (alphabetical)
          const sectionA = a.section || '';
          const sectionB = b.section || '';
          return sectionA.localeCompare(sectionB);
        });
        
        // Create a list of available classes
        const classList = sortedClasses.map(c => {
          const className = `${c.grade}${c.section}`;
          return `• Class ${className}`;
        }).join('\n');
        
        return {
          success: true,
          message: `📅 Which class timetable would you like to see? Here are the available classes:\n\n${classList}\n\nJust say "show timetable for class [number]" or simply "class [number]".`
        };
      }

    } catch (error: any) {
      console.error('View timetable error:', error);
      return {
        success: false,
        message: `⚠️ Failed to load timetable: ${error.message}`
      };
    }
  }

  // ===== EXTENSIBLE PLACEHOLDER HANDLERS =====

  private async handleManageFees(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    return {
      success: false,
      message: "💰 Fee management feature is coming soon! For now, please use the main navigation to access fee-related functions."
    };
  }

  private async handleScheduleExam(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    return {
      success: false,
      message: "📝 Exam scheduling feature is coming soon! For now, please use the main navigation to schedule exams."
    };
  }

  private async handleSendCommunication(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    return {
      success: false,
      message: "📢 Communication features are coming soon! For now, please use the main navigation for announcements."
    };
  }

  private async handleViewReports(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    return {
      success: false,
      message: "📊 Advanced reporting features are coming soon! For now, check the analytics section in the main navigation."
    };
  }

  // ===== STUDENT MANAGEMENT HANDLERS =====

  private async handleCreateStudent(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { student_name, class_name, roll_number } = entities;

    try {
      return {
        success: true,
        message: `📚 I'll help you create a new student. Opening the student creation form...`,
        action: 'open_create_student_dialog',
        actionData: { studentName: student_name, className: class_name, rollNumber: roll_number }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to create student: ${error.message}`
      };
    }
  }

  private async handleViewStudents(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { class_name, grade } = entities;

    try {
      // Query actual students from the school's database
      const students = await storage.getStudents(schoolId);
      
      if (students.length === 0) {
        return {
          success: true,
          message: "📋 No students found in your school database. You can add students using the Students section in the main navigation."
        };
      }

      // Get classes for mapping
      const classes = await storage.getClasses(schoolId);
      const classMap = new Map(classes.map(c => [c.id, `Class ${c.grade}${c.section}`]));

      // Filter students if class/grade specified
      let filteredStudents = students;
      if (class_name || grade) {
        const filterText = (class_name || grade).toLowerCase();
        
        // Special case: "all" means show all students, not filter by class "all"
        if (filterText === 'all' || filterText === 'all students') {
          // Don't filter - show all students
          filteredStudents = students;
        } else {
          filteredStudents = students.filter(student => {
            const className = classMap.get(student.classId!) || '';
            
            // Handle various class name formats: "Class 1", "Grade 1", "1", etc.
            const normalizedClassName = className.toLowerCase();
            const normalizedFilter = filterText.toLowerCase();
            
            // Extract just the number/letter from filter text
            const filterNumber = normalizedFilter.replace(/^(class|grade)\s*/i, '').trim();
            
            return normalizedClassName.includes(normalizedFilter) || // "class 1" matches "class 1"
                   normalizedClassName.includes(filterNumber) || // "class 1" matches "1"
                   normalizedClassName.includes(`class ${filterNumber}`) || // flexible matching
                   `${student.firstName} ${student.lastName}`.toLowerCase().includes(normalizedFilter); // student name match
          });
        }
      }

      if (filteredStudents.length === 0) {
        return {
          success: true,
          message: `📋 No students found for "${class_name || grade}" in your school database.`
        };
      }

      // Format student data for analytics table
      const results = filteredStudents.map(student => {
        const className = classMap.get(student.classId!) || 'No class assigned';
        return {
          Name: `${student.firstName} ${student.lastName}`,
          'Admission No.': student.admissionNumber || 'N/A',
          Class: className,
          'Roll Number': student.rollNumber || 'N/A'
        };
      });

      const filterText = class_name || grade;
      const message = filterText 
        ? `👨‍🎓 Students for ${filterText} (${filteredStudents.length} found)`
        : `👨‍🎓 All students in your school (${filteredStudents.length} total)`;

      return {
        success: true,
        message,
        action: 'analytics_results',
        actionData: {
          query: filterText ? `Students for ${filterText}` : 'All students',
          data: results,
          rowCount: results.length
        }
      };

    } catch (error: any) {
      console.error('View students error:', error);
      return {
        success: false,
        message: `⚠️ Failed to load students from your school database: ${error.message}`
      };
    }
  }

  private async handleUpdateStudent(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { student_id, student_name } = entities;

    try {
      return {
        success: true,
        message: `📝 Opening student update form for ${student_name || 'selected student'}...`,
        action: 'open_update_student_dialog',
        actionData: { studentId: student_id, studentName: student_name }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to update student: ${error.message}`
      };
    }
  }

  // ===== TEACHER MANAGEMENT HANDLERS =====

  private async handleCreateTeacher(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { teacher_name, subject, email } = entities;

    try {
      return {
        success: true,
        message: `👨‍🏫 I'll help you create a new teacher. Opening the teacher creation form...`,
        action: 'open_create_teacher_dialog',
        actionData: { teacherName: teacher_name, subject, email }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to create teacher: ${error.message}`
      };
    }
  }

  private async handleViewTeachers(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { subject, department } = entities;

    try {
      // Query actual teachers from the school's database
      const teachers = await storage.getTeachers(schoolId);
      
      if (teachers.length === 0) {
        return {
          success: true,
          message: "📋 No teachers found in your school database. You can add teachers using the Teachers section in the main navigation."
        };
      }

      // Get subjects and classes for mapping
      const subjects = await storage.getSubjects(schoolId);
      const classes = await storage.getClasses(schoolId);
      const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
      const classMap = new Map(classes.map(c => [c.id, `${c.grade}${c.section}`]));

      // Filter teachers if subject/department specified
      let filteredTeachers = teachers;
      if (subject || department) {
        const filterText = (subject || department).toLowerCase();
        filteredTeachers = teachers.filter(teacher => {
          // Check if teacher name matches the filter
          return teacher.name.toLowerCase().includes(filterText);
        });
      }

      if (filteredTeachers.length === 0) {
        return {
          success: true,
          message: `📋 No teachers found for "${subject || department}" in your school database.`
        };
      }

      // Format teacher data for analytics table
      const results = filteredTeachers.map(teacher => {
        const teacherClasses = teacher.classes
          .map((cId: string) => classMap.get(cId))
          .filter(Boolean)
          .join(', ');

        return {
          'Teacher Name': teacher.name,
          'Employee ID': teacher.schoolIdNumber || 'N/A',
          'Contact Number': teacher.contactNumber || 'N/A',
          'Email ID': teacher.email || 'N/A',
          'Classes Taught': teacherClasses || 'No classes assigned'
        };
      });

      const filterText = subject || department;
      const message = filterText 
        ? `👨‍🏫 Teachers for ${filterText} (${filteredTeachers.length} found)`
        : `👨‍🏫 All teachers in your school (${filteredTeachers.length} total)`;

      return {
        success: true,
        message,
        action: 'analytics_results',
        actionData: {
          query: filterText ? `Teachers for ${filterText}` : 'All teachers',
          data: results,
          rowCount: results.length
        }
      };

    } catch (error: any) {
      console.error('View teachers error:', error);
      return {
        success: false,
        message: `⚠️ Failed to load teachers from your school database: ${error.message}`
      };
    }
  }

  private async handleUpdateTeacher(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { teacher_id, teacher_name } = entities;

    try {
      return {
        success: true,
        message: `📝 Opening teacher update form for ${teacher_name || 'selected teacher'}...`,
        action: 'open_update_teacher_dialog',
        actionData: { teacherId: teacher_id, teacherName: teacher_name }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to update teacher: ${error.message}`
      };
    }
  }

  // ===== SUBJECT MANAGEMENT HANDLERS =====

  private async handleCreateSubject(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { subject_name, subject_code, periods_per_week } = entities;

    try {
      if (!subject_name) {
        return {
          success: false,
          message: "❓ Please provide the subject name to create a new subject."
        };
      }

      return {
        success: true,
        message: `📖 I'll help you create a new subject "${subject_name}". Opening the subject creation form...`,
        action: 'open_create_subject_dialog',
        actionData: { subjectName: subject_name, subjectCode: subject_code, periodsPerWeek: periods_per_week }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to create subject: ${error.message}`
      };
    }
  }

  private async handleViewSubjects(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      return {
        success: true,
        message: "📖 Here are all the subjects in your school:",
        action: 'open_subjects_page'
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to load subjects: ${error.message}`
      };
    }
  }

  // ===== TIMETABLE ADVANCED HANDLERS =====

  private async handleGenerateTimetable(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      return {
        success: false,
        message: "🚧 Automatic timetable generation is not available yet. For now, please use the manual timetable editor in the main navigation to create and manage your school timetables."
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to generate timetable: ${error.message}`
      };
    }
  }

  private async handleModifyTimetable(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { class_id, period, day, teacher_name, subject } = entities;

    try {
      return {
        success: true,
        message: `📝 Opening timetable editor for ${day || 'selected'} period ${period || 'selected'}...`,
        action: 'open_timetable_editor',
        actionData: { classId: class_id, period, day, teacherName: teacher_name, subject }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to modify timetable: ${error.message}`
      };
    }
  }

  // ===== ANALYTICS HANDLERS =====


  private async handleTeacherWorkload(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      const teachers = await storage.getTeachers(schoolId);
      
      return {
        success: true,
        message: `📈 Analyzing workload for ${teachers.length} teachers. Opening workload analytics...`,
        action: 'open_teacher_workload_analytics',
        actionData: { teacherCount: teachers.length }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to load teacher workload: ${error.message}`
      };
    }
  }

  // ===== ADVANCED ANALYTICS HANDLERS =====

  private async handleAnalyticsQuery(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      // Check if user has analytics access
      if (!analyticsService.checkAnalyticsAccess(userRole)) {
        return {
          success: false,
          message: "🚫 Sorry, advanced analytics are only available to school administrators."
        };
      }

      // Get the natural language query from conversation context
      // This will be passed in through the executeIntent call
      const naturalLanguageQuery = entities.original_query || entities.query || "Show analytics data";

      console.log(`[ANALYTICS] Processing query: "${naturalLanguageQuery}" for school ${schoolId}`);

      // Generate SQL from natural language using LLAMA
      const sqlResult = await analyticsService.generateSQLFromNaturalLanguage(naturalLanguageQuery, schoolId);
      
      if (sqlResult.error) {
        return {
          success: false,
          message: `⚠️ ${sqlResult.error}`
        };
      }

      // Execute the generated SQL
      const queryResult = await analyticsService.executeAnalyticsQuery(sqlResult.sql, schoolId);
      
      if (!queryResult.success) {
        return {
          success: false,
          message: `⚠️ Database error: ${queryResult.error}`
        };
      }

      // For analytics_results action, send simple message since table will be rendered in frontend
      const simpleMessage = `📊 Here are your analytics results:`;

      return {
        success: true,
        message: simpleMessage,
        action: 'analytics_results',
        actionData: {
          query: naturalLanguageQuery,
          sql: sqlResult.sql,
          explanation: sqlResult.explanation,
          data: queryResult.data,
          rowCount: queryResult.rowCount
        }
      };

    } catch (error: any) {
      console.error('[ANALYTICS] Handler error:', error);
      
      // Special message if LLAMA is down
      if (error.message?.includes('LLAMA') || error.message?.includes('network') || error.message?.includes('timeout')) {
        return {
          success: false,
          message: "⚠️ My brain is not functioning right now, try again later."
        };
      }

      return {
        success: false,
        message: `⚠️ Something went wrong while processing your analytics query. Please try again.`
      };
    }
  }

  private async handleExportAnalytics(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      // Check if user has analytics access
      if (!analyticsService.checkAnalyticsAccess(userRole)) {
        return {
          success: false,
          message: "🚫 Sorry, analytics exports are only available to school administrators."
        };
      }

      const { export_format, data, filename } = entities;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          message: "📊 No analytics data available to export. Please run an analytics query first."
        };
      }

      const exportFormat = export_format?.toLowerCase() || 'xlsx';
      const exportFilename = filename || `analytics_report_${new Date().toISOString().split('T')[0]}`;

      if (exportFormat === 'xlsx' || exportFormat === 'excel') {
        // Export to Excel
        const excelBuffer = await analyticsService.exportToExcel(data, exportFilename);
        
        return {
          success: true,
          message: `📊 Excel report generated successfully! Download starting...`,
          action: 'download_analytics_excel',
          actionData: {
            buffer: excelBuffer,
            filename: `${exportFilename}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        };
      } else if (exportFormat === 'csv') {
        // Export to CSV
        const csvData = await analyticsService.exportToCSV(data);
        
        return {
          success: true,
          message: `📊 CSV report generated successfully! Download starting...`,
          action: 'download_analytics_csv',
          actionData: {
            data: csvData,
            filename: `${exportFilename}.csv`,
            mimeType: 'text/csv'
          }
        };
      } else {
        return {
          success: false,
          message: `⚠️ Unsupported export format: ${export_format}. Please use 'excel' or 'csv'.`
        };
      }

    } catch (error: any) {
      console.error('[ANALYTICS] Export error:', error);
      return {
        success: false,
        message: `⚠️ Failed to export analytics data: ${error.message}`
      };
    }
  }

  // ===== DOWNLOAD/EXPORT HANDLERS =====

  private async handleDownloadStudentList(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      // Get student count first for the message
      const students = await storage.getStudents(schoolId);
      
      if (students.length === 0) {
        return {
          success: false,
          message: "📋 No students found to download. Add students first from the Students section in main navigation."
        };
      }

      return {
        success: true,
        message: `📊 Ready to download ${students.length} student records! Please select the fields you want to include in your Excel file.`,
        action: 'show_field_selection',
        actionData: { 
          type: 'students',
          count: students.length,
          availableFields: [
            { id: 'admissionNumber', label: 'Admission Number', category: 'basic' },
            { id: 'firstName', label: 'First Name', category: 'basic' },
            { id: 'lastName', label: 'Last Name', category: 'basic' },
            { id: 'rollNumber', label: 'Roll Number', category: 'basic' },
            { id: 'className', label: 'Class', category: 'basic' },
            { id: 'email', label: 'Email', category: 'contact' },
            { id: 'contactNumber', label: 'Contact Number', category: 'contact' },
            { id: 'dateOfBirth', label: 'Date of Birth', category: 'personal' },
            { id: 'gender', label: 'Gender', category: 'personal' },
            { id: 'bloodGroup', label: 'Blood Group', category: 'personal' },
            { id: 'address', label: 'Address', category: 'personal' },
            { id: 'guardianName', label: 'Guardian Name', category: 'guardian' },
            { id: 'guardianRelation', label: 'Guardian Relation', category: 'guardian' },
            { id: 'guardianContact', label: 'Guardian Contact', category: 'guardian' },
            { id: 'emergencyContact', label: 'Emergency Contact', category: 'guardian' },
            { id: 'medicalInfo', label: 'Medical Information', category: 'medical' },
            { id: 'status', label: 'Status', category: 'system' }
          ]
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to prepare student download: ${error.message}`
      };
    }
  }

  private async handleDownloadTeacherList(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    try {
      // Get teacher count first for the message
      const teachers = await storage.getTeachers(schoolId);
      
      if (teachers.length === 0) {
        return {
          success: false,
          message: "📋 No teachers found to download. Add teachers first from the Teachers section in main navigation."
        };
      }

      return {
        success: true,
        message: `📊 Ready to download ${teachers.length} teacher records! Please select the fields you want to include in your Excel file.`,
        action: 'show_field_selection',
        actionData: { 
          type: 'teachers',
          count: teachers.length,
          availableFields: [
            { id: 'employeeId', label: 'Employee ID', category: 'basic' },
            { id: 'name', label: 'Name', category: 'basic' },
            { id: 'email', label: 'Email', category: 'contact' },
            { id: 'contactNumber', label: 'Contact Number', category: 'contact' },
            { id: 'schoolIdNumber', label: 'School ID Number', category: 'basic' },
            { id: 'subjects', label: 'Subjects Taught', category: 'academic' },
            { id: 'classes', label: 'Classes Assigned', category: 'academic' },
            { id: 'maxDailyPeriods', label: 'Max Daily Periods', category: 'workload' },
            { id: 'availability', label: 'Availability Schedule', category: 'schedule' },
            { id: 'status', label: 'Status', category: 'system' }
          ]
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to prepare teacher download: ${error.message}`
      };
    }
  }

  // ===== THEME AND SETTINGS HANDLERS =====

  private async handleChangeTheme(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { theme_name, mode } = entities;
    
    // Determine the theme to apply
    let targetTheme = 'dark'; // default
    const themeMention = theme_name || mode;
    
    if (themeMention) {
      const themeText = themeMention.toLowerCase();
      if (themeText.includes('light') || themeText.includes('white')) {
        targetTheme = 'light';
      } else if (themeText.includes('dark') || themeText.includes('black')) {
        targetTheme = 'dark';
      } else if (themeText.includes('system')) {
        targetTheme = 'system';
      }
    }

    try {
      return {
        success: true,
        message: `🎨 Switching to ${targetTheme} theme now...`,
        action: 'change_theme',
        actionData: { theme: targetTheme }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to change theme: ${error.message}`
      };
    }
  }

  private async handleOpenSettings(entities: Record<string, any>, schoolId: string, userRole: string): Promise<ApiResponse> {
    const { section } = entities;

    try {
      return {
        success: true,
        message: "⚙️ Opening settings page...",
        action: 'open_settings',
        actionData: { section: section || 'general' }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `⚠️ Failed to open settings: ${error.message}`
      };
    }
  }
}

// Create singleton instance
export const intentMappingService = new IntentMappingService();

export default intentMappingService;