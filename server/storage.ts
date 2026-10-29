import {
  teachers,
  subjects,
  classes,
  timetableEntries,
  timetableValidityPeriods,
  classSubjectAssignments,
  timetableStructures,
  timetableChanges,
  users,
  schools,
  teacherAttendance,
  auditLogs,
  teacherReplacements,
  weeklyTimetables,
  systemModules,
  rolePermissions,
  customRoles,
  userCustomRoles,
  posts,
  students,
  parents,
  studentParents,
  classTeacherAssignments,
  studentAttendance,
  academicSessions,
  teacherSubstitutions,
  simulationScenarios,
  feeTypes,
  feeStructures,
  feeNotifications,
  feePayments,
  feeInvoices,
  studentFeeAssignments,
  transportRoutes,
  transportVehicles,
  transportStudentAssignments,
  transportRouteAssignments,
  exams,
  hostels,
  inventoryCategories,
  inventoryItems,
  payrollEmployees,
  payrollCycles,
  expenseCategories,
  expenses,
  budgets,
  admissionApplications,
  calendarEvents,
  incrementalChangeRequests,
  schoolSettings,
  teacherPlannerSettings,
  messages,
  idCardTemplates,
  idCards,
  certificateTemplates,
  certificates,
  leaveApplications,
  type Teacher,
  type InsertTeacher,
  type Subject,
  type InsertSubject,
  type Class,
  type InsertClass,
  type TimetableEntry,
  type InsertTimetableEntry,
  type TimetableValidityPeriod,
  type InsertTimetableValidityPeriod,
  type ClassSubjectAssignment,
  type InsertClassSubjectAssignment,
  type TimetableStructure,
  type InsertTimetableStructure,
  type TimetableChange,
  type InsertTimetableChange,
  type User,
  type InsertUser,
  type School,
  type InsertSchool,
  type TeacherAttendance,
  type InsertTeacherAttendance,
  type AuditLog,
  type InsertAuditLog,
  type UpdateTeacherDailyPeriods,
  manualAssignmentAudits,
  type ManualAssignmentAudit, 
  type InsertManualAssignmentAudit,
  type TeacherReplacement,
  type InsertTeacherReplacement,
  type WeeklyTimetable,
  type InsertWeeklyTimetable,
  type Post,
  type InsertPost,
  type SystemModule,
  type InsertSystemModule,
  type RolePermission,
  type InsertRolePermission,
  type CustomRole,
  type InsertCustomRole,
  type UserCustomRole,
  type InsertUserCustomRole,
  type ClassTeacherAssignment,
  type InsertClassTeacherAssignment,
  type StudentAttendance,
  type InsertStudentAttendance,
  type Student,
  type InsertStudent,
  type Parent,
  type InsertParent,
  type StudentParent,
  type InsertStudentParent,
  type AcademicSession,
  type InsertAcademicSession,
  // Messages
  type Message,
  type InsertMessage,
  // Notifications
  notifications,
  type Notification,
  type InsertNotification,
  // Fee Management
  feeStructureItems,
  feeInvoiceItems,
  type FeeType,
  type InsertFeeType,
  type FeeStructure,
  type InsertFeeStructure,
  type FeeStructureItem,
  type InsertFeeStructureItem,
  type StudentFeeAssignment,
  type InsertStudentFeeAssignment,
  type FeeInvoice,
  type InsertFeeInvoice,
  type FeeInvoiceItem,
  type InsertFeeInvoiceItem,
  type FeePayment,
  type InsertFeePayment,
  type FeeNotification,
  type InsertFeeNotification,
  // Transport Management
  transportStops,
  type TransportRoute,
  type InsertTransportRoute,
  type TransportStop,
  type InsertTransportStop,
  type TransportVehicle,
  type InsertTransportVehicle,
  type TransportRouteAssignment,
  type InsertTransportRouteAssignment,
  type TransportStudentAssignment,
  type InsertTransportStudentAssignment,
  // Incremental Update tables
  conflictDetectionResults,
  changeImpactAnalysis,
  type IncrementalChangeRequest,
  type InsertIncrementalChangeRequest,
  type ConflictDetectionResult,
  type InsertConflictDetectionResult,
  type ChangeImpactAnalysis,
  type InsertChangeImpactAnalysis,
  // School Settings
  type SchoolSetting,
  type InsertSchoolSetting,
  // User Preferences
  userPreferences,
  type UserPreference,
  type InsertUserPreference,
  // Teacher Planner Settings
  type TeacherPlannerSettings,
  type InsertTeacherPlannerSettings,
  // Calendar Events
  type CalendarEvent,
  type InsertCalendarEvent,
  // Admission Management
  admissionDocuments,
  type AdmissionApplication,
  type InsertAdmissionApplication,
  type AdmissionDocument,
  type InsertAdmissionDocument,
  // Exam Module
  examClasses,
  examSubjects,
  examMarks,
  examResults,
  type Exam,
  type InsertExam,
  type ExamSubject,
  type InsertExamSubject,
  type ExamMark,
  type InsertExamMark,
  type ExamResult,
  type InsertExamResult,
  // Hostel Management
  hostelRooms,
  hostelAllocations,
  hostelFees,
  type Hostel,
  type InsertHostel,
  type HostelRoom,
  type InsertHostelRoom,
  type HostelAllocation,
  type InsertHostelAllocation,
  type HostelFee,
  type InsertHostelFee,
  // Inventory Management
  inventoryTransactions,
  type InventoryCategory,
  type InsertInventoryCategory,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  // Payroll Management
  salaryComponents,
  payrollPayslips,
  type PayrollEmployee,
  type InsertPayrollEmployee,
  type SalaryComponent,
  type InsertSalaryComponent,
  type PayrollCycle,
  type InsertPayrollCycle,
  type PayrollPayslip,
  type InsertPayrollPayslip,
  // Expense Management
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type Budget,
  type InsertBudget,
  type IdCardTemplate,
  type InsertIdCardTemplate,
  type IdCard,
  type InsertIdCard,
  type CertificateTemplate,
  type InsertCertificateTemplate,
  type Certificate,
  type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, notInArray, sql, ne, gte, lte, between, asc, desc, not, isNull } from "drizzle-orm";
import { getCurrentDateIST, getCurrentDateTimeIST, getWeekStartDateIST, getWeekEndDateIST, toISTDateString } from "@shared/utils/dateUtils";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLoginId(loginId: string, schoolId?: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUsersBySchoolId(schoolId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  
  // Temporary password operations
  setTemporaryPassword(userId: string, hashedPassword: string, expiresAt: Date): Promise<User>;
  clearTemporaryPassword(userId: string): Promise<User>;
  validateTemporaryPassword(userId: string, password: string): Promise<{ isValid: boolean; isExpired: boolean; user?: User }>;

  // User Preferences operations
  saveUserPreference(userId: string, key: string, value: any): Promise<void>;
  getUserPreference(userId: string, key: string): Promise<any | null>;

  // School operations
  getSchools(): Promise<School[]>;
  getSchoolsWithAdminEmails(): Promise<(School & { adminEmail?: string })[]>;
  getSchool(id: string): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<InsertSchool>): Promise<School>;
  deleteSchool(id: string): Promise<void>;
  clearSchoolData(id: string): Promise<void>;

  // Teacher operations
  getTeachers(schoolId?: string): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  getTeacherCountBySchool(schoolId: string): Promise<number>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, teacher: Partial<InsertTeacher>): Promise<Teacher>;
  deleteTeacher(id: string): Promise<void>;
  getAvailableTeachers(day: string, period: number, subjectId: string, schoolId: string): Promise<Teacher[]>;
  updateTeacherDailyPeriods(schoolId: string, config: UpdateTeacherDailyPeriods): Promise<{ success: boolean; message: string }>;
  getTeacherSchedule(teacherId: string, date?: string): Promise<TimetableEntry[]>;
  getTeacherWorkloadAnalytics(schoolId: string): Promise<any>;
  getTimetableEntriesByTeacher(teacherId: string): Promise<TimetableEntry[]>;
  getTeacherClasses(teacherId: string): Promise<{
    id: string;
    grade: string;
    section: string | null;
    room: string | null;
    studentCount: number;
    role: string;
    subjects: string[];
  }[]>;
  
  // Teacher Replacement operations
  createTeacherReplacement(replacement: InsertTeacherReplacement): Promise<TeacherReplacement>;
  getAllTeacherReplacements(): Promise<TeacherReplacement[]>;
  getTeacherReplacementsBySchool(schoolId: string): Promise<TeacherReplacement[]>;

  // Subject operations
  getSubjects(schoolId?: string): Promise<Subject[]>;
  getSubject(id: string): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: string, subject: Partial<InsertSubject>): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;
  checkSubjectCodeExists(code: string, schoolId: string, excludeId?: string): Promise<boolean>;

  // Class operations
  getClasses(schoolId?: string, academicSessionId?: string): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: string, classData: Partial<InsertClass>): Promise<Class>;
  deleteClass(id: string): Promise<void>;
  checkClassExists(grade: string, section: string | null, schoolId: string, excludeId?: string): Promise<boolean>;
  getClassesWithTimetables(schoolId: string): Promise<Class[]>;

  // Class Teacher Assignment operations
  getClassTeacherAssignments(classId: string, academicSessionId?: string): Promise<(ClassTeacherAssignment & { teacherName: string; teacherEmail: string })[]>;
  getClassTeacherAssignment(classId: string, teacherId: string): Promise<ClassTeacherAssignment | undefined>;
  getPrimaryClassTeacher(classId: string): Promise<ClassTeacherAssignment | undefined>;
  createClassTeacherAssignment(assignment: InsertClassTeacherAssignment): Promise<ClassTeacherAssignment>;
  getClassTeacherAssignmentById(assignmentId: string): Promise<ClassTeacherAssignment | undefined>;
  updateClassTeacherAssignment(assignmentId: string, data: Partial<InsertClassTeacherAssignment>): Promise<ClassTeacherAssignment>;
  deleteClassTeacherAssignment(assignmentId: string): Promise<void>;
  getOtherSectionsOfGrade(grade: string, schoolId: string, excludeClassId: string): Promise<Class[]>;
  copySubjectsBetweenClasses(sourceClassId: string, targetClassIds: string[], schoolId: string): Promise<{ copiedCount: number; skippedCount: number }>;
  getClassesForClassTeacher(teacherId: string, schoolId: string, academicSessionId?: string): Promise<Class[]>;

  // Class Subject Assignment operations
  getClassSubjectAssignments(classId?: string, schoolId?: string, academicSessionId?: string): Promise<any[]>;
  getClassSubjectAssignment(id: string): Promise<ClassSubjectAssignment | undefined>;
  createClassSubjectAssignment(assignment: InsertClassSubjectAssignment): Promise<ClassSubjectAssignment>;
  updateClassSubjectAssignment(id: string, assignment: Partial<InsertClassSubjectAssignment>): Promise<ClassSubjectAssignment>;
  deleteClassSubjectAssignment(id: string): Promise<void>;
  getClassSubjectAssignmentByClassAndSubject(classId: string, subjectId: string): Promise<ClassSubjectAssignment | undefined>;

  // Timetable operations
  getTimetableEntries(): Promise<TimetableEntry[]>;
  getTimetableForClass(classId: string): Promise<TimetableEntry[]>;
  getTimetableEntriesBatch(classIds: string[]): Promise<Map<string, TimetableEntry[]>>;
  getTimetableForTeacher(teacherId: string): Promise<TimetableEntry[]>;
  getTimetableEntriesExcludingClasses(schoolId: string, excludedClassIds: string[]): Promise<TimetableEntry[]>;
  getTimetableEntriesBySchool(schoolId: string): Promise<TimetableEntry[]>;
  checkTeacherCapacityForClasses(schoolId: string, targetClassIds: string[]): Promise<{
    teacherId: string;
    teacherName: string;
    requiredPeriods: number;
    currentPeriods: number;
    maxDailyPeriods: number;
    maxWeeklyPeriods: number;
    availableWeeklyPeriods: number;
    status: 'sufficient' | 'insufficient' | 'warning';
    subjects: { subjectId: string; subjectName: string; periodsNeeded: number }[];
  }[]>;
  createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry>;
  updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry>;
  deleteTimetableEntry(id: string): Promise<void>;
  clearTimetable(): Promise<void>;
  bulkCreateTimetableEntries(entries: InsertTimetableEntry[]): Promise<TimetableEntry[]>;

  // Timetable changes operations
  getTimetableChanges(schoolId: string, date?: string): Promise<TimetableChange[]>;
  getTimetableChangesByEntry(timetableEntryId: string): Promise<TimetableChange[]>;
  createTimetableChange(change: InsertTimetableChange): Promise<TimetableChange>;
  updateTimetableChange(id: string, change: Partial<InsertTimetableChange>): Promise<TimetableChange>;
  deleteTimetableChange(id: string): Promise<void>;
  getActiveTimetableChanges(schoolId: string, date: string): Promise<TimetableChange[]>;

  // Timetable validity period operations
  getTimetableValidityPeriods(classId?: string): Promise<TimetableValidityPeriod[]>;
  getTimetableValidityPeriod(id: string): Promise<TimetableValidityPeriod | undefined>;
  createTimetableValidityPeriod(period: InsertTimetableValidityPeriod): Promise<TimetableValidityPeriod>;
  updateTimetableValidityPeriod(id: string, period: Partial<InsertTimetableValidityPeriod>): Promise<TimetableValidityPeriod>;
  deleteTimetableValidityPeriod(id: string): Promise<void>;

  // Teacher attendance operations
  getTeacherAttendance(schoolId: string, date?: string): Promise<TeacherAttendance[]>;
  getTeacherAbsences(schoolId: string): Promise<any[]>;
  getTeacherAttendanceByTeacher(teacherId: string, startDate?: string, endDate?: string): Promise<TeacherAttendance[]>;
  markTeacherAttendance(attendance: InsertTeacherAttendance): Promise<TeacherAttendance>;
  updateTeacherAttendance(id: string, attendance: Partial<InsertTeacherAttendance>): Promise<TeacherAttendance>;
  deleteTeacherAttendance(id: string): Promise<void>;
  isTeacherAbsent(teacherId: string, date: string): Promise<boolean>;

  // Leave application operations
  createLeaveApplication(application: any): Promise<any>;
  getLeaveApplications(schoolId: string, filters?: { status?: string; teacherId?: string }): Promise<any[]>;
  getLeaveApplicationById(id: string): Promise<any | undefined>;
  updateLeaveApplication(id: string, updates: any): Promise<any>;
  approveLeaveApplication(id: string, reviewedBy: string, reviewNotes?: string): Promise<any>;
  rejectLeaveApplication(id: string, reviewedBy: string, reviewNotes?: string): Promise<any>;

  // Student attendance operations
  getStudentAttendance(schoolId: string, date?: string): Promise<StudentAttendance[]>;
  getStudentAttendanceById(id: string): Promise<StudentAttendance | undefined>;
  getStudentAttendanceByStudent(studentId: string, startDate?: string, endDate?: string): Promise<StudentAttendance[]>;
  getStudentAttendanceByClass(classId: string, date: string): Promise<StudentAttendance[]>;
  markStudentAttendance(attendance: InsertStudentAttendance): Promise<StudentAttendance>;
  updateStudentAttendance(id: string, attendance: Partial<InsertStudentAttendance>): Promise<StudentAttendance>;
  deleteStudentAttendance(id: string): Promise<void>;
  isStudentAbsent(studentId: string, date: string): Promise<boolean>;

  // Student user relationship
  getStudentByUserId(userId: string): Promise<Student | undefined>;

  // Timetable Structure operations
  getTimetableStructures(schoolId?: string): Promise<TimetableStructure[]>;
  getTimetableStructure(id: string): Promise<TimetableStructure | undefined>;
  getTimetableStructureBySchool(schoolId: string): Promise<TimetableStructure | undefined>;
  createTimetableStructure(structure: InsertTimetableStructure): Promise<TimetableStructure>;
  updateTimetableStructure(id: string, structure: Partial<InsertTimetableStructure>): Promise<TimetableStructure>;
  deleteTimetableStructure(id: string): Promise<void>;

  // Analytics
  getStats(schoolId: string): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
  }>;
  
  getAdminDashboardStats(): Promise<{
    totalSchools: number;
    activeSchools: number;
    inactiveSchools: number;
    schoolAdminLogins: Array<{
      schoolName: string;
      adminName: string;
      lastLogin: Date | null;
    }>;
    schoolTeacherCounts: Array<{
      schoolName: string;
      activeTeachers: number;
    }>;
  }>;

  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(schoolId: string, limit?: number): Promise<AuditLog[]>;


  // RBAC operations - Role permissions
  getSystemModules(isActive?: boolean): Promise<SystemModule[]>;
  
  // Custom Roles
  getCustomRoles(schoolId: string, isActive?: boolean): Promise<CustomRole[]>;
  getCustomRoleById(id: string): Promise<CustomRole | undefined>;
  createCustomRole(role: InsertCustomRole): Promise<CustomRole>;
  updateCustomRole(id: string, role: Partial<InsertCustomRole>): Promise<CustomRole>;
  deleteCustomRole(id: string): Promise<void>;
  assignCustomRoleToUser(userId: string, customRoleId: string | null): Promise<void>;
  getUserCustomRoles(userId: string): Promise<CustomRole[]>;
  assignCustomRolesToUser(userId: string, customRoleIds: string[], assignedBy: string): Promise<void>;
  removeCustomRoleFromUser(userId: string, customRoleId: string): Promise<void>;
  
  getRolePermissions(schoolId: string, role?: string, customRoleId?: string): Promise<RolePermission[]>;
  setRolePermission(permission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(id: string, permission: Partial<InsertRolePermission>): Promise<RolePermission>;
  deleteRolePermission(id: string): Promise<void>;
  getUserModulePermissions(userId: string, schoolId: string): Promise<{ moduleId: string; permissions: any }[]>;
  checkUserPermission(userId: string, moduleId: string, action: 'read' | 'write' | 'delete' | 'export', schoolId: string): Promise<boolean>;

  // Manual assignment operations
  getTeachersForClass(classId: string): Promise<Teacher[]>;
  createManualAssignmentAudit(audit: InsertManualAssignmentAudit): Promise<ManualAssignmentAudit>;
  getTimetableEntry(id: string): Promise<TimetableEntry | undefined>;
  updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry>;
  createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry>;
  isTeacherAvailable(teacherId: string, day: string, period: number, date?: string): Promise<boolean>;

  // Post operations for newsfeed system
  getPosts(schoolId: string, feedScope?: 'school' | 'class', classId?: string, offset?: number, limit?: number): Promise<Post[]>;
  getPostById(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, post: Partial<InsertPost>): Promise<Post>;
  deletePost(id: string): Promise<void>;
  getUserFeed(userId: string): Promise<Post[]>; // Personalized feed combining school + user's class feeds

  // Student operations
  getStudents(schoolId?: string, classId?: string, academicSessionId?: string, offset?: number, limit?: number): Promise<Student[]>;
  getStudentCountBySchool(schoolId?: string, classId?: string, academicSessionId?: string): Promise<number>;
  getStudent(id: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, student: Partial<InsertStudent>): Promise<Student>;
  deleteStudent(id: string): Promise<void>;
  getStudentsByClass(classId: string): Promise<Student[]>;

  // Parent operations
  getParents(schoolId?: string): Promise<Parent[]>;
  getParent(id: string): Promise<Parent | undefined>;
  createParent(parent: InsertParent): Promise<Parent>;
  updateParent(id: string, parent: Partial<InsertParent>): Promise<Parent>;
  deleteParent(id: string): Promise<void>;

  // Student-Parent relationship operations
  linkStudentToParent(studentId: string, parentId: string): Promise<StudentParent>;
  unlinkStudentFromParent(studentId: string, parentId: string): Promise<void>;
  getParentChildren(parentId: string): Promise<Student[]>;
  getStudentParents(studentId: string): Promise<Parent[]>;
  getStudentParentsWithDetails(studentId: string): Promise<(StudentParent & { parent: Parent })[]>;
  getStudentCredentials(studentId: string): Promise<{ studentLogin: { loginId: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null; parentLogin: { loginId: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null; }>;
  refreshStudentCredentials(studentId: string): Promise<{ studentLogin: { userId: string; loginId: string; temporaryPassword: string; expiresAt: Date; }; parentLogin: { userId: string; loginId: string; temporaryPassword: string; expiresAt: Date; }; }>;
  getStudentByAdmissionNumber(admissionNumber: string, schoolId: string): Promise<Student | undefined>;
  linkParentToStudent(parentId: string, studentId: string): Promise<StudentParent>;

  // Academic Session operations
  getAcademicSessions(schoolId: string): Promise<AcademicSession[]>;
  getCurrentAcademicSession(schoolId: string): Promise<AcademicSession | undefined>;
  getAcademicSession(id: string): Promise<AcademicSession | undefined>;
  createAcademicSession(session: InsertAcademicSession): Promise<AcademicSession>;
  updateAcademicSession(id: string, session: Partial<InsertAcademicSession>): Promise<AcademicSession>;
  setActiveAcademicSession(schoolId: string, sessionId: string): Promise<void>;
  hasAcademicSession(schoolId: string): Promise<boolean>;
  
  // Session Migration operations
  migrateToNewSession(
    currentSessionId: string, 
    newSessionId: string, 
    schoolId: string, 
    options: {
      promoteStudents?: boolean;
      copyClassTeachers?: boolean;
      copySubjectAssignments?: boolean;
    }
  ): Promise<{ success: boolean; message: string; newClassIds: string[] }>;
  cloneClassesForSession(fromSessionId: string, toSessionId: string, schoolId: string): Promise<Class[]>;
  promoteStudents(fromSessionId: string, toSessionId: string, schoolId: string): Promise<void>;

  // ============================================================================
  // MESSAGE OPERATIONS
  // ============================================================================
  
  // Message operations  
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(schoolId: string, senderId: string, receiverId: string, limit?: number, offset?: number): Promise<Message[]>;
  getUnreadMessagesCount(schoolId: string, userId: string): Promise<number>;
  markMessageAsRead(messageId: string, userId: string): Promise<Message>;
  markConversationAsRead(schoolId: string, senderId: string, receiverId: string, userId: string): Promise<void>;
  deleteConversation(schoolId: string, currentUserType: string, currentUserId: string, otherUserType: string, otherUserId: string): Promise<void>;
  getConversationsList(schoolId: string, userId: string): Promise<any[]>;
  getUsersAllowedToMessage(schoolId: string, currentUserId: string, currentUserRole: string): Promise<User[]>;

  // ============================================================================
  // NOTIFICATION OPERATIONS
  // ============================================================================
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(recipientId: string, recipientRole: string, limit?: number, offset?: number): Promise<Notification[]>;
  getUnreadNotificationsCount(recipientId: string, recipientRole: string): Promise<number>;
  markNotificationAsRead(notificationId: string): Promise<Notification>;
  markAllNotificationsAsRead(recipientId: string, recipientRole: string): Promise<void>;
  deleteNotification(notificationId: string): Promise<void>;

  // ============================================================================
  // FEE MANAGEMENT OPERATIONS
  // ============================================================================
  
  // Fee Types operations
  getFeeTypes(schoolId: string): Promise<FeeType[]>;
  getFeeType(id: string): Promise<FeeType | undefined>;
  createFeeType(feeType: InsertFeeType): Promise<FeeType>;
  updateFeeType(id: string, feeType: Partial<InsertFeeType>): Promise<FeeType>;
  deleteFeeType(id: string): Promise<void>;

  // Fee Structures operations
  getFeeStructures(schoolId: string, academicSessionId?: string): Promise<FeeStructure[]>;
  getFeeStructure(id: string): Promise<FeeStructure | undefined>;
  createFeeStructure(feeStructure: InsertFeeStructure): Promise<FeeStructure>;
  updateFeeStructure(id: string, feeStructure: Partial<InsertFeeStructure>): Promise<FeeStructure>;
  deleteFeeStructure(id: string): Promise<void>;
  getFeeStructureByGradeAndCategory(schoolId: string, grade: string, section: string | null, studentCategory: string, academicSessionId: string): Promise<FeeStructure | undefined>;

  // Fee Structure Items operations
  getFeeStructureItems(feeStructureId: string): Promise<FeeStructureItem[]>;
  getFeeStructureItem(id: string): Promise<FeeStructureItem | undefined>;
  createFeeStructureItem(feeStructureItem: InsertFeeStructureItem): Promise<FeeStructureItem>;
  updateFeeStructureItem(id: string, feeStructureItem: Partial<InsertFeeStructureItem>): Promise<FeeStructureItem>;
  deleteFeeStructureItem(id: string): Promise<void>;

  // Student Fee Assignments operations
  getStudentFeeAssignments(schoolId: string, academicSessionId?: string): Promise<StudentFeeAssignment[]>;
  getStudentFeeAssignment(id: string): Promise<StudentFeeAssignment | undefined>;
  getStudentFeeAssignmentByStudent(studentId: string, academicSessionId: string): Promise<StudentFeeAssignment | undefined>;
  createStudentFeeAssignment(assignment: InsertStudentFeeAssignment): Promise<StudentFeeAssignment>;
  updateStudentFeeAssignment(id: string, assignment: Partial<InsertStudentFeeAssignment>): Promise<StudentFeeAssignment>;
  deleteStudentFeeAssignment(id: string): Promise<void>;
  assignFeeStructureToStudent(studentId: string, feeStructureId: string, academicSessionId: string, assignedBy: string, discountPercentage?: number, discountAmount?: number, discountReason?: string): Promise<StudentFeeAssignment>;

  // Fee Invoices operations
  getFeeInvoices(schoolId: string, academicSessionId?: string): Promise<FeeInvoice[]>;
  getFeeInvoice(id: string): Promise<FeeInvoice | undefined>;
  getFeeInvoicesByStudent(studentId: string, academicSessionId: string): Promise<FeeInvoice[]>;
  createFeeInvoice(invoice: InsertFeeInvoice): Promise<FeeInvoice>;
  updateFeeInvoice(id: string, invoice: Partial<InsertFeeInvoice>): Promise<FeeInvoice>;
  deleteFeeInvoice(id: string): Promise<void>;
  generateInvoiceForStudent(studentId: string, academicSessionId: string, generatedBy: string): Promise<FeeInvoice>;
  updateInvoiceStatus(invoiceId: string, status: string): Promise<FeeInvoice>;

  // Fee Invoice Items operations
  getFeeInvoiceItems(invoiceId: string): Promise<FeeInvoiceItem[]>;
  getFeeInvoiceItem(id: string): Promise<FeeInvoiceItem | undefined>;
  createFeeInvoiceItem(invoiceItem: InsertFeeInvoiceItem): Promise<FeeInvoiceItem>;
  updateFeeInvoiceItem(id: string, invoiceItem: Partial<InsertFeeInvoiceItem>): Promise<FeeInvoiceItem>;
  deleteFeeInvoiceItem(id: string): Promise<void>;

  // Fee Payments operations
  getFeePayments(schoolId: string): Promise<FeePayment[]>;
  getFeePayment(id: string): Promise<FeePayment | undefined>;
  getFeePaymentsByInvoice(invoiceId: string): Promise<FeePayment[]>;
  getFeePaymentsByStudent(studentId: string): Promise<FeePayment[]>;
  createFeePayment(payment: InsertFeePayment): Promise<FeePayment>;
  updateFeePayment(id: string, payment: Partial<InsertFeePayment>): Promise<FeePayment>;
  deleteFeePayment(id: string): Promise<void>;
  recordPayment(invoiceId: string, amount: number, paymentMethod: string, paymentMode: string, collectedBy: string, paymentDate: string, transactionId?: string, referenceNumber?: string, bankName?: string, notes?: string): Promise<FeePayment>;

  // Fee Notifications operations
  getFeeNotifications(schoolId: string): Promise<FeeNotification[]>;
  getFeeNotification(id: string): Promise<FeeNotification | undefined>;
  getFeeNotificationsByStudent(studentId: string): Promise<FeeNotification[]>;
  createFeeNotification(notification: InsertFeeNotification): Promise<FeeNotification>;
  updateFeeNotification(id: string, notification: Partial<InsertFeeNotification>): Promise<FeeNotification>;
  deleteFeeNotification(id: string): Promise<void>;
  createDueReminder(invoiceId: string, studentId: string, schoolId: string): Promise<FeeNotification>;
  createOverdueAlert(invoiceId: string, studentId: string, schoolId: string): Promise<FeeNotification>;

  // ============================================================================
  // TRANSPORT MANAGEMENT OPERATIONS
  // ============================================================================

  // Transport Routes operations
  getTransportRoutes(schoolId: string): Promise<TransportRoute[]>;
  getTransportRoute(id: string): Promise<TransportRoute | undefined>;
  createTransportRoute(route: InsertTransportRoute): Promise<TransportRoute>;
  updateTransportRoute(id: string, route: Partial<InsertTransportRoute>): Promise<TransportRoute>;
  deleteTransportRoute(id: string): Promise<void>;

  // Transport Stops operations
  getTransportStops(routeId: string): Promise<TransportStop[]>;
  getTransportStop(id: string): Promise<TransportStop | undefined>;
  createTransportStop(stop: InsertTransportStop): Promise<TransportStop>;
  updateTransportStop(id: string, stop: Partial<InsertTransportStop>): Promise<TransportStop>;
  deleteTransportStop(id: string): Promise<void>;

  // Transport Vehicles operations
  getTransportVehicles(schoolId: string): Promise<TransportVehicle[]>;
  getTransportVehicle(id: string): Promise<TransportVehicle | undefined>;
  createTransportVehicle(vehicle: InsertTransportVehicle): Promise<TransportVehicle>;
  updateTransportVehicle(id: string, vehicle: Partial<InsertTransportVehicle>): Promise<TransportVehicle>;
  deleteTransportVehicle(id: string): Promise<void>;

  // Transport Route Assignments operations
  getTransportRouteAssignments(schoolId: string, academicSessionId?: string): Promise<TransportRouteAssignment[]>;
  getTransportRouteAssignment(id: string): Promise<TransportRouteAssignment | undefined>;
  createTransportRouteAssignment(assignment: InsertTransportRouteAssignment): Promise<TransportRouteAssignment>;
  updateTransportRouteAssignment(id: string, assignment: Partial<InsertTransportRouteAssignment>): Promise<TransportRouteAssignment>;
  deleteTransportRouteAssignment(id: string): Promise<void>;

  // Transport Student Assignments operations
  getTransportStudentAssignments(schoolId: string, academicSessionId?: string): Promise<TransportStudentAssignment[]>;
  getTransportStudentAssignment(id: string): Promise<TransportStudentAssignment | undefined>;
  getTransportStudentAssignmentsByStudent(studentId: string, academicSessionId: string): Promise<TransportStudentAssignment[]>;
  createTransportStudentAssignment(assignment: InsertTransportStudentAssignment): Promise<TransportStudentAssignment>;
  updateTransportStudentAssignment(id: string, assignment: Partial<InsertTransportStudentAssignment>): Promise<TransportStudentAssignment>;
  deleteTransportStudentAssignment(id: string): Promise<void>;
  assignStudentToRoute(studentId: string, routeId: string, stopId: string, academicSessionId: string, assignedBy: string, transportType?: string, monthlyFee?: number): Promise<TransportStudentAssignment>;

  // Fee and Transport Integration operations
  getFeeInvoiceWithTransportFees(studentId: string, academicSessionId: string): Promise<FeeInvoice | undefined>;
  updateInvoiceWithTransportFees(invoiceId: string, transportFees: number): Promise<FeeInvoice>;

  // Incremental Change Request operations
  getIncrementalChangeRequests(schoolId: string, status?: string): Promise<IncrementalChangeRequest[]>;
  getIncrementalChangeRequest(id: string): Promise<IncrementalChangeRequest | undefined>;
  createIncrementalChangeRequest(request: InsertIncrementalChangeRequest): Promise<IncrementalChangeRequest>;
  updateIncrementalChangeRequest(id: string, request: Partial<InsertIncrementalChangeRequest>): Promise<IncrementalChangeRequest>;
  deleteIncrementalChangeRequest(id: string): Promise<void>;
  
  // Conflict Detection Result operations
  getConflictDetectionResults(changeRequestId: string): Promise<ConflictDetectionResult[]>;
  getConflictDetectionResult(id: string): Promise<ConflictDetectionResult | undefined>;
  createConflictDetectionResult(result: InsertConflictDetectionResult): Promise<ConflictDetectionResult>;
  updateConflictDetectionResult(id: string, result: Partial<InsertConflictDetectionResult>): Promise<ConflictDetectionResult>;
  deleteConflictDetectionResult(id: string): Promise<void>;
  deleteConflictDetectionResultsByRequest(changeRequestId: string): Promise<void>;
  
  // Change Impact Analysis operations
  getChangeImpactAnalysis(changeRequestId: string): Promise<ChangeImpactAnalysis | undefined>;
  createChangeImpactAnalysis(analysis: InsertChangeImpactAnalysis): Promise<ChangeImpactAnalysis>;
  updateChangeImpactAnalysis(id: string, analysis: Partial<InsertChangeImpactAnalysis>): Promise<ChangeImpactAnalysis>;
  deleteChangeImpactAnalysis(id: string): Promise<void>;
  deleteChangeImpactAnalysisByRequest(changeRequestId: string): Promise<void>;

  // Additional helper methods for incremental updates
  getClassSubjectAssignmentsBySubject(subjectId: string): Promise<ClassSubjectAssignment[]>;
  getClassSubjectAssignmentsByTeacher(teacherId: string): Promise<ClassSubjectAssignment[]>;

  // School Settings operations
  getSchoolSetting(schoolId: string, settingKey: string): Promise<SchoolSetting | undefined>;
  getSchoolSettings(schoolId: string, category?: string): Promise<SchoolSetting[]>;
  createSchoolSetting(setting: InsertSchoolSetting): Promise<SchoolSetting>;
  updateSchoolSetting(schoolId: string, settingKey: string, settingValue: any, lastModifiedBy: string): Promise<SchoolSetting>;
  deleteSchoolSetting(schoolId: string, settingKey: string): Promise<void>;

  // Calendar Events operations
  getCalendarEvents(schoolId: string, filters?: { month?: number; year?: number; eventType?: string }): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getCalendarHolidays(schoolId: string): Promise<CalendarEvent[]>;
  getUpcomingCalendarEvents(schoolId: string, days?: number): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<void>;

  // Admission Management operations
  getAdmissionApplications(schoolId: string, filters?: { status?: string; classId?: string; sessionId?: string }): Promise<AdmissionApplication[]>;
  getAdmissionApplication(id: string): Promise<AdmissionApplication | undefined>;
  createAdmissionApplication(application: InsertAdmissionApplication): Promise<AdmissionApplication>;
  updateAdmissionApplication(id: string, application: Partial<InsertAdmissionApplication>): Promise<AdmissionApplication>;
  deleteAdmissionApplication(id: string): Promise<void>;
  getAdmissionDocuments(applicationId: string): Promise<AdmissionDocument[]>;
  createAdmissionDocument(document: InsertAdmissionDocument): Promise<AdmissionDocument>;
  deleteAdmissionDocument(id: string): Promise<void>;

  // Exam Module operations
  getExams(schoolId: string, filters?: { academicSessionId?: string; examType?: string }): Promise<Exam[]>;
  getExam(id: string): Promise<Exam | undefined>;
  createExam(exam: InsertExam): Promise<Exam>;
  updateExam(id: string, exam: Partial<InsertExam>): Promise<Exam>;
  deleteExam(id: string): Promise<void>;
  getExamSubjects(examId: string): Promise<ExamSubject[]>;
  createExamSubject(examSubject: InsertExamSubject): Promise<ExamSubject>;
  updateExamSubjectMaxMarks(examSubjectId: string, maxMarks: number, schoolId: string): Promise<ExamSubject | null>;
  updateExamSubjectMarks(examSubjectId: string, updateData: { maxMarks?: number; passingMarks?: number }, schoolId: string): Promise<ExamSubject | null>;
  deleteExamSubject(id: string): Promise<void>;
  getExamMarks(examId: string): Promise<ExamMark[]>;
  getStudentExamMarks(examId: string, studentId: string): Promise<ExamMark[]>;
  createExamMark(mark: InsertExamMark): Promise<ExamMark>;
  updateExamMark(id: string, mark: Partial<InsertExamMark>): Promise<ExamMark>;
  deleteExamMark(id: string): Promise<void>;
  getExamResults(examId: string): Promise<ExamResult[]>;
  getStudentExamResult(examId: string, studentId: string): Promise<ExamResult | undefined>;
  createExamResult(result: InsertExamResult): Promise<ExamResult>;
  updateExamResult(id: string, result: Partial<InsertExamResult>): Promise<ExamResult>;
  deleteExamResult(id: string): Promise<void>;

  // Hostel Management operations
  getHostels(schoolId: string): Promise<Hostel[]>;
  getHostel(id: string): Promise<Hostel | undefined>;
  createHostel(hostel: InsertHostel): Promise<Hostel>;
  updateHostel(id: string, hostel: Partial<InsertHostel>): Promise<Hostel>;
  deleteHostel(id: string): Promise<void>;
  
  getHostelRooms(hostelId: string): Promise<HostelRoom[]>;
  getHostelRoom(id: string): Promise<HostelRoom | undefined>;
  createHostelRoom(room: InsertHostelRoom): Promise<HostelRoom>;
  updateHostelRoom(id: string, room: Partial<InsertHostelRoom>): Promise<HostelRoom>;
  deleteHostelRoom(id: string): Promise<void>;
  
  getHostelAllocations(filters?: { schoolId?: string; hostelId?: string; studentId?: string; isActive?: boolean; sessionId?: string }): Promise<HostelAllocation[]>;
  getHostelAllocation(id: string): Promise<HostelAllocation | undefined>;
  createHostelAllocation(allocation: InsertHostelAllocation): Promise<HostelAllocation>;
  updateHostelAllocation(id: string, allocation: Partial<InsertHostelAllocation>): Promise<HostelAllocation>;
  deleteHostelAllocation(id: string): Promise<void>;
  
  getHostelFees(filters?: { schoolId?: string; hostelId?: string; studentId?: string; paymentStatus?: string; sessionId?: string }): Promise<HostelFee[]>;
  getHostelFee(id: string): Promise<HostelFee | undefined>;
  createHostelFee(fee: InsertHostelFee): Promise<HostelFee>;
  updateHostelFee(id: string, fee: Partial<InsertHostelFee>): Promise<HostelFee>;
  deleteHostelFee(id: string): Promise<void>;

  // Inventory Management operations
  getInventoryCategories(schoolId: string): Promise<InventoryCategory[]>;
  getInventoryCategory(id: string): Promise<InventoryCategory | undefined>;
  createInventoryCategory(category: InsertInventoryCategory): Promise<InventoryCategory>;
  updateInventoryCategory(id: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory>;
  deleteInventoryCategory(id: string): Promise<void>;

  getInventoryItems(schoolId: string, filters?: { categoryId?: string; lowStock?: boolean }): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<void>;
  getLowStockItems(schoolId: string): Promise<InventoryItem[]>;

  getInventoryTransactions(filters?: { itemId?: string; transactionType?: string; startDate?: string; endDate?: string }): Promise<InventoryTransaction[]>;
  getInventoryTransaction(id: string): Promise<InventoryTransaction | undefined>;
  createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;
  getItemTransactions(itemId: string): Promise<InventoryTransaction[]>;

  // Payroll operations
  getPayrollEmployees(schoolId: string): Promise<PayrollEmployee[]>;
  getPayrollEmployee(id: string): Promise<PayrollEmployee | undefined>;
  createPayrollEmployee(employee: InsertPayrollEmployee): Promise<PayrollEmployee>;
  updatePayrollEmployee(id: string, employee: Partial<InsertPayrollEmployee>): Promise<PayrollEmployee>;
  deletePayrollEmployee(id: string): Promise<void>;

  getSalaryComponents(employeeId: string): Promise<SalaryComponent[]>;
  getSalaryComponent(id: string): Promise<SalaryComponent | undefined>;
  createSalaryComponent(component: InsertSalaryComponent): Promise<SalaryComponent>;
  updateSalaryComponent(id: string, component: Partial<InsertSalaryComponent>): Promise<SalaryComponent>;
  deleteSalaryComponent(id: string): Promise<void>;

  getPayrollCycles(schoolId: string, filters?: { month?: number; year?: number; status?: string }): Promise<PayrollCycle[]>;
  getPayrollCycle(id: string): Promise<PayrollCycle | undefined>;
  createPayrollCycle(cycle: InsertPayrollCycle): Promise<PayrollCycle>;
  updatePayrollCycle(id: string, cycle: Partial<InsertPayrollCycle>): Promise<PayrollCycle>;
  processPayrollCycle(cycleId: string, processedBy: string): Promise<{ success: boolean; message: string; payslips: PayrollPayslip[] }>;
  markCycleAsPaid(cycleId: string): Promise<PayrollCycle>;

  getPayrollPayslips(cycleId: string): Promise<PayrollPayslip[]>;
  getPayrollPayslip(id: string): Promise<PayrollPayslip | undefined>;
  markPayslipAsPaid(id: string, paymentDate: Date): Promise<PayrollPayslip>;
  getPayrollEmployeeByUserId(userId: string, schoolId: string): Promise<PayrollEmployee | undefined>;
  getTeacherPayslips(payrollEmployeeId: string): Promise<PayrollPayslip[]>;

  // Expense Management operations
  getExpenseCategories(schoolId: string): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: string): Promise<void>;

  getExpenses(schoolId: string, filters?: { categoryId?: string; sessionId?: string; status?: string; startDate?: string; endDate?: string }): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  approveExpense(id: string, approvedBy: string): Promise<Expense>;
  rejectExpense(id: string, approvedBy: string): Promise<Expense>;

  getBudgets(schoolId: string, filters?: { categoryId?: string; sessionId?: string }): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, budget: Partial<InsertBudget>): Promise<Budget>;
  getBudgetSummary(schoolId: string, sessionId?: string): Promise<any[]>;
  updateBudgetSpent(categoryId: string, sessionId: string, amount: number): Promise<void>;
}

// Helper function to generate temporary password using crypto
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    const randomIndex = randomInt(0, chars.length);
    password += chars.charAt(randomIndex);
  }
  return password;
}

// Helper function to generate temporary password expiry
function generateTemporaryPasswordExpiry(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 48); // 48 hours from now
  return expiryDate;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByLoginId(loginId: string, schoolId?: string): Promise<User | undefined> {
    // Build conditions - combine loginId and optional schoolId properly
    const conditions = [eq(users.loginId, loginId)];
    if (schoolId) {
      conditions.push(eq(users.schoolId, schoolId));
    }
    
    const [user] = await db.select().from(users).where(and(...conditions));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    // Find user by matching their teacher's contact number
    const [result] = await db
      .select({
        user: users,
      })
      .from(users)
      .innerJoin(teachers, eq(users.teacherId, teachers.id))
      .where(eq(teachers.contactNumber, phone))
      .limit(1);
    
    return result?.user;
  }

  async getUsersBySchoolId(schoolId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.schoolId, schoolId));
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Temporary password operations
  async setTemporaryPassword(userId: string, hashedPassword: string, expiresAt: Date): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        temporaryPassword: hashedPassword,
        temporaryPasswordExpiresAt: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async clearTemporaryPassword(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        temporaryPassword: null,
        temporaryPasswordExpiresAt: null,
        isFirstLogin: false,
        passwordChangedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async validateTemporaryPassword(userId: string, password: string): Promise<{ isValid: boolean; isExpired: boolean; user?: User }> {
    const user = await this.getUser(userId);
    if (!user || !user.temporaryPassword) {
      return { isValid: false, isExpired: false };
    }

    // Check if temporary password is expired
    const isExpired = !user.temporaryPasswordExpiresAt || new Date() > user.temporaryPasswordExpiresAt;
    if (isExpired) {
      return { isValid: false, isExpired: true };
    }

    // Import bcrypt to compare passwords
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.temporaryPassword);
    
    return { 
      isValid: isValidPassword, 
      isExpired: false, 
      user: isValidPassword ? user : undefined 
    };
  }

  // User Preferences operations
  async saveUserPreference(userId: string, key: string, value: any): Promise<void> {
    try {
      await db
        .insert(userPreferences)
        .values({
          userId,
          key,
          value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.key],
          set: {
            value,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error('Error saving user preference:', error);
      throw error;
    }
  }

  async getUserPreference(userId: string, key: string): Promise<any | null> {
    try {
      const [preference] = await db
        .select()
        .from(userPreferences)
        .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)));
      
      return preference?.value || null;
    } catch (error) {
      console.error('Error getting user preference:', error);
      throw error;
    }
  }

  // School operations
  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchoolsWithAdminEmails(): Promise<(School & { adminEmail?: string })[]> {
    const schoolsWithAdmins = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        contactPhone: schools.contactPhone,
        adminName: schools.adminName,
        isActive: schools.isActive,
        timetableFrozen: schools.timetableFrozen,
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
        adminEmail: users.email,
      })
      .from(schools)
      .leftJoin(users, and(eq(schools.id, users.schoolId), eq(users.role, "admin")))
      .orderBy(asc(schools.name));
    
    return schoolsWithAdmins.map(school => ({
      ...school,
      adminEmail: school.adminEmail || undefined
    }));
  }

  async getSchool(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(schoolData: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(schoolData).returning();
    return school;
  }

  async updateSchool(id: string, schoolData: Partial<InsertSchool>): Promise<School> {
    const [school] = await db
      .update(schools)
      .set({ ...schoolData, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();
    
    if (!school) {
      throw new Error(`School with id ${id} not found`);
    }
    
    return school;
  }

  async deleteSchool(id: string): Promise<void> {
    console.log(`[DELETE SCHOOL] Starting complete deletion of school: ${id}`);
    
    // DELETE EVERYTHING including the school record and ALL user accounts (including admins)
    // This is different from clearSchoolData which preserves the school and admin accounts
    
    // STEP 1: Delete all school data using the same comprehensive approach as clearSchoolData
    // But this time we delete EVERYTHING including admins
    
    // Delete class assignments
    const classIds = await db.select({ id: classes.id }).from(classes).where(eq(classes.schoolId, id));
    if (classIds.length > 0) {
      await db.delete(classSubjectAssignments).where(
        inArray(classSubjectAssignments.classId, classIds.map(c => c.id))
      );
      await db.delete(classTeacherAssignments).where(
        inArray(classTeacherAssignments.classId, classIds.map(c => c.id))
      );
    }
    
    // Delete simulation data
    await db.delete(simulationScenarios).where(eq(simulationScenarios.schoolId, id));
    
    // Delete fee management data
    await db.delete(feeNotifications).where(eq(feeNotifications.schoolId, id));
    await db.delete(feePayments).where(eq(feePayments.schoolId, id));
    await db.delete(feeInvoices).where(eq(feeInvoices.schoolId, id));
    await db.delete(studentFeeAssignments).where(eq(studentFeeAssignments.schoolId, id));
    await db.delete(feeStructures).where(eq(feeStructures.schoolId, id));
    await db.delete(feeTypes).where(eq(feeTypes.schoolId, id));
    
    // Delete transport data
    await db.delete(transportStudentAssignments).where(eq(transportStudentAssignments.schoolId, id));
    await db.delete(transportRouteAssignments).where(eq(transportRouteAssignments.schoolId, id));
    await db.delete(transportVehicles).where(eq(transportVehicles.schoolId, id));
    await db.delete(transportRoutes).where(eq(transportRoutes.schoolId, id));
    
    // Delete exam, hostel, inventory, payroll data
    await db.delete(exams).where(eq(exams.schoolId, id));
    await db.delete(hostels).where(eq(hostels.schoolId, id));
    await db.delete(inventoryItems).where(eq(inventoryItems.schoolId, id));
    await db.delete(inventoryCategories).where(eq(inventoryCategories.schoolId, id));
    await db.delete(payrollCycles).where(eq(payrollCycles.schoolId, id));
    await db.delete(payrollEmployees).where(eq(payrollEmployees.schoolId, id));
    
    // Delete financial, admission, timetable data
    await db.delete(budgets).where(eq(budgets.schoolId, id));
    await db.delete(expenses).where(eq(expenses.schoolId, id));
    await db.delete(expenseCategories).where(eq(expenseCategories.schoolId, id));
    await db.delete(admissionApplications).where(eq(admissionApplications.schoolId, id));
    await db.delete(incrementalChangeRequests).where(eq(incrementalChangeRequests.schoolId, id));
    await db.delete(teacherSubstitutions).where(eq(teacherSubstitutions.schoolId, id));
    await db.delete(weeklyTimetables).where(eq(weeklyTimetables.schoolId, id));
    await db.delete(timetableStructures).where(eq(timetableStructures.schoolId, id));
    
    // Delete calendar, communication, attendance data
    await db.delete(calendarEvents).where(eq(calendarEvents.schoolId, id));
    await db.delete(posts).where(eq(posts.schoolId, id));
    await db.delete(messages).where(eq(messages.schoolId, id));
    await db.delete(auditLogs).where(eq(auditLogs.schoolId, id));
    await db.delete(teacherAttendance).where(eq(teacherAttendance.schoolId, id));
    await db.delete(studentAttendance).where(eq(studentAttendance.schoolId, id));
    
    // Delete settings and permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.schoolId, id));
    await db.delete(teacherPlannerSettings).where(eq(teacherPlannerSettings.schoolId, id));
    
    // Delete core entities
    await db.delete(teachers).where(eq(teachers.schoolId, id));
    await db.delete(students).where(eq(students.schoolId, id));
    await db.delete(parents).where(eq(parents.schoolId, id));
    await db.delete(classes).where(eq(classes.schoolId, id));
    await db.delete(subjects).where(eq(subjects.schoolId, id));
    
    // Delete academic sessions and settings
    await db.delete(academicSessions).where(eq(academicSessions.schoolId, id));
    await db.delete(schoolSettings).where(eq(schoolSettings.schoolId, id));
    
    // STEP 2: Delete ALL user accounts including admins (different from clearSchoolData)
    console.log(`[DELETE SCHOOL] Deleting ALL user accounts including admins`);
    await db.delete(users).where(eq(users.schoolId, id));
    
    // STEP 3: Finally delete the school record itself
    console.log(`[DELETE SCHOOL] Deleting school record`);
    await db.delete(schools).where(eq(schools.id, id));
    
    console.log(`[DELETE SCHOOL] ✅ School ${id} and ALL associated data deleted completely`);
  }

  async clearSchoolData(id: string): Promise<void> {
    console.log(`[CLEAR DATA] Starting comprehensive data clear for school: ${id}`);
    
    // DELETE ALL SCHOOL DATA IN CORRECT ORDER TO RESPECT FOREIGN KEY CONSTRAINTS
    // This removes ALL data but keeps the school entity and admin login credentials
    
    // STEP 1: Delete child tables that reference core entities (classes, teachers, students)
    const classIds = await db.select({ id: classes.id }).from(classes).where(eq(classes.schoolId, id));
    
    if (classIds.length > 0) {
      console.log(`[CLEAR DATA] Deleting class-related assignments for ${classIds.length} classes`);
      await db.delete(classSubjectAssignments).where(
        inArray(classSubjectAssignments.classId, classIds.map(c => c.id))
      );
      await db.delete(classTeacherAssignments).where(
        inArray(classTeacherAssignments.classId, classIds.map(c => c.id))
      );
    }
    
    // STEP 2: Delete simulation data (AI Teacher Requirement Planner)
    console.log(`[CLEAR DATA] Deleting simulation scenarios and related data`);
    await db.delete(simulationScenarios).where(eq(simulationScenarios.schoolId, id));
    // CASCADE will handle: simulationClasses, simulationSubjects, simulationTeachers, 
    // simulationClassSubjects, simulationAssignments
    
    // STEP 3: Delete fee management data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting fee management data`);
    await db.delete(feeNotifications).where(eq(feeNotifications.schoolId, id));
    await db.delete(feePayments).where(eq(feePayments.schoolId, id));
    await db.delete(feeInvoices).where(eq(feeInvoices.schoolId, id));
    await db.delete(studentFeeAssignments).where(eq(studentFeeAssignments.schoolId, id));
    await db.delete(feeStructures).where(eq(feeStructures.schoolId, id));
    await db.delete(feeTypes).where(eq(feeTypes.schoolId, id));
    // Note: feeInvoiceItems, feeStructureItems don't have schoolId, they CASCADE from parent tables
    
    // STEP 4: Delete transport management data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting transport management data`);
    await db.delete(transportStudentAssignments).where(eq(transportStudentAssignments.schoolId, id));
    await db.delete(transportRouteAssignments).where(eq(transportRouteAssignments.schoolId, id));
    await db.delete(transportVehicles).where(eq(transportVehicles.schoolId, id));
    await db.delete(transportRoutes).where(eq(transportRoutes.schoolId, id));
    // Note: transportStops doesn't have schoolId, it CASCADEs from transportRoutes
    
    // STEP 5: Delete exam data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting exam and results data`);
    await db.delete(exams).where(eq(exams.schoolId, id));
    // Note: examSubjects, examMarks, examResults don't have schoolId, they CASCADE from exams
    
    // STEP 6: Delete hostel data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting hostel management data`);
    await db.delete(hostels).where(eq(hostels.schoolId, id));
    // Note: hostelRooms, hostelAllocations, hostelFees don't have schoolId, they CASCADE from hostels
    
    // STEP 7: Delete inventory data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting inventory data`);
    await db.delete(inventoryItems).where(eq(inventoryItems.schoolId, id));
    await db.delete(inventoryCategories).where(eq(inventoryCategories.schoolId, id));
    // Note: inventoryTransactions doesn't have schoolId, it CASCADEs from inventoryItems
    
    // STEP 8: Delete payroll data (all tables with schoolId)
    console.log(`[CLEAR DATA] Deleting payroll data`);
    await db.delete(payrollCycles).where(eq(payrollCycles.schoolId, id));
    await db.delete(payrollEmployees).where(eq(payrollEmployees.schoolId, id));
    // Note: payslips, salaryComponents don't have schoolId, they CASCADE from parent tables
    
    // STEP 9: Delete financial data
    console.log(`[CLEAR DATA] Deleting financial and expense data`);
    await db.delete(budgets).where(eq(budgets.schoolId, id));
    await db.delete(expenses).where(eq(expenses.schoolId, id));
    await db.delete(expenseCategories).where(eq(expenseCategories.schoolId, id));
    
    // STEP 10: Delete admission data (CASCADE will handle child tables)
    console.log(`[CLEAR DATA] Deleting admission applications`);
    await db.delete(admissionApplications).where(eq(admissionApplications.schoolId, id));
    // admissionDocuments will CASCADE from admissionApplications
    
    // STEP 11: Delete timetable and related data
    console.log(`[CLEAR DATA] Deleting timetable data`);
    await db.delete(incrementalChangeRequests).where(eq(incrementalChangeRequests.schoolId, id));
    // CASCADE handles: changeImpactAnalysis, conflictDetectionResults
    await db.delete(teacherSubstitutions).where(eq(teacherSubstitutions.schoolId, id));
    await db.delete(weeklyTimetables).where(eq(weeklyTimetables.schoolId, id));
    // timetableChanges, timetableValidityPeriods, timetableEntries CASCADE from timetableStructures
    await db.delete(timetableStructures).where(eq(timetableStructures.schoolId, id));
    
    // STEP 12: Delete calendar and other miscellaneous data
    console.log(`[CLEAR DATA] Deleting calendar, posts, messages, and other data`);
    await db.delete(calendarEvents).where(eq(calendarEvents.schoolId, id));
    await db.delete(posts).where(eq(posts.schoolId, id));
    await db.delete(messages).where(eq(messages.schoolId, id));
    await db.delete(auditLogs).where(eq(auditLogs.schoolId, id));
    
    // STEP 13: Delete attendance records
    console.log(`[CLEAR DATA] Deleting attendance records`);
    await db.delete(teacherAttendance).where(eq(teacherAttendance.schoolId, id));
    await db.delete(studentAttendance).where(eq(studentAttendance.schoolId, id));
    
    // STEP 14: Delete role permissions and user preferences
    console.log(`[CLEAR DATA] Deleting role permissions and preferences`);
    await db.delete(rolePermissions).where(eq(rolePermissions.schoolId, id));
    await db.delete(teacherPlannerSettings).where(eq(teacherPlannerSettings.schoolId, id));
    // User preferences will be deleted when users are deleted (CASCADE)
    
    // STEP 15: Delete core entities (students, parents, teachers, classes, subjects)
    console.log(`[CLEAR DATA] Deleting core entities`);
    await db.delete(teachers).where(eq(teachers.schoolId, id));
    // CASCADE will handle: teacher leave records, teacher availability, teacher profiles
    
    await db.delete(students).where(eq(students.schoolId, id));
    // CASCADE will handle: student profiles
    
    await db.delete(parents).where(eq(parents.schoolId, id));
    
    await db.delete(classes).where(eq(classes.schoolId, id));
    
    await db.delete(subjects).where(eq(subjects.schoolId, id));
    
    // STEP 16: Delete school settings only (preserve academic sessions)
    console.log(`[CLEAR DATA] Deleting school settings (academic sessions preserved)`);
    await db.delete(schoolSettings).where(eq(schoolSettings.schoolId, id));
    
    // STEP 17: Delete user accounts (LAST - except admin and super admin)
    // This preserves the school admin's login credentials for fresh start
    console.log(`[CLEAR DATA] Deleting user accounts (except admins)`);
    await db.delete(users).where(
      and(
        eq(users.schoolId, id),
        ne(users.role, 'super_admin'),
        ne(users.role, 'admin')
      )
    );
    
    console.log(`[CLEAR DATA] ✅ Successfully cleared ALL data for school: ${id}`);
    console.log(`[CLEAR DATA] School admin login and academic sessions preserved for fresh start`);
  }

  // Teacher operations
  async getTeachers(schoolId?: string, offset?: number, limit?: number): Promise<Teacher[]> {
    // Build optimized query with LEFT JOIN to fetch all teacher and class data in one query
    const query = db
      .select({
        teacher: teachers,
        classId: classSubjectAssignments.classId,
        className: sql<string>`CONCAT('Class ', ${classes.grade}, ' ', COALESCE(${classes.section}, ''))`.as('className'),
      })
      .from(teachers)
      .leftJoin(
        classSubjectAssignments,
        eq(teachers.id, classSubjectAssignments.assignedTeacherId)
      )
      .leftJoin(
        classes,
        eq(classSubjectAssignments.classId, classes.id)
      )
      .where(
        schoolId
          ? and(eq(teachers.isActive, true), eq(teachers.schoolId, schoolId))
          : eq(teachers.isActive, true)
      )
      .orderBy(teachers.name);
    
    const results = await query;
    
    // Group results by teacher and aggregate their classes
    const teacherMap = new Map<string, any>();
    
    for (const row of results) {
      const teacherId = row.teacher.id;
      
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          ...row.teacher,
          classIds: [],
          classDisplayNames: [],
          classes: [], // For backward compatibility
          classAssignments: [],
        });
      }
      
      // Add class info if it exists (LEFT JOIN may return null for teachers without classes)
      if (row.classId && row.className) {
        const teacher = teacherMap.get(teacherId);
        
        // Avoid duplicates (teacher might teach multiple subjects in same class)
        if (!teacher.classIds.includes(row.classId)) {
          teacher.classIds.push(row.classId);
          teacher.classDisplayNames.push(row.className);
          teacher.classes.push(row.classId);
          teacher.classAssignments.push({
            classId: row.classId,
            className: row.className,
          });
        }
      }
    }
    
    // Convert map to array and apply pagination
    let teachersArray = Array.from(teacherMap.values());
    
    // Apply offset and limit after grouping (since we can't do it in SQL with the JOIN)
    if (offset !== undefined && limit !== undefined) {
      teachersArray = teachersArray.slice(offset, offset + limit);
    } else if (offset !== undefined) {
      teachersArray = teachersArray.slice(offset);
    } else if (limit !== undefined) {
      teachersArray = teachersArray.slice(0, limit);
    }
    
    return teachersArray;
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async getTeacherCountBySchool(schoolId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(teachers)
      .where(and(eq(teachers.schoolId, schoolId), eq(teachers.isActive, true)));
    return result[0]?.count || 0;
  }

  async createTeacher(teacher: InsertTeacher): Promise<Teacher> {
    const [created] = await db.insert(teachers).values(teacher).returning();
    return created;
  }

  /**
   * Generate next sequential teacher employee ID in T#### format
   * Queries database for highest existing teacher ID and returns next number
   */
  async generateNextTeacherEmployeeId(): Promise<string> {
    const result = await db
      .select({ employeeId: teachers.employeeId })
      .from(teachers)
      .where(sql`${teachers.employeeId} ~ '^T[0-9]+$'`)
      .orderBy(sql`CAST(SUBSTRING(${teachers.employeeId} FROM 2) AS INTEGER) DESC`)
      .limit(1);
    
    const lastId = result[0]?.employeeId;
    const nextNumber = lastId ? parseInt(lastId.substring(1)) + 1 : 1001;
    return `T${nextNumber}`;
  }

  async updateTeacher(id: string, teacher: Partial<InsertTeacher>): Promise<Teacher> {
    const updateData = { ...teacher, updatedAt: new Date() };
    const [updated] = await db
      .update(teachers)
      .set(updateData)
      .where(eq(teachers.id, id))
      .returning();
    return updated;
  }

  async deleteTeacher(id: string): Promise<void> {
    await db.update(teachers).set({ isActive: false }).where(eq(teachers.id, id));
  }

  async getAvailableTeachers(day: string, period: number, subjectId: string | null, schoolId: string): Promise<Teacher[]> {
    try {
      // TEMPORARY DEBUG VERSION - Just return all active teachers for now
      const allTeachers = await db
        .select()
        .from(teachers)
        .where(eq(teachers.isActive, true));

      console.log(`[DEBUG] Total active teachers found: ${allTeachers.length}`);
      console.log(`[DEBUG] Teachers:`, allTeachers.map(t => `${t.name} (${t.schoolId})`));
      console.log(`[DEBUG] Looking for schoolId: ${schoolId}`);

      // Filter by school
      const schoolTeachers = allTeachers.filter(t => t.schoolId === schoolId);
      console.log(`[DEBUG] Teachers in school: ${schoolTeachers.length}`);

      // For debugging, let's just return all teachers in the school without any other filtering
      // This will help us confirm the basic functionality works
      return schoolTeachers;
    } catch (error) {
      console.error(`[STORAGE ERROR] getAvailableTeachers failed:`, error);
      return [];
    }
  }

  // Subject operations
  async getSubjects(schoolId?: string): Promise<Subject[]> {
    if (schoolId) {
      return await db.select().from(subjects).where(eq(subjects.schoolId, schoolId));
    }
    return await db.select().from(subjects);
  }

  async getSubject(id: string): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [created] = await db.insert(subjects).values(subject).returning();
    return created;
  }

  async updateSubject(id: string, subject: Partial<InsertSubject>): Promise<Subject> {
    const [updated] = await db
      .update(subjects)
      .set({ ...subject, updatedAt: new Date() })
      .where(eq(subjects.id, id))
      .returning();
    return updated;
  }

  async deleteSubject(id: string): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async checkSubjectCodeExists(code: string, schoolId: string, excludeId?: string): Promise<boolean> {
    const conditions = [eq(subjects.code, code), eq(subjects.schoolId, schoolId)];
    if (excludeId) {
      conditions.push(ne(subjects.id, excludeId));
    }
    
    const [existing] = await db.select().from(subjects).where(and(...conditions)).limit(1);
    return !!existing;
  }


  // Class operations
  async getClasses(schoolId?: string, academicSessionId?: string): Promise<Class[]> {
    const conditions = [];
    
    // Always require session context to prevent cross-session data mixing
    if (academicSessionId) {
      conditions.push(eq(classes.academicSessionId, academicSessionId));
    } else if (schoolId) {
      // Get current session for the school if no session specified
      const currentSession = await this.getCurrentAcademicSession(schoolId);
      if (currentSession) {
        conditions.push(eq(classes.academicSessionId, currentSession.id));
      } else {
        // No current session found, return empty array to prevent data mixing
        return [];
      }
    } else {
      // No school or session context provided, cannot determine session scope
      return [];
    }
    
    if (schoolId) {
      conditions.push(eq(classes.schoolId, schoolId));
    }
    
    return await db
      .select()
      .from(classes)
      .where(and(...conditions))
      .orderBy(
        asc(classes.grade),
        asc(classes.section)
      );
  }

  async getClass(id: string): Promise<Class | undefined> {
    const [classData] = await db.select().from(classes).where(eq(classes.id, id));
    return classData;
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const [created] = await db.insert(classes).values({
      ...classData,
      requiredSubjects: JSON.stringify(classData.requiredSubjects || []) as any,
    }).returning();
    return created;
  }

  async updateClass(id: string, classData: Partial<InsertClass>): Promise<Class> {
    const updateData: any = { ...classData, updatedAt: new Date() };
    if (classData.requiredSubjects) {
      updateData.requiredSubjects = JSON.stringify(classData.requiredSubjects);
    }
    const [updated] = await db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, id))
      .returning();
    return updated;
  }

  async deleteClass(id: string): Promise<void> {
    // Use transaction to ensure all deletions succeed or none do
    await db.transaction(async (tx) => {
      // 1. Delete all posts associated with this class
      await tx.delete(posts).where(eq(posts.classId, id));
      
      // 2. Delete all class-teacher assignments (teachers assigned to this class)
      await tx.delete(classTeacherAssignments).where(eq(classTeacherAssignments.classId, id));
      
      // 3. Delete all student attendance records for this class
      await tx.delete(studentAttendance).where(eq(studentAttendance.classId, id));
      
      // 4. Delete all timetable-related data for this class
      await tx.delete(timetableEntries).where(eq(timetableEntries.classId, id));
      await tx.delete(weeklyTimetables).where(eq(weeklyTimetables.classId, id));
      await tx.delete(timetableValidityPeriods).where(eq(timetableValidityPeriods.classId, id));
      
      // 6. Delete manual assignment audits for this class
      await tx.delete(manualAssignmentAudits).where(eq(manualAssignmentAudits.classId, id));
      
      // 7. Delete all class-subject assignments that reference this class
      await tx.delete(classSubjectAssignments).where(eq(classSubjectAssignments.classId, id));
      
      // 8. Unassign students from this class and reset roll numbers (set classId to null and rollNumber to "0")
      await tx.update(students)
        .set({ classId: null, rollNumber: "0", updatedAt: new Date() })
        .where(eq(students.classId, id));
      
      // 9. Remove the deleted class ID from all teachers' classes arrays
      // Get the class first to identify the school for efficiency
      const classToDelete = await tx.select({ schoolId: classes.schoolId }).from(classes).where(eq(classes.id, id)).limit(1);
      const schoolId = classToDelete[0]?.schoolId;
      
      // Only update teachers from the same school for efficiency
      const affectedTeachers = await tx.select().from(teachers)
        .where(schoolId ? eq(teachers.schoolId, schoolId) : undefined);
      
      for (const teacher of affectedTeachers) {
        // Handle both array and string formats for backward compatibility
        let currentClasses: string[] = [];
        if (Array.isArray(teacher.classes)) {
          currentClasses = teacher.classes;
        } else if (typeof teacher.classes === 'string') {
          try {
            currentClasses = JSON.parse(teacher.classes);
          } catch {
            currentClasses = [];
          }
        }
        
        const updatedClasses = currentClasses.filter(classId => classId !== id);
        
        // Only update if the teacher actually had this class assigned
        if (currentClasses.length !== updatedClasses.length) {
          await tx.update(teachers)
            .set({ 
              classes: updatedClasses as any, // Keep as array, don't stringify
              updatedAt: new Date() 
            })
            .where(eq(teachers.id, teacher.id));
        }
      }
      
      // 10. Finally delete the class itself
      await tx.delete(classes).where(eq(classes.id, id));
    });
  }

  async getOtherSectionsOfGrade(grade: string, schoolId: string, excludeClassId: string): Promise<Class[]> {
    return await db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.grade, grade),
          eq(classes.schoolId, schoolId),
          ne(classes.id, excludeClassId)
        )
      )
      .orderBy(classes.section);
  }

  async copySubjectsBetweenClasses(sourceClassId: string, targetClassIds: string[], schoolId: string): Promise<{ copiedCount: number; skippedCount: number }> {
    // Get all subject assignments from source class
    const sourceAssignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, sourceClassId));

    // Get academic session from source class
    const sourceClass = await this.getClass(sourceClassId);
    if (!sourceClass) {
      throw new Error(`Source class ${sourceClassId} not found`);
    }

    let copiedCount = 0;
    let skippedCount = 0;

    for (const targetClassId of targetClassIds) {
      // Verify target class exists and belongs to the same school
      const targetClass = await this.getClass(targetClassId);
      if (!targetClass || targetClass.schoolId !== schoolId) {
        skippedCount++;
        continue;
      }

      // Get existing assignments for target class to avoid duplicates (WITHIN SAME SESSION)
      const existingAssignments = await db
        .select({
          subjectId: classSubjectAssignments.subjectId
        })
        .from(classSubjectAssignments)
        .where(
          and(
            eq(classSubjectAssignments.classId, targetClassId),
            eq(classSubjectAssignments.academicSessionId, targetClass.academicSessionId)
          )
        );

      const existingSubjectIds = existingAssignments.map(a => a.subjectId);

      // Copy each assignment that doesn't already exist
      for (const assignment of sourceAssignments) {
        if (!existingSubjectIds.includes(assignment.subjectId)) {
          // CRITICAL: Use target class's academic session, NOT source's
          if (!targetClass.academicSessionId) {
            console.error(`Target class ${targetClassId} has no academicSessionId - skipping assignment copy`);
            skippedCount++;
            continue;
          }
          
          await db.insert(classSubjectAssignments).values({
            classId: targetClassId,
            subjectId: assignment.subjectId,
            weeklyFrequency: assignment.weeklyFrequency,
            academicSessionId: targetClass.academicSessionId,
          });
          copiedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    return { copiedCount, skippedCount };
  }

  async checkClassExists(grade: string, section: string | null, schoolId: string, excludeId?: string): Promise<boolean> {
    const conditions = [
      eq(classes.grade, grade),
      eq(classes.schoolId, schoolId),
      // Handle both empty strings and null values for empty sections
      section && section.trim() !== "" ? eq(classes.section, section) : 
        or(eq(classes.section, ""), sql`${classes.section} IS NULL`)
    ];
    
    if (excludeId) {
      conditions.push(sql`${classes.id} != ${excludeId}`);
    }
    
    const result = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(...conditions));
    
    return result.length > 0;
  }

  async getClassesWithTimetables(schoolId: string): Promise<Class[]> {
    const classesWithEntries = await db
      .select({ classId: timetableEntries.classId })
      .from(timetableEntries)
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(
        and(
          eq(classes.schoolId, schoolId),
          eq(timetableEntries.isActive, true)
        )
      )
      .groupBy(timetableEntries.classId);
    
    const classIds = classesWithEntries.map(c => c.classId);
    
    if (classIds.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(classes)
      .where(inArray(classes.id, classIds));
  }

  // Class Teacher Assignment operations
  async getClassTeacherAssignments(classId: string, academicSessionId?: string): Promise<(ClassTeacherAssignment & { teacherName: string; teacherEmail: string })[]> {
    const conditions = [
      eq(classTeacherAssignments.classId, classId),
      eq(classTeacherAssignments.isActive, true)
    ];
    
    // Add session filtering - if not provided, get current session for the class
    if (academicSessionId) {
      conditions.push(eq(classTeacherAssignments.academicSessionId, academicSessionId));
    } else {
      // Get the class to determine its session
      const classData = await this.getClass(classId);
      if (classData?.academicSessionId) {
        conditions.push(eq(classTeacherAssignments.academicSessionId, classData.academicSessionId));
      }
    }

    const results = await db
      .select({
        id: classTeacherAssignments.id,
        classId: classTeacherAssignments.classId,
        teacherId: classTeacherAssignments.teacherId,
        role: classTeacherAssignments.role,
        isPrimary: classTeacherAssignments.isPrimary,
        privileges: classTeacherAssignments.privileges,
        assignedBy: classTeacherAssignments.assignedBy,
        schoolId: classTeacherAssignments.schoolId,
        academicSessionId: classTeacherAssignments.academicSessionId,
        isActive: classTeacherAssignments.isActive,
        createdAt: classTeacherAssignments.createdAt,
        updatedAt: classTeacherAssignments.updatedAt,
        teacherName: teachers.name,
        teacherEmail: teachers.email,
      })
      .from(classTeacherAssignments)
      .innerJoin(teachers, eq(classTeacherAssignments.teacherId, teachers.id))
      .where(and(...conditions))
      .orderBy(classTeacherAssignments.isPrimary, classTeacherAssignments.createdAt);
    
    return results;
  }

  async getClassTeacherAssignment(classId: string, teacherId: string): Promise<ClassTeacherAssignment | undefined> {
    const [result] = await db
      .select()
      .from(classTeacherAssignments)
      .where(
        and(
          eq(classTeacherAssignments.classId, classId),
          eq(classTeacherAssignments.teacherId, teacherId),
          eq(classTeacherAssignments.isActive, true)
        )
      );
    return result;
  }

  async getPrimaryClassTeacher(classId: string): Promise<ClassTeacherAssignment | undefined> {
    const [result] = await db
      .select()
      .from(classTeacherAssignments)
      .where(
        and(
          eq(classTeacherAssignments.classId, classId),
          eq(classTeacherAssignments.isPrimary, true),
          eq(classTeacherAssignments.isActive, true)
        )
      );
    return result;
  }

  async createClassTeacherAssignment(assignment: InsertClassTeacherAssignment): Promise<ClassTeacherAssignment> {
    const [created] = await db.insert(classTeacherAssignments).values({
      ...assignment,
      isPrimary: assignment.role === 'primary',
      privileges: assignment.privileges || {
        attendance: true,
        classFeedPosting: true,
        parentCommunication: true,
        leaveApproval: true
      }
    }).returning();
    return created;
  }

  async getClassTeacherAssignmentById(assignmentId: string): Promise<ClassTeacherAssignment | undefined> {
    const [result] = await db
      .select()
      .from(classTeacherAssignments)
      .where(eq(classTeacherAssignments.id, assignmentId));
    return result;
  }

  async updateClassTeacherAssignment(assignmentId: string, data: Partial<InsertClassTeacherAssignment>): Promise<ClassTeacherAssignment> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Automatically set isPrimary based on role
    if (data.role === 'primary') {
      updateData.isPrimary = true;
    } else if (data.role === 'co_class') {
      updateData.isPrimary = false;
    }
    
    const [updated] = await db
      .update(classTeacherAssignments)
      .set(updateData)
      .where(eq(classTeacherAssignments.id, assignmentId))
      .returning();
    return updated;
  }

  async deleteClassTeacherAssignment(assignmentId: string): Promise<void> {
    await db.delete(classTeacherAssignments).where(eq(classTeacherAssignments.id, assignmentId));
  }

  // Timetable operations
  async getTimetableEntries(schoolId?: string): Promise<TimetableEntry[]> {
    if (schoolId) {
      return await db
        .select({
          id: timetableEntries.id,
          classId: timetableEntries.classId,
          teacherId: timetableEntries.teacherId,
          subjectId: timetableEntries.subjectId,
          day: timetableEntries.day,
          period: timetableEntries.period,
          startTime: timetableEntries.startTime,
          endTime: timetableEntries.endTime,
          room: timetableEntries.room,
          isActive: timetableEntries.isActive,
          createdAt: timetableEntries.createdAt,
          updatedAt: timetableEntries.updatedAt,
        })
        .from(timetableEntries)
        .innerJoin(classes, eq(timetableEntries.classId, classes.id))
        .where(and(
          eq(timetableEntries.isActive, true),
          eq(classes.schoolId, schoolId)
        ));
    }
    return await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.isActive, true));
  }

  async getTimetableForClass(classId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.classId, classId),
          eq(timetableEntries.isActive, true)
        )
      );
  }

  async getTimetableEntriesBatch(classIds: string[]): Promise<Map<string, TimetableEntry[]>> {
    if (classIds.length === 0) {
      return new Map();
    }

    const entries = await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          inArray(timetableEntries.classId, classIds),
          eq(timetableEntries.isActive, true)
        )
      );

    const entriesByClass = new Map<string, TimetableEntry[]>();
    classIds.forEach(classId => entriesByClass.set(classId, []));
    
    entries.forEach(entry => {
      const classEntries = entriesByClass.get(entry.classId) || [];
      classEntries.push(entry);
      entriesByClass.set(entry.classId, classEntries);
    });

    return entriesByClass;
  }

  async getTimetableForTeacher(teacherId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.isActive, true)
        )
      );
  }

  async getTimetableEntriesExcludingClasses(schoolId: string, excludedClassIds: string[]): Promise<TimetableEntry[]> {
    if (excludedClassIds.length === 0) {
      return await this.getTimetableEntriesBySchool(schoolId);
    }
    
    return await db
      .select({
        id: timetableEntries.id,
        classId: timetableEntries.classId,
        teacherId: timetableEntries.teacherId,
        subjectId: timetableEntries.subjectId,
        day: timetableEntries.day,
        period: timetableEntries.period,
        startTime: timetableEntries.startTime,
        endTime: timetableEntries.endTime,
        room: timetableEntries.room,
        academicSessionId: timetableEntries.academicSessionId,
        isActive: timetableEntries.isActive,
        createdAt: timetableEntries.createdAt,
        updatedAt: timetableEntries.updatedAt,
      })
      .from(timetableEntries)
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(
        eq(timetableEntries.isActive, true),
        eq(classes.schoolId, schoolId),
        notInArray(timetableEntries.classId, excludedClassIds)
      ));
  }

  async getTimetableEntriesBySchool(schoolId: string): Promise<TimetableEntry[]> {
    return await db
      .select({
        id: timetableEntries.id,
        classId: timetableEntries.classId,
        teacherId: timetableEntries.teacherId,
        subjectId: timetableEntries.subjectId,
        day: timetableEntries.day,
        period: timetableEntries.period,
        startTime: timetableEntries.startTime,
        endTime: timetableEntries.endTime,
        room: timetableEntries.room,
        academicSessionId: timetableEntries.academicSessionId,
        isActive: timetableEntries.isActive,
        createdAt: timetableEntries.createdAt,
        updatedAt: timetableEntries.updatedAt,
      })
      .from(timetableEntries)
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(
        eq(timetableEntries.isActive, true),
        eq(classes.schoolId, schoolId)
      ));
  }

  async checkTeacherCapacityForClasses(schoolId: string, targetClassIds: string[]): Promise<{
    teacherId: string;
    teacherName: string;
    requiredPeriods: number;
    currentPeriods: number;
    maxDailyPeriods: number;
    maxWeeklyPeriods: number;
    availableWeeklyPeriods: number;
    status: 'sufficient' | 'insufficient' | 'warning';
    subjects: { subjectId: string; subjectName: string; periodsNeeded: number }[];
  }[]> {
    const teachers = await this.getTeachers(schoolId);
    const existingEntries = await this.getTimetableEntriesExcludingClasses(schoolId, targetClassIds);
    
    const teacherCapacityMap = new Map<string, {
      teacherId: string;
      teacherName: string;
      currentPeriods: number;
      maxDailyPeriods: number;
      maxWeeklyPeriods: number;
      requiredPeriods: number;
      subjects: Map<string, { subjectName: string; periodsNeeded: number }>;
    }>();
    
    for (const teacher of teachers) {
      const currentPeriods = existingEntries.filter(e => e.teacherId === teacher.id).length;
      teacherCapacityMap.set(teacher.id, {
        teacherId: teacher.id,
        teacherName: teacher.name,
        currentPeriods,
        maxDailyPeriods: teacher.maxDailyPeriods || 8,
        maxWeeklyPeriods: (teacher.maxDailyPeriods || 8) * 6,
        requiredPeriods: 0,
        subjects: new Map()
      });
    }
    
    for (const classId of targetClassIds) {
      const assignments = await this.getClassSubjectAssignments(classId);
      
      for (const assignment of assignments) {
        if (assignment.assignedTeacherId) {
          const capacity = teacherCapacityMap.get(assignment.assignedTeacherId);
          if (capacity) {
            capacity.requiredPeriods += assignment.weeklyFrequency;
            
            const subjectKey = `${assignment.subjectId}`;
            const existingSubject = capacity.subjects.get(subjectKey);
            if (existingSubject) {
              existingSubject.periodsNeeded += assignment.weeklyFrequency;
            } else {
              capacity.subjects.set(subjectKey, {
                subjectName: assignment.subjectName,
                periodsNeeded: assignment.weeklyFrequency
              });
            }
          }
        }
      }
    }
    
    const result: {
      teacherId: string;
      teacherName: string;
      requiredPeriods: number;
      currentPeriods: number;
      maxDailyPeriods: number;
      maxWeeklyPeriods: number;
      availableWeeklyPeriods: number;
      status: 'sufficient' | 'insufficient' | 'warning';
      subjects: { subjectId: string; subjectName: string; periodsNeeded: number }[];
    }[] = [];
    
    const teacherEntries = Array.from(teacherCapacityMap.entries());
    for (const [teacherId, capacity] of teacherEntries) {
      if (capacity.requiredPeriods > 0) {
        const availableWeeklyPeriods = capacity.maxWeeklyPeriods - capacity.currentPeriods;
        const totalNeededPeriods = capacity.currentPeriods + capacity.requiredPeriods;
        
        let status: 'sufficient' | 'insufficient' | 'warning' = 'sufficient';
        if (totalNeededPeriods > capacity.maxWeeklyPeriods) {
          status = 'insufficient';
        } else if (availableWeeklyPeriods < capacity.requiredPeriods * 1.2) {
          status = 'warning';
        }
        
        const subjectEntries = Array.from(capacity.subjects.entries());
        result.push({
          teacherId: capacity.teacherId,
          teacherName: capacity.teacherName,
          requiredPeriods: capacity.requiredPeriods,
          currentPeriods: capacity.currentPeriods,
          maxDailyPeriods: capacity.maxDailyPeriods,
          maxWeeklyPeriods: capacity.maxWeeklyPeriods,
          availableWeeklyPeriods,
          status,
          subjects: subjectEntries.map(([subjectId, data]) => ({
            subjectId,
            subjectName: data.subjectName,
            periodsNeeded: data.periodsNeeded
          }))
        });
      }
    }
    
    return result.sort((a, b) => {
      if (a.status === 'insufficient' && b.status !== 'insufficient') return -1;
      if (a.status !== 'insufficient' && b.status === 'insufficient') return 1;
      if (a.status === 'warning' && b.status === 'sufficient') return -1;
      if (a.status === 'sufficient' && b.status === 'warning') return 1;
      return 0;
    });
  }

  async createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry> {
    const [created] = await db.insert(timetableEntries).values(entry).returning();
    return created;
  }

  async updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry> {
    const [updated] = await db
      .update(timetableEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(timetableEntries.id, id))
      .returning();
    return updated;
  }

  async deleteTimetableEntry(id: string): Promise<void> {
    await db.delete(timetableEntries).where(eq(timetableEntries.id, id));
  }

  async deleteTimetableEntriesForClass(classId: string): Promise<void> {
    await db.delete(timetableEntries).where(eq(timetableEntries.classId, classId));
  }

  async deleteTimetableEntriesForTeacherAndDay(teacherId: string, day: string): Promise<void> {
    await db.delete(timetableEntries).where(
      and(
        eq(timetableEntries.teacherId, teacherId),
        eq(timetableEntries.day, day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday")
      )
    );
  }

  async clearTimetable(): Promise<void> {
    await db.delete(timetableEntries);
  }

  async bulkCreateTimetableEntries(entries: InsertTimetableEntry[]): Promise<TimetableEntry[]> {
    if (entries.length === 0) return [];
    
    // Before creating new entries, deactivate ALL old entries for these classes
    const classIds = Array.from(new Set(entries.map(e => e.classId)));
    for (let i = 0; i < classIds.length; i++) {
      const classId = classIds[i];
      // Deactivate ALL existing entries for this class to prevent duplicates
      await db
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, classId));
    }
    
    return await db.insert(timetableEntries).values(entries).returning();
  }

  // Timetable changes operations
  async getTimetableChanges(schoolId: string, date?: string): Promise<any[]> {
    const whereConditions = [
      eq(classes.schoolId, schoolId),
      eq(timetableChanges.isActive, true)
    ];

    if (date) {
      whereConditions.push(eq(timetableChanges.changeDate, date));
    }

    return await db
      .select({
        id: timetableChanges.id,
        timetableEntryId: timetableChanges.timetableEntryId,
        changeType: timetableChanges.changeType,
        changeDate: timetableChanges.changeDate,
        originalTeacherId: timetableChanges.originalTeacherId,
        newTeacherId: timetableChanges.newTeacherId,
        originalRoom: timetableChanges.originalRoom,
        newRoom: timetableChanges.newRoom,
        reason: timetableChanges.reason,
        changeSource: timetableChanges.changeSource,
        approvedBy: timetableChanges.approvedBy,
        approvedAt: timetableChanges.approvedAt,
        isActive: timetableChanges.isActive,
        createdAt: timetableChanges.createdAt,
        updatedAt: timetableChanges.updatedAt,
        // Include class information as flat fields
        affectedClassId: classes.id,
        affectedClassGrade: classes.grade,
        affectedClassSection: classes.section,
        affectedClassStudentCount: classes.studentCount,
        affectedClassRoom: classes.room,
        // Include timetable entry information as flat fields
        timetableEntryDay: timetableEntries.day,
        timetableEntryPeriod: timetableEntries.period,
        timetableEntryStartTime: timetableEntries.startTime,
        timetableEntryEndTime: timetableEntries.endTime
      })
      .from(timetableChanges)
      .innerJoin(timetableEntries, eq(timetableChanges.timetableEntryId, timetableEntries.id))
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(...whereConditions));
  }

  async getTimetableChangesByEntry(timetableEntryId: string): Promise<TimetableChange[]> {
    return await db
      .select()
      .from(timetableChanges)
      .where(and(
        eq(timetableChanges.timetableEntryId, timetableEntryId),
        eq(timetableChanges.isActive, true)
      ))
      .orderBy(timetableChanges.createdAt);
  }

  async createTimetableChange(change: InsertTimetableChange): Promise<TimetableChange> {
    const [created] = await db.insert(timetableChanges).values(change).returning();
    return created;
  }

  async updateTimetableChange(id: string, change: Partial<InsertTimetableChange>): Promise<TimetableChange> {
    const [updated] = await db
      .update(timetableChanges)
      .set({ ...change, updatedAt: new Date() })
      .where(eq(timetableChanges.id, id))
      .returning();
    return updated;
  }

  async deleteTimetableChange(id: string): Promise<void> {
    await db.delete(timetableChanges).where(eq(timetableChanges.id, id));
  }

  async getActiveTimetableChanges(schoolId: string, date: string): Promise<TimetableChange[]> {
    return await db
      .select({
        id: timetableChanges.id,
        timetableEntryId: timetableChanges.timetableEntryId,
        changeType: timetableChanges.changeType,
        changeDate: timetableChanges.changeDate,
        originalTeacherId: timetableChanges.originalTeacherId,
        newTeacherId: timetableChanges.newTeacherId,
        originalRoom: timetableChanges.originalRoom,
        newRoom: timetableChanges.newRoom,
        reason: timetableChanges.reason,
        changeSource: timetableChanges.changeSource,
        approvedBy: timetableChanges.approvedBy,
        approvedAt: timetableChanges.approvedAt,
        isActive: timetableChanges.isActive,
        viewedBy: timetableChanges.viewedBy,
        createdAt: timetableChanges.createdAt,
        updatedAt: timetableChanges.updatedAt,
        // Include class information as flat fields
        affectedClassId: classes.id,
        affectedClassGrade: classes.grade,
        affectedClassSection: classes.section,
        affectedClassStudentCount: classes.studentCount,
        affectedClassRoom: classes.room,
        // Include timetable entry information as flat fields
        timetableEntryDay: timetableEntries.day,
        timetableEntryPeriod: timetableEntries.period,
        timetableEntryStartTime: timetableEntries.startTime,
        timetableEntryEndTime: timetableEntries.endTime
      })
      .from(timetableChanges)
      .innerJoin(timetableEntries, eq(timetableChanges.timetableEntryId, timetableEntries.id))
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(timetableChanges.changeDate, date),
        eq(timetableChanges.isActive, true)
      ))
      .orderBy(timetableChanges.createdAt);
  }

  // Analytics
  async getStats(schoolId: string): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
  }> {
    const [teacherCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(teachers)
      .where(and(eq(teachers.isActive, true), eq(teachers.schoolId, schoolId)));

    const [classCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    const [subjectCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .where(eq(subjects.schoolId, schoolId));

    return {
      totalTeachers: Number(teacherCount?.count) || 0,
      totalClasses: Number(classCount?.count) || 0,
      totalSubjects: Number(subjectCount?.count) || 0,
    };
  }

  async getAdminDashboardStats(): Promise<{
    totalSchools: number;
    activeSchools: number;
    inactiveSchools: number;
    schoolAdminLogins: Array<{
      schoolName: string;
      adminName: string;
      lastLogin: Date | null;
    }>;
    schoolTeacherCounts: Array<{
      schoolName: string;
      activeTeachers: number;
    }>;
  }> {
    // Get school counts
    const [totalSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools);

    const [activeSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools)
      .where(eq(schools.isActive, true));

    const [inactiveSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools)
      .where(eq(schools.isActive, false));

    // Get school admin login info
    const schoolAdminLogins = await db
      .select({
        schoolName: schools.name,
        adminName: sql<string>`CONCAT(${users.firstName}, ' ', COALESCE(${users.lastName}, ''))`,
        lastLogin: users.updatedAt, // Using updatedAt as proxy for last activity
      })
      .from(schools)
      .leftJoin(users, and(
        eq(users.schoolId, schools.id),
        eq(users.role, "admin")
      ))
      .orderBy(schools.name);

    // Get teacher counts per school
    const schoolTeacherCounts = await db
      .select({
        schoolName: schools.name,
        activeTeachers: sql<number>`COUNT(${teachers.id})`,
      })
      .from(schools)
      .leftJoin(teachers, and(
        eq(teachers.schoolId, schools.id),
        eq(teachers.isActive, true)
      ))
      .groupBy(schools.id, schools.name)
      .orderBy(schools.name);

    return {
      totalSchools: Number(totalSchoolsResult?.count) || 0,
      activeSchools: Number(activeSchoolsResult?.count) || 0,
      inactiveSchools: Number(inactiveSchoolsResult?.count) || 0,
      schoolAdminLogins: schoolAdminLogins.map(item => ({
        schoolName: item.schoolName,
        adminName: item.adminName || 'No Admin',
        lastLogin: item.lastLogin,
      })),
      schoolTeacherCounts: schoolTeacherCounts.map(item => ({
        schoolName: item.schoolName,
        activeTeachers: Number(item.activeTeachers) || 0,
      })),
    };
  }

  // Timetable validity period operations
  async getTimetableValidityPeriods(classId?: string): Promise<TimetableValidityPeriod[]> {
    if (classId) {
      return await db.select().from(timetableValidityPeriods).where(eq(timetableValidityPeriods.classId, classId));
    }
    return await db.select().from(timetableValidityPeriods);
  }

  async getTimetableValidityPeriod(id: string): Promise<TimetableValidityPeriod | undefined> {
    const [period] = await db.select().from(timetableValidityPeriods).where(eq(timetableValidityPeriods.id, id));
    return period;
  }

  async createTimetableValidityPeriod(period: InsertTimetableValidityPeriod): Promise<TimetableValidityPeriod> {
    // First, deactivate other active periods for this class
    await db
      .update(timetableValidityPeriods)
      .set({ isActive: false })
      .where(and(
        eq(timetableValidityPeriods.classId, period.classId),
        eq(timetableValidityPeriods.isActive, true)
      ));

    const [newPeriod] = await db.insert(timetableValidityPeriods).values(period).returning();
    return newPeriod;
  }

  async updateTimetableValidityPeriod(id: string, period: Partial<InsertTimetableValidityPeriod>): Promise<TimetableValidityPeriod> {
    const [updatedPeriod] = await db
      .update(timetableValidityPeriods)
      .set(period)
      .where(eq(timetableValidityPeriods.id, id))
      .returning();
    return updatedPeriod;
  }

  async deleteTimetableValidityPeriod(id: string): Promise<void> {
    await db.delete(timetableValidityPeriods).where(eq(timetableValidityPeriods.id, id));
  }

  // Class Subject Assignment operations
  async getClassSubjectAssignments(classId?: string, schoolId?: string, academicSessionId?: string): Promise<any[]> {
    const query = db
      .select({
        id: classSubjectAssignments.id,
        classId: classSubjectAssignments.classId,
        subjectId: classSubjectAssignments.subjectId,
        weeklyFrequency: classSubjectAssignments.weeklyFrequency,
        assignedTeacherId: classSubjectAssignments.assignedTeacherId,
        academicSessionId: classSubjectAssignments.academicSessionId,
        classGrade: classes.grade,
        classSection: classes.section,
        subject: {
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          color: subjects.color,
          periodsPerWeek: subjects.periodsPerWeek,
          schoolId: subjects.schoolId,
        },
        assignedTeacher: {
          id: teachers.id,
          name: teachers.name,
          email: teachers.email,
          contactNumber: teachers.contactNumber,
          schoolIdNumber: teachers.schoolIdNumber,
          schoolId: teachers.schoolId,
          isActive: teachers.isActive,
        }
      })
      .from(classSubjectAssignments)
      .innerJoin(classes, eq(classSubjectAssignments.classId, classes.id))
      .innerJoin(subjects, eq(classSubjectAssignments.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjectAssignments.assignedTeacherId, teachers.id));

    let conditions = [];
    
    if (classId) {
      conditions.push(eq(classSubjectAssignments.classId, classId));
    }
    
    // Session-aware filtering
    if (academicSessionId) {
      conditions.push(eq(classSubjectAssignments.academicSessionId, academicSessionId));
    } else if (schoolId) {
      // Get current session for the school if no session specified
      const currentSession = await this.getCurrentAcademicSession(schoolId);
      if (currentSession) {
        // Older bulk imports saved assignments without a session - treat those as current
        conditions.push(or(
          eq(classSubjectAssignments.academicSessionId, currentSession.id),
          isNull(classSubjectAssignments.academicSessionId)
        )!);
      }
    }

    // Add school filtering (classes already joined above)
    if (schoolId) {
      conditions.push(eq(classes.schoolId, schoolId));
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getClassSubjectAssignment(id: string): Promise<ClassSubjectAssignment | undefined> {
    const [assignment] = await db.select().from(classSubjectAssignments).where(eq(classSubjectAssignments.id, id));
    return assignment;
  }

  async createClassSubjectAssignment(assignment: InsertClassSubjectAssignment): Promise<ClassSubjectAssignment> {
    // Timetables only read the current session's assignments, so never save one without a session
    if (!assignment.academicSessionId) {
      const [classRow] = await db.select({ schoolId: classes.schoolId }).from(classes).where(eq(classes.id, assignment.classId));
      const currentSession = classRow ? await this.getCurrentAcademicSession(classRow.schoolId) : undefined;
      if (currentSession) {
        assignment = { ...assignment, academicSessionId: currentSession.id };
      }
    }
    const [newAssignment] = await db.insert(classSubjectAssignments).values(assignment).returning();
    return newAssignment;
  }

  async updateClassSubjectAssignment(id: string, assignment: Partial<InsertClassSubjectAssignment>): Promise<ClassSubjectAssignment> {
    const [updatedAssignment] = await db
      .update(classSubjectAssignments)
      .set(assignment)
      .where(eq(classSubjectAssignments.id, id))
      .returning();
    return updatedAssignment;
  }

  async deleteClassSubjectAssignment(id: string): Promise<void> {
    await db.delete(classSubjectAssignments).where(eq(classSubjectAssignments.id, id));
  }

  async getClassSubjectAssignmentByClassAndSubject(classId: string, subjectId: string): Promise<ClassSubjectAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(classSubjectAssignments)
      .where(and(
        eq(classSubjectAssignments.classId, classId),
        eq(classSubjectAssignments.subjectId, subjectId)
      ));
    return assignment;
  }

  // Timetable Structure operations
  async getTimetableStructures(schoolId?: string): Promise<TimetableStructure[]> {
    if (schoolId) {
      return await db.select().from(timetableStructures).where(eq(timetableStructures.schoolId, schoolId));
    }
    return await db.select().from(timetableStructures);
  }

  async getTimetableStructure(id: string): Promise<TimetableStructure | undefined> {
    const [structure] = await db.select().from(timetableStructures).where(eq(timetableStructures.id, id));
    return structure;
  }

  async getTimetableStructureBySchool(schoolId: string): Promise<TimetableStructure | undefined> {
    const [structure] = await db
      .select()
      .from(timetableStructures)
      .where(and(
        eq(timetableStructures.schoolId, schoolId),
        eq(timetableStructures.isActive, true)
      ));
    return structure;
  }

  async createTimetableStructure(structure: InsertTimetableStructure): Promise<TimetableStructure> {
    // First, deactivate other active structures for this school
    await db
      .update(timetableStructures)
      .set({ isActive: false })
      .where(and(
        eq(timetableStructures.schoolId, structure.schoolId),
        eq(timetableStructures.isActive, true)
      ));

    const [newStructure] = await db.insert(timetableStructures).values(structure).returning();
    return newStructure;
  }

  async updateTimetableStructure(id: string, structure: Partial<InsertTimetableStructure>): Promise<TimetableStructure> {
    const [updatedStructure] = await db
      .update(timetableStructures)
      .set(structure)
      .where(eq(timetableStructures.id, id))
      .returning();
    return updatedStructure;
  }

  async deleteTimetableStructure(id: string): Promise<void> {
    await db.delete(timetableStructures).where(eq(timetableStructures.id, id));
  }

  // Teacher attendance operations
  async getTeacherAttendance(schoolId: string, date?: string): Promise<TeacherAttendance[]> {
    const conditions = [eq(teacherAttendance.schoolId, schoolId)];
    
    if (date) {
      conditions.push(eq(teacherAttendance.attendanceDate, date));
    }
    
    return await db
      .select()
      .from(teacherAttendance)
      .where(and(...conditions))
      .orderBy(teacherAttendance.attendanceDate);
  }

  async getTeacherAttendanceByDateRange(schoolId: string, startDate: string, endDate: string): Promise<TeacherAttendance[]> {
    return await db
      .select()
      .from(teacherAttendance)
      .where(and(
        eq(teacherAttendance.schoolId, schoolId),
        or(
          // Match records where attendance_date falls within the range
          between(teacherAttendance.attendanceDate, startDate, endDate),
          // OR match records where leave period overlaps with the requested range
          and(
            sql`${teacherAttendance.leaveStartDate} IS NOT NULL`,
            sql`${teacherAttendance.leaveEndDate} IS NOT NULL`,
            lte(teacherAttendance.leaveStartDate, endDate),
            gte(teacherAttendance.leaveEndDate, startDate)
          )
        )
      ))
      .orderBy(teacherAttendance.attendanceDate);
  }

  async getTeacherAttendanceByTeacher(teacherId: string, startDate?: string, endDate?: string): Promise<TeacherAttendance[]> {
    const conditions = [eq(teacherAttendance.teacherId, teacherId)];
    
    if (startDate && endDate) {
      conditions.push(between(teacherAttendance.attendanceDate, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(teacherAttendance.attendanceDate, startDate));
    } else if (endDate) {
      conditions.push(lte(teacherAttendance.attendanceDate, endDate));
    }
    
    return await db
      .select()
      .from(teacherAttendance)
      .where(and(...conditions))
      .orderBy(teacherAttendance.attendanceDate);
  }

  async getTeacherAbsences(schoolId: string): Promise<any[]> {
    const absences = await db
      .select({
        id: teacherAttendance.id,
        teacherId: teacherAttendance.teacherId,
        teacher: {
          name: teachers.name,
        },
        startDate: teacherAttendance.leaveStartDate,
        endDate: teacherAttendance.leaveEndDate,
        reason: teacherAttendance.reason,
        status: teacherAttendance.status,
        attendanceDate: teacherAttendance.attendanceDate,
      })
      .from(teacherAttendance)
      .innerJoin(teachers, eq(teacherAttendance.teacherId, teachers.id))
      .where(
        and(
          eq(teacherAttendance.schoolId, schoolId),
          or(
            eq(teacherAttendance.status, 'absent'),
            eq(teacherAttendance.status, 'on_leave'),
            eq(teacherAttendance.status, 'medical_leave'),
            eq(teacherAttendance.status, 'personal_leave'),
            eq(teacherAttendance.status, 'late')
          )
        )
      )
      .orderBy(desc(teacherAttendance.attendanceDate));
    
    return absences;
  }

  async markTeacherAttendance(attendance: InsertTeacherAttendance): Promise<TeacherAttendance> {
    // Check if attendance already exists for this teacher and date
    const existing = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.teacherId, attendance.teacherId),
          eq(teacherAttendance.attendanceDate, attendance.attendanceDate)
        )
      );

    let result: TeacherAttendance;
    let wasAbsentBefore = false;
    let isAbsentNow = attendance.status !== "present";

    if (existing.length > 0) {
      wasAbsentBefore = existing[0].status !== "present";
      
      // Update existing record
      const [updated] = await db
        .update(teacherAttendance)
        .set({
          status: attendance.status,
          reason: attendance.reason,
          isFullDay: attendance.isFullDay,
          markedBy: attendance.markedBy,
          markedAt: getCurrentDateTimeIST(),
        })
        .where(eq(teacherAttendance.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      // Create new record
      const [created] = await db
        .insert(teacherAttendance)
        .values(attendance)
        .returning();
      result = created;
    }

    // Handle automatic substitution creation/cancellation (async fire-and-forget)
    
    // CASE 1: If teacher is being marked as absent and wasn't absent before
    if (isAbsentNow && !wasAbsentBefore) {
      console.log(`[ABSENCE] Marking teacher ${attendance.teacherId} as absent on ${attendance.attendanceDate}. Processing substitutions asynchronously...`);
      
      setImmediate(async () => {
        try {
          const { SubstitutionService } = await import("./services/substitution");
          const substitutionService = new SubstitutionService();
          
          console.log(`[ABSENCE SUBSTITUTION] Creating substitutions for absent teacher ${attendance.teacherId} on ${attendance.attendanceDate}`);
          await substitutionService.createSubstitutionsForAbsence(
            attendance.teacherId,
            attendance.attendanceDate,
            attendance.schoolId,
            result.id,
            attendance.markedBy
          );
          console.log(`[ABSENCE SUBSTITUTION] Completed processing for teacher ${attendance.teacherId}`);
        } catch (substitutionError) {
          console.error("[ABSENCE SUBSTITUTION] Error creating substitutions for absence:", substitutionError);
        }
      });
    }
    
    // CASE 2: If teacher WAS absent before and is now marked PRESENT - auto-cancel substitutions
    if (!isAbsentNow && wasAbsentBefore) {
      console.log(`[PRESENCE] Teacher ${attendance.teacherId} marked present on ${attendance.attendanceDate}. Auto-cancelling substitutions...`);
      
      setImmediate(async () => {
        try {
          const { SubstitutionService } = await import("./services/substitution");
          const substitutionService = new SubstitutionService();
          
          console.log(`[AUTO-CANCEL] Cancelling substitutions for teacher ${attendance.teacherId} on ${attendance.attendanceDate}`);
          const cancelled = await substitutionService.autoCancelSubstitutionsForPresence(
            attendance.teacherId,
            attendance.attendanceDate
          );
          console.log(`[AUTO-CANCEL] Cancelled ${cancelled} substitution(s) for teacher ${attendance.teacherId}`);
        } catch (cancelError) {
          console.error("[AUTO-CANCEL] Error cancelling substitutions:", cancelError);
        }
      });
    }

    return result;
  }

  async updateTeacherAttendance(id: string, attendance: Partial<InsertTeacherAttendance>): Promise<TeacherAttendance> {
    const [updated] = await db
      .update(teacherAttendance)
      .set({
        ...attendance,
        updatedAt: getCurrentDateTimeIST(),
      })
      .where(eq(teacherAttendance.id, id))
      .returning();
      
    if (!updated) {
      throw new Error("Teacher attendance record not found");
    }
    
    return updated;
  }

  async deleteTeacherAttendance(id: string): Promise<void> {
    await db.delete(teacherAttendance).where(eq(teacherAttendance.id, id));
  }

  async isTeacherAbsent(teacherId: string, date: string): Promise<boolean> {
    const attendance = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.teacherId, teacherId),
          eq(teacherAttendance.attendanceDate, date)
        )
      );
    
    if (attendance.length === 0) {
      return false; // No record means present by default
    }
    
    return attendance[0].status !== "present";
  }

  // Leave application operations
  async createLeaveApplication(application: any): Promise<any> {
    const [created] = await db.insert(leaveApplications).values(application).returning();
    return created;
  }

  async getLeaveApplications(schoolId: string, filters?: { status?: string; teacherId?: string }): Promise<any[]> {
    const conditions = [eq(leaveApplications.schoolId, schoolId)];
    
    if (filters?.status) {
      conditions.push(eq(leaveApplications.status, filters.status));
    }
    
    if (filters?.teacherId) {
      conditions.push(eq(leaveApplications.teacherId, filters.teacherId));
    }
    
    return await db
      .select({
        id: leaveApplications.id,
        teacherId: leaveApplications.teacherId,
        teacherName: teachers.name,
        teacherSchoolId: teachers.schoolIdNumber,
        startDate: leaveApplications.startDate,
        endDate: leaveApplications.endDate,
        leaveType: leaveApplications.leaveType,
        reason: leaveApplications.reason,
        status: leaveApplications.status,
        reviewedBy: leaveApplications.reviewedBy,
        reviewedAt: leaveApplications.reviewedAt,
        reviewNotes: leaveApplications.reviewNotes,
        attachmentUrl: leaveApplications.attachmentUrl,
        appliedAt: leaveApplications.appliedAt,
        createdAt: leaveApplications.createdAt,
      })
      .from(leaveApplications)
      .innerJoin(teachers, eq(leaveApplications.teacherId, teachers.id))
      .where(and(...conditions))
      .orderBy(desc(leaveApplications.appliedAt));
  }

  async getLeaveApplicationById(id: string): Promise<any | undefined> {
    const [result] = await db
      .select({
        id: leaveApplications.id,
        teacherId: leaveApplications.teacherId,
        schoolId: leaveApplications.schoolId,
        teacherName: teachers.name,
        teacherSchoolId: teachers.schoolIdNumber,
        startDate: leaveApplications.startDate,
        endDate: leaveApplications.endDate,
        leaveType: leaveApplications.leaveType,
        reason: leaveApplications.reason,
        status: leaveApplications.status,
        reviewedBy: leaveApplications.reviewedBy,
        reviewedAt: leaveApplications.reviewedAt,
        reviewNotes: leaveApplications.reviewNotes,
        attachmentUrl: leaveApplications.attachmentUrl,
        appliedAt: leaveApplications.appliedAt,
      })
      .from(leaveApplications)
      .innerJoin(teachers, eq(leaveApplications.teacherId, teachers.id))
      .where(eq(leaveApplications.id, id));
    
    return result;
  }

  async updateLeaveApplication(id: string, updates: any): Promise<any> {
    const [updated] = await db
      .update(leaveApplications)
      .set(updates)
      .where(eq(leaveApplications.id, id))
      .returning();
    
    return updated;
  }

  async approveLeaveApplication(id: string, reviewedBy: string, reviewNotes?: string): Promise<any> {
    const [approved] = await db
      .update(leaveApplications)
      .set({
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(leaveApplications.id, id))
      .returning();
    
    return approved;
  }

  async rejectLeaveApplication(id: string, reviewedBy: string, reviewNotes?: string): Promise<any> {
    const [rejected] = await db
      .update(leaveApplications)
      .set({
        status: 'rejected',
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(leaveApplications.id, id))
      .returning();
    
    return rejected;
  }

  // Student attendance operations
  async getStudentAttendance(schoolId: string, date?: string): Promise<StudentAttendance[]> {
    const conditions = [eq(studentAttendance.schoolId, schoolId)];
    
    if (date) {
      conditions.push(eq(studentAttendance.attendanceDate, date));
    }
    
    return await db
      .select()
      .from(studentAttendance)
      .where(and(...conditions))
      .orderBy(studentAttendance.attendanceDate);
  }

  async getStudentAttendanceByStudent(studentId: string, startDate?: string, endDate?: string): Promise<StudentAttendance[]> {
    const conditions = [eq(studentAttendance.studentId, studentId)];
    
    if (startDate && endDate) {
      conditions.push(between(studentAttendance.attendanceDate, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(studentAttendance.attendanceDate, startDate));
    } else if (endDate) {
      conditions.push(lte(studentAttendance.attendanceDate, endDate));
    }
    
    return await db
      .select()
      .from(studentAttendance)
      .where(and(...conditions))
      .orderBy(studentAttendance.attendanceDate);
  }

  async getStudentAttendanceByClass(classId: string, date: string): Promise<StudentAttendance[]> {
    return await db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.classId, classId),
          eq(studentAttendance.attendanceDate, date)
        )
      )
      .orderBy(studentAttendance.studentId);
  }

  async markStudentAttendance(attendance: InsertStudentAttendance): Promise<StudentAttendance> {
    // Check if attendance already exists for this student and date
    const existing = await db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.studentId, attendance.studentId),
          eq(studentAttendance.attendanceDate, attendance.attendanceDate)
        )
      );

    let result: StudentAttendance;

    if (existing.length > 0) {
      // Update existing record
      const [updated] = await db
        .update(studentAttendance)
        .set({
          ...attendance,
          markedAt: getCurrentDateTimeIST(),
          updatedAt: getCurrentDateTimeIST(),
        })
        .where(eq(studentAttendance.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      // Create new record
      const [created] = await db
        .insert(studentAttendance)
        .values({
          ...attendance,
          markedAt: getCurrentDateTimeIST(),
        })
        .returning();
      result = created;
    }

    return result;
  }

  async updateStudentAttendance(id: string, attendance: Partial<InsertStudentAttendance>): Promise<StudentAttendance> {
    const [updated] = await db
      .update(studentAttendance)
      .set({
        ...attendance,
        updatedAt: getCurrentDateTimeIST(),
      })
      .where(eq(studentAttendance.id, id))
      .returning();
      
    if (!updated) {
      throw new Error("Student attendance record not found");
    }
    
    return updated;
  }

  async deleteStudentAttendance(id: string): Promise<void> {
    await db.delete(studentAttendance).where(eq(studentAttendance.id, id));
  }

  async isStudentAbsent(studentId: string, date: string): Promise<boolean> {
    const attendance = await db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.studentId, studentId),
          eq(studentAttendance.attendanceDate, date)
        )
      );
    
    if (attendance.length === 0) {
      return false; // No record means present by default
    }
    
    return attendance[0].status !== "present";
  }

  async getStudentAttendanceById(id: string): Promise<StudentAttendance | undefined> {
    const attendance = await db
      .select()
      .from(studentAttendance)
      .where(eq(studentAttendance.id, id));
    
    return attendance[0];
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    const result = await db
      .select({
        student: students,
      })
      .from(students)
      .innerJoin(users, eq(users.studentId, students.id))
      .where(eq(users.id, userId));
    
    return result[0]?.student;
  }

  // Audit log operations
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(auditLog).returning();
    return log;
  }

  async getAuditLogs(schoolId: string, limit: number = 50): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.schoolId, schoolId))
      .orderBy(auditLogs.createdAt)
      .limit(limit);
  }

  // Enhanced teacher operations for daily periods
  async updateTeacherDailyPeriods(schoolId: string, config: UpdateTeacherDailyPeriods): Promise<{ success: boolean; message: string }> {
    try {
      if (config.applyToAll) {
        // Update all teachers in the school
        await db
          .update(teachers)
          .set({ maxDailyPeriods: config.maxDailyPeriods })
          .where(eq(teachers.schoolId, schoolId));
        
        return { 
          success: true, 
          message: `Updated daily periods limit to ${config.maxDailyPeriods} for all teachers` 
        };
      } else if (config.teacherId) {
        // Update specific teacher
        await db
          .update(teachers)
          .set({ maxDailyPeriods: config.maxDailyPeriods })
          .where(and(eq(teachers.id, config.teacherId), eq(teachers.schoolId, schoolId)));
        
        return { 
          success: true, 
          message: `Updated daily periods limit to ${config.maxDailyPeriods} for selected teacher` 
        };
      } else {
        return { success: false, message: "Teacher ID is required when not applying to all teachers" };
      }
    } catch (error) {
      console.error("Error updating teacher daily periods:", error);
      return { success: false, message: "Failed to update teacher daily periods" };
    }
  }

  async getTeacherSchedule(teacherId: string, date?: string): Promise<TimetableEntry[]> {
    // Note: timetableEntries table doesn't have a date field, it only has day (monday, tuesday, etc.)
    // The date parameter is currently not used in filtering since we show weekly schedule
    let query = db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.isActive, true)
        )
      )
      .orderBy(asc(timetableEntries.day), asc(timetableEntries.period));

    return await query;
  }

  async getTeacherWorkloadAnalytics(schoolId: string): Promise<any> {
    // Get all teachers and their current workload
    const teachersList = await this.getTeachers(schoolId);
    const allEntries = await db
      .select()
      .from(timetableEntries)
      .innerJoin(teachers, eq(timetableEntries.teacherId, teachers.id))
      .where(eq(teachers.schoolId, schoolId));

    const workloadData = teachersList.map(teacher => {
      const teacherEntries = allEntries.filter(entry => entry.timetable_entries.teacherId === teacher.id);
      const weeklyPeriods = teacherEntries.length;
      const dailyPeriods: Record<string, number> = {};
      
      teacherEntries.forEach(entry => {
        const day = entry.timetable_entries.day;
        dailyPeriods[day] = (dailyPeriods[day] || 0) + 1;
      });

      const avgDailyPeriods = weeklyPeriods / 6; // Assuming 6 working days
      const maxDailyPeriods = Math.max(...Object.values(dailyPeriods), 0);

      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        weeklyPeriods,
        avgDailyPeriods: Math.round(avgDailyPeriods * 10) / 10,
        maxDailyPeriods,
        maxAllowedDaily: teacher.maxDailyPeriods,
        isOverloaded: maxDailyPeriods > teacher.maxDailyPeriods,
        dailyBreakdown: dailyPeriods
      };
    });

    return {
      teachers: workloadData,
      summary: {
        totalTeachers: teachersList.length,
        overloadedTeachers: workloadData.filter(t => t.isOverloaded).length,
        avgWeeklyPeriods: workloadData.reduce((sum, t) => sum + t.weeklyPeriods, 0) / teachersList.length || 0
      }
    };
  }

  async getTimetableEntriesByTeacher(teacherId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(and(
        eq(timetableEntries.teacherId, teacherId),
        eq(timetableEntries.isActive, true)
      ))
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  async getTeacherClasses(teacherId: string): Promise<{
    id: string;
    grade: string;
    section: string | null;
    room: string | null;
    studentCount: number;
    role: string;
    subjects: string[];
  }[]> {
    // Get classes where teacher is a class teacher
    const classTeacherResults = await db
      .select({
        classId: classTeacherAssignments.classId,
        role: classTeacherAssignments.role,
      })
      .from(classTeacherAssignments)
      .where(and(
        eq(classTeacherAssignments.teacherId, teacherId),
        eq(classTeacherAssignments.isActive, true)
      ));

    // Get classes where teacher teaches subjects
    const subjectTeacherResults = await db
      .select({
        classId: classSubjectAssignments.classId,
        subjectId: classSubjectAssignments.subjectId,
        subjectName: subjects.name,
      })
      .from(classSubjectAssignments)
      .innerJoin(subjects, eq(classSubjectAssignments.subjectId, subjects.id))
      .where(eq(classSubjectAssignments.assignedTeacherId, teacherId));

    // Get unique class IDs
    const classTeacherClassIds = classTeacherResults.map(r => r.classId);
    const subjectTeacherClassIds = subjectTeacherResults.map(r => r.classId);
    const allClassIds = Array.from(new Set([...classTeacherClassIds, ...subjectTeacherClassIds]));

    if (allClassIds.length === 0) {
      return [];
    }

    // Get class details with student counts
    const classDetails = await db
      .select({
        id: classes.id,
        grade: classes.grade,
        section: classes.section,
        room: classes.room,
        studentCount: sql<number>`cast(count(distinct ${students.id}) as integer)`,
      })
      .from(classes)
      .leftJoin(students, and(
        eq(students.classId, classes.id),
        eq(students.isActive, true)
      ))
      .where(inArray(classes.id, allClassIds))
      .groupBy(classes.id, classes.grade, classes.section, classes.room);

    // Build the result with roles and subjects
    return classDetails.map(classData => {
      const isClassTeacher = classTeacherClassIds.includes(classData.id);
      const isSubjectTeacher = subjectTeacherClassIds.includes(classData.id);

      let role = '';
      if (isClassTeacher && isSubjectTeacher) {
        role = 'Class Teacher & Subject Teacher';
      } else if (isClassTeacher) {
        role = 'Class Teacher';
      } else {
        role = 'Subject Teacher';
      }

      const subjects = subjectTeacherResults
        .filter(r => r.classId === classData.id)
        .map(r => r.subjectName);

      return {
        id: classData.id,
        grade: classData.grade,
        section: classData.section,
        room: classData.room,
        studentCount: classData.studentCount,
        role,
        subjects,
      };
    });
  }

  // Teacher Replacement operations
  async createTeacherReplacement(replacement: InsertTeacherReplacement): Promise<TeacherReplacement> {
    const [newReplacement] = await db
      .insert(teacherReplacements)
      .values(replacement)
      .returning();
    return newReplacement;
  }

  async getAllTeacherReplacements(): Promise<TeacherReplacement[]> {
    return await db
      .select({
        id: teacherReplacements.id,
        originalTeacherId: teacherReplacements.originalTeacherId,
        replacementTeacherId: teacherReplacements.replacementTeacherId,
        schoolId: teacherReplacements.schoolId,
        replacementDate: teacherReplacements.replacementDate,
        reason: teacherReplacements.reason,
        affectedTimetableEntries: teacherReplacements.affectedTimetableEntries,
        conflictDetails: teacherReplacements.conflictDetails,
        status: teacherReplacements.status,
        replacedBy: teacherReplacements.replacedBy,
        completedAt: teacherReplacements.completedAt,
        createdAt: teacherReplacements.createdAt,
        updatedAt: teacherReplacements.updatedAt,
        originalTeacher: {
          id: sql`orig_teacher.id`,
          name: sql`orig_teacher.name`,
          email: sql`orig_teacher.email`
        },
        replacementTeacher: {
          id: sql`repl_teacher.id`,
          name: sql`repl_teacher.name`,
          email: sql`repl_teacher.email`
        },
        school: {
          id: schools.id,
          name: schools.name
        },
        replacedByUser: {
          id: sql`replaced_by_user.id`,
          email: sql`replaced_by_user.email`
        }
      })
      .from(teacherReplacements)
      .leftJoin(sql`${teachers} as orig_teacher`, sql`orig_teacher.id = ${teacherReplacements.originalTeacherId}`)
      .leftJoin(sql`${teachers} as repl_teacher`, sql`repl_teacher.id = ${teacherReplacements.replacementTeacherId}`)
      .leftJoin(schools, eq(teacherReplacements.schoolId, schools.id))
      .leftJoin(sql`${users} as replaced_by_user`, sql`replaced_by_user.id = ${teacherReplacements.replacedBy}`)
      .orderBy(sql`${teacherReplacements.createdAt} DESC`);
  }

  async getTeacherReplacementsBySchool(schoolId: string): Promise<TeacherReplacement[]> {
    return await db
      .select({
        id: teacherReplacements.id,
        originalTeacherId: teacherReplacements.originalTeacherId,
        replacementTeacherId: teacherReplacements.replacementTeacherId,
        schoolId: teacherReplacements.schoolId,
        replacementDate: teacherReplacements.replacementDate,
        reason: teacherReplacements.reason,
        affectedTimetableEntries: teacherReplacements.affectedTimetableEntries,
        conflictDetails: teacherReplacements.conflictDetails,
        status: teacherReplacements.status,
        replacedBy: teacherReplacements.replacedBy,
        completedAt: teacherReplacements.completedAt,
        createdAt: teacherReplacements.createdAt,
        updatedAt: teacherReplacements.updatedAt,
        originalTeacher: {
          id: sql`orig_teacher.id`,
          name: sql`orig_teacher.name`,
          email: sql`orig_teacher.email`
        },
        replacementTeacher: {
          id: sql`repl_teacher.id`,
          name: sql`repl_teacher.name`,
          email: sql`repl_teacher.email`
        },
        replacedByUser: {
          id: sql`replaced_by_user.id`,
          email: sql`replaced_by_user.email`
        }
      })
      .from(teacherReplacements)
      .leftJoin(sql`${teachers} as orig_teacher`, sql`orig_teacher.id = ${teacherReplacements.originalTeacherId}`)
      .leftJoin(sql`${teachers} as repl_teacher`, sql`repl_teacher.id = ${teacherReplacements.replacementTeacherId}`)
      .leftJoin(sql`${users} as replaced_by_user`, sql`replaced_by_user.id = ${teacherReplacements.replacedBy}`)
      .where(eq(teacherReplacements.schoolId, schoolId))
      .orderBy(sql`${teacherReplacements.createdAt} DESC`);
  }


  // Manual assignment operations
  async getTeachersForClass(classId: string): Promise<Teacher[]> {
    const assignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, classId));

    const teacherIds = assignments
      .filter(a => a.assignedTeacherId)
      .map(a => a.assignedTeacherId as string);

    if (teacherIds.length === 0) return [];

    const classTeachersResult = await db
      .select()
      .from(teachers)
      .where(inArray(teachers.id, teacherIds));

    return classTeachersResult;
  }

  async createManualAssignmentAudit(audit: InsertManualAssignmentAudit): Promise<ManualAssignmentAudit> {
    const [created] = await db
      .insert(manualAssignmentAudits)
      .values(audit)
      .returning();
    return created;
  }

  async getTimetableEntry(id: string): Promise<TimetableEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.id, id));
    return entry;
  }



  async isTeacherAvailable(teacherId: string, day: string, period: number, date?: string, academicSessionId?: string): Promise<boolean> {
    // Check if teacher is absent on this date (if date provided)
    if (date) {
      const isAbsent = await this.isTeacherAbsent(teacherId, date);
      if (isAbsent) return false;
    }

    // If date is provided, check weekly timetables first (actual current schedules)
    if (date) {
      const targetDate = new Date(date + 'T00:00:00+05:30');
      const weekStart = getWeekStartDateIST(targetDate);
      const weekStartStr = toISTDateString(weekStart);

      // Get weekly timetables for this week - filter by academic session if provided
      const weeklyTimetableData = await db
        .select()
        .from(weeklyTimetables)
        .where(
          and(
            eq(weeklyTimetables.weekStart, weekStartStr),
            academicSessionId ? eq(weeklyTimetables.academicSessionId, academicSessionId) : undefined
          )
        );

      // Check for conflicts in weekly timetables
      for (const wt of weeklyTimetableData) {
        const timetableData = wt.timetableData as any[];
        const conflict = timetableData?.find((entry: any) => 
          entry.teacherId === teacherId &&
          entry.day?.toLowerCase() === day.toLowerCase() &&
          entry.period === period
        );
        if (conflict) return false;
      }
    }

    // Check master timetable conflicts - filter by academic session if provided
    const conflicts = await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.day, day as any),
          eq(timetableEntries.period, period),
          eq(timetableEntries.isActive, true),
          academicSessionId ? eq(timetableEntries.academicSessionId, academicSessionId) : undefined
        )
      );

    if (conflicts.length > 0) return false;

    // Check daily period limits
    const teacher = await this.getTeacher(teacherId);
    if (teacher) {
      // For date-based checks, use weekly timetables if available
      if (date) {
        const targetDate = new Date(date + 'T00:00:00+05:30');
        const weekStart = getWeekStartDateIST(targetDate);
        const weekStartStr = toISTDateString(weekStart);

        const weeklyTimetableData = await db
          .select()
          .from(weeklyTimetables)
          .where(
            and(
              eq(weeklyTimetables.weekStart, weekStartStr),
              academicSessionId ? eq(weeklyTimetables.academicSessionId, academicSessionId) : undefined
            )
          );

        let periodsCount = 0;
        for (const wt of weeklyTimetableData) {
          const timetableData = wt.timetableData as any[];
          const dayPeriods = timetableData?.filter((entry: any) => 
            entry.teacherId === teacherId &&
            entry.day?.toLowerCase() === day.toLowerCase()
          );
          periodsCount += dayPeriods?.length || 0;
        }

        if (periodsCount >= teacher.maxDailyPeriods) {
          return false;
        }
      } else {
        // For master timetable checks - filter by academic session if provided
        const dailySchedule = await db
          .select()
          .from(timetableEntries)
          .where(
            and(
              eq(timetableEntries.teacherId, teacherId),
              eq(timetableEntries.day, day as any),
              eq(timetableEntries.isActive, true),
              academicSessionId ? eq(timetableEntries.academicSessionId, academicSessionId) : undefined
            )
          );

        if (dailySchedule.length >= teacher.maxDailyPeriods) {
          return false;
        }
      }
    }

    return true;
  }

  // Global Timetable Management
  async replaceGlobalTimetableForClass(classId: string, effectiveTimetable: TimetableEntry[]): Promise<void> {
    await db.transaction(async (tx) => {
      // First, deactivate all existing entries for this class
      await tx
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, classId));
      
      // Then insert the new global timetable entries
      if (effectiveTimetable.length > 0) {
        const newEntries = effectiveTimetable.map(entry => ({
          classId: entry.classId,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          day: entry.day,
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isActive: true
        }));
        
        await tx.insert(timetableEntries).values(newEntries);
      }
    });
  }

  async clearWeeklyChangesForClass(classId: string, date: string): Promise<void> {
    // Calculate week start and end dates in IST
    const selectedDate = new Date(date + 'T00:00:00+05:30');
    const weekStart = getWeekStartDateIST(selectedDate);
    const weekEnd = getWeekEndDateIST(selectedDate);
    
    const weekStartStr = toISTDateString(weekStart);
    const weekEndStr = toISTDateString(weekEnd);
    
    // Find all timetable entry IDs for this class
    const classEntries = await db
      .select({ id: timetableEntries.id })
      .from(timetableEntries)
      .where(eq(timetableEntries.classId, classId));
    
    const entryIds = classEntries.map(entry => entry.id);
    
    if (entryIds.length === 0) return;
    
    // Deactivate all timetable changes for this class in the specified week
    await db
      .update(timetableChanges)
      .set({ isActive: false })
      .where(
        and(
          inArray(timetableChanges.timetableEntryId, entryIds),
          gte(timetableChanges.changeDate, weekStartStr),
          lte(timetableChanges.changeDate, weekEndStr)
        )
      );
  }

  // Weekly Timetable Functions
  async getAllWeeklyTimetablesForSchool(schoolId: string): Promise<WeeklyTimetable[]> {
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          eq(weeklyTimetables.schoolId, schoolId),
          eq(weeklyTimetables.isActive, true)
        )
      );
    
    return results;
  }

  // Get weekly timetables for a specific week
  async getWeeklyTimetablesByWeek(schoolId: string, weekStart: string): Promise<WeeklyTimetable[]> {
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          eq(weeklyTimetables.schoolId, schoolId),
          eq(weeklyTimetables.weekStart, weekStart),
          eq(weeklyTimetables.isActive, true)
        )
      );
    
    return results;
  }

  // Helper function to get the Monday of a given week (IST timezone)
  private getMondayOfWeek(date: Date): Date {
    // Get IST weekday using Intl.DateTimeFormat to avoid timezone issues
    const formatter = new Intl.DateTimeFormat('en-US', { 
      weekday: 'long',
      timeZone: 'Asia/Kolkata'
    });
    const dayName = formatter.format(date).toLowerCase();
    const dayMap: Record<string, number> = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const currentDay = dayMap[dayName];
    
    // Calculate days to subtract to get to Monday (IST)
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    // Get date string in IST
    const istDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [year, month, day] = istDateStr.split('-').map(Number);
    
    // Use Date.UTC for proper rollover, then convert to IST
    const tempDate = new Date(Date.UTC(year, month - 1, day - daysToMonday));
    const mondayYear = tempDate.getUTCFullYear();
    const mondayMonth = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
    const mondayDay = String(tempDate.getUTCDate()).padStart(2, '0');
    
    // Return Monday at midnight IST
    return new Date(`${mondayYear}-${mondayMonth}-${mondayDay}T00:00:00+05:30`);
  }

  // Get weekly timetables for current week and next week only
  async getCurrentAndNextWeekTimetablesForSchool(schoolId: string): Promise<WeeklyTimetable[]> {
    const currentDate = getCurrentDateTimeIST();
    
    // Calculate Monday of current week
    const currentWeekMonday = this.getMondayOfWeek(currentDate);
    
    // Calculate Monday of next week (use IST-aware date arithmetic)
    const currentMondayStr = currentWeekMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [year, month, day] = currentMondayStr.split('-').map(Number);
    const tempDate = new Date(Date.UTC(year, month - 1, day + 7));
    const nextYear = tempDate.getUTCFullYear();
    const nextMonth = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(tempDate.getUTCDate()).padStart(2, '0');
    const nextWeekMonday = new Date(`${nextYear}-${nextMonth}-${nextDay}T00:00:00+05:30`);
    
    // Convert to YYYY-MM-DD strings in IST
    const currentWeekMondayStr = currentWeekMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nextWeekMondayStr = nextWeekMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    console.log(`[WEEKLY SYNC] Current week Monday: ${currentWeekMondayStr}`);
    console.log(`[WEEKLY SYNC] Next week Monday: ${nextWeekMondayStr}`);
    
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          eq(weeklyTimetables.schoolId, schoolId),
          eq(weeklyTimetables.isActive, true),
          or(
            eq(weeklyTimetables.weekStart, currentWeekMondayStr),
            eq(weeklyTimetables.weekStart, nextWeekMondayStr)
          )
        )
      );
    
    console.log(`[WEEKLY SYNC] Found ${results.length} weekly timetables for current and next week`);
    return results;
  }

  // Get weekly timetables for current week and ALL future weeks (for AI Smart generation sync)
  async getCurrentAndFutureWeekTimetablesForSchool(schoolId: string): Promise<WeeklyTimetable[]> {
    const currentDate = getCurrentDateTimeIST();
    
    // Calculate Monday of current week
    const currentWeekMonday = this.getMondayOfWeek(currentDate);
    const currentWeekMondayStr = currentWeekMonday.toISOString().split('T')[0];
    
    console.log(`[WEEKLY SYNC] Current week Monday: ${currentWeekMondayStr}`);
    console.log(`[WEEKLY SYNC] Fetching current and all future weekly timetables`);
    
    // Get all weekly timetables from current week onwards (>= current week Monday)
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          eq(weeklyTimetables.schoolId, schoolId),
          eq(weeklyTimetables.isActive, true),
          gte(weeklyTimetables.weekStart, currentWeekMondayStr)
        )
      );
    
    console.log(`[WEEKLY SYNC] Found ${results.length} weekly timetables for current and future weeks`);
    return results;
  }

  async syncWeeklyTimetableWithMaster(weeklyTimetableId: string): Promise<{ success: boolean; message: string; updatedEntries: number }> {
    try {
      // Get the weekly timetable
      const [weeklyTimetable] = await db
        .select()
        .from(weeklyTimetables)
        .where(eq(weeklyTimetables.id, weeklyTimetableId))
        .limit(1);

      if (!weeklyTimetable) {
        return { success: false, message: 'Weekly timetable not found', updatedEntries: 0 };
      }

      // Get the master/global timetable for this class
      const masterTimetable = await this.getTimetableForClass(weeklyTimetable.classId);
      
      // Convert master timetable to the format used in weekly timetables
      // Simply replace ALL timetableData with new master data - no preservation of manual modifications
      const masterTimetableData = masterTimetable.map(entry => ({
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        isModified: false, // All entries marked as unmodified
        modificationReason: undefined
      }));

      // Update the weekly timetable with the new data (completely replace existing data)
      await this.updateWeeklyTimetable(weeklyTimetableId, {
        timetableData: masterTimetableData,
        modificationCount: weeklyTimetable.modificationCount + 1,
      });

      return { 
        success: true, 
        message: `Successfully replaced weekly timetable data with ${masterTimetableData.length} master entries`, 
        updatedEntries: masterTimetableData.length 
      };

    } catch (error) {
      console.error(`Error syncing weekly timetable ${weeklyTimetableId}:`, error);
      return { 
        success: false, 
        message: `Failed to sync weekly timetable: ${error.message}`, 
        updatedEntries: 0 
      };
    }
  }

  async getWeeklyTimetable(classId: string, weekStart: Date): Promise<WeeklyTimetable | null> {
    // Convert to YYYY-MM-DD string in IST (avoid UTC conversion issues)
    const weekStartStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    // Get class data to determine academic session for proper filtering
    const classData = await this.getClass(classId);
    
    // REQUIRE academic session ID to prevent cross-session mixing
    if (!classData?.academicSessionId) {
      console.error(`Class ${classId} has no academicSessionId - cannot retrieve weekly timetable safely`);
      return null;
    }
    
    const conditions = [
      eq(weeklyTimetables.classId, classId),
      eq(weeklyTimetables.weekStart, weekStartStr),
      eq(weeklyTimetables.isActive, true),
      eq(weeklyTimetables.academicSessionId, classData.academicSessionId)
    ];
    
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(and(...conditions))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }

  async getWeeklyTimetablesBatch(classIds: string[], weekStart: Date): Promise<Map<string, WeeklyTimetable | null>> {
    if (classIds.length === 0) {
      return new Map();
    }

    // Convert to YYYY-MM-DD string in IST
    const weekStartStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Fetch all weekly timetables for these classes in one query
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          inArray(weeklyTimetables.classId, classIds),
          eq(weeklyTimetables.weekStart, weekStartStr),
          eq(weeklyTimetables.isActive, true)
        )
      );

    // Create map with null defaults for all classes
    const timetablesByClass = new Map<string, WeeklyTimetable | null>();
    classIds.forEach(classId => timetablesByClass.set(classId, null));
    
    // Fill in the ones we found
    results.forEach(timetable => {
      timetablesByClass.set(timetable.classId, timetable);
    });

    return timetablesByClass;
  }

  async createWeeklyTimetable(data: InsertWeeklyTimetable): Promise<WeeklyTimetable> {
    const results = await db
      .insert(weeklyTimetables)
      .values(data)
      .returning();
    
    return results[0];
  }

  async updateWeeklyTimetable(id: string, data: Partial<InsertWeeklyTimetable>): Promise<WeeklyTimetable> {
    const results = await db
      .update(weeklyTimetables)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(weeklyTimetables.id, id))
      .returning();
    
    return results[0];
  }

  async createOrUpdateWeeklyTimetable(
    classId: string, 
    weekStart: Date, 
    timetableData: any[],
    modifiedBy: string,
    schoolId: string
  ): Promise<WeeklyTimetable> {
    // Calculate week end (Sunday) - create new Date to avoid mutation
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
    
    // Convert dates to YYYY-MM-DD format in IST (avoid UTC conversion issues)
    // Format: Use toLocaleDateString with IST timezone to get the correct date
    const weekStartStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD format
    const weekEndStr = weekEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    console.log(`[STORAGE IST] Creating weekly timetable: ${weekStartStr} (Mon) to ${weekEndStr} (Sun)`);
    
    // Check if a weekly timetable already exists for this class and week
    const existing = await this.getWeeklyTimetable(classId, weekStart);
    
    if (existing) {
      // Update the existing weekly timetable
      return await this.updateWeeklyTimetable(existing.id, {
        timetableData,
        modifiedBy,
        modificationCount: existing.modificationCount + 1,
      });
    } else {
      // Get class data to obtain academic session ID
      const classData = await this.getClass(classId);
      if (!classData) {
        throw new Error(`Class ${classId} not found`);
      }
      
      // REQUIRE academic session ID to prevent NULL session data
      if (!classData.academicSessionId) {
        throw new Error(`Class ${classId} has no academicSessionId - cannot create weekly timetable without session context`);
      }
      
      // Create a new weekly timetable with IST-formatted dates
      return await this.createWeeklyTimetable({
        classId,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        timetableData,
        modifiedBy,
        modificationCount: 1,
        basedOnGlobalVersion: 'current', // Track the global version this is based on
        schoolId,
        isActive: true,
        academicSessionId: classData.academicSessionId,
      });
    }
  }

  async promoteWeeklyTimetableToGlobal(weeklyTimetableId: string): Promise<void> {
    // Get the weekly timetable
    const weeklyTimetable = await db
      .select()
      .from(weeklyTimetables)
      .where(eq(weeklyTimetables.id, weeklyTimetableId))
      .limit(1);
    
    if (weeklyTimetable.length === 0) {
      throw new Error('Weekly timetable not found');
    }
    
    const weekly = weeklyTimetable[0];
    
    await db.transaction(async (tx) => {
      // Deactivate current global timetable entries for this class
      await tx
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, weekly.classId));
      
      // Create new global timetable entries from weekly timetable data
      if (weekly.timetableData && Array.isArray(weekly.timetableData)) {
        const newEntries = weekly.timetableData
          .filter(entry => entry.teacherId && entry.subjectId) // Only non-cancelled entries
          .map(entry => ({
            classId: weekly.classId,
            teacherId: entry.teacherId!,
            subjectId: entry.subjectId!,
            day: entry.day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
            period: entry.period,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
            isActive: true,
          }));
        
        if (newEntries.length > 0) {
          await tx.insert(timetableEntries).values(newEntries);
        }
      }
    });
  }

  // Get all timetable entries for a specific class
  async getTimetableEntriesForClass(classId: string): Promise<any[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.classId, classId),
          eq(timetableEntries.isActive, true)
        )
      )
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  // Get detailed timetable entries with teacher and subject information
  async getTimetableEntriesWithDetails(): Promise<any[]> {
    return await db
      .select({
        id: timetableEntries.id,
        classId: timetableEntries.classId,
        teacherId: timetableEntries.teacherId,
        subjectId: timetableEntries.subjectId,
        day: timetableEntries.day,
        period: timetableEntries.period,
        startTime: timetableEntries.startTime,
        endTime: timetableEntries.endTime,
        room: timetableEntries.room,
        isActive: timetableEntries.isActive,
        createdAt: timetableEntries.createdAt,
        updatedAt: timetableEntries.updatedAt,
        teacher: {
          id: teachers.id,
          name: teachers.name,
          email: teachers.email,
          contactNumber: teachers.contactNumber,
          schoolIdNumber: teachers.schoolIdNumber,
          classes: teachers.classes,
          availability: teachers.availability,
          maxDailyPeriods: teachers.maxDailyPeriods,
          schoolId: teachers.schoolId,
          isActive: teachers.isActive,
          status: teachers.status,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt
        },
        subject: {
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          periodsPerWeek: subjects.periodsPerWeek,
          color: subjects.color,
          schoolId: subjects.schoolId,
          createdAt: subjects.createdAt,
          updatedAt: subjects.updatedAt
        },
        class: {
          id: classes.id,
          grade: classes.grade,
          section: classes.section,
          studentCount: classes.studentCount,
          requiredSubjects: classes.requiredSubjects,
          schoolId: classes.schoolId,
          room: classes.room,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt
        }
      })
      .from(timetableEntries)
      .leftJoin(teachers, eq(timetableEntries.teacherId, teachers.id))
      .leftJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .leftJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(eq(timetableEntries.isActive, true))
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  // Deactivate all timetable entries for a specific class
  async deactivateTimetableEntriesForClass(classId: string): Promise<void> {
    await db
      .update(timetableEntries)
      .set({ 
        isActive: false,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(timetableEntries.classId, classId));
  }

  // Create multiple timetable entries at once
  async createMultipleTimetableEntries(entries: any[]): Promise<any[]> {
    if (entries.length === 0) return [];
    
    const results = await db
      .insert(timetableEntries)
      .values(entries)
      .returning();
    
    return results;
  }

  // Update or create a specific entry in weekly timetable
  async updateWeeklyTimetableEntry(
    classId: string,
    weekStart: string,
    weekEnd: string,
    day: string,
    period: number,
    entryData: {
      teacherId: string | null;
      subjectId: string | null;
      startTime?: string;
      endTime?: string;
      room?: string | null;
      isModified: boolean;
      modificationReason?: string;
    },
    modifiedBy: string
  ): Promise<{ id: string; modificationCount: number }> {
    return await db.transaction(async (tx) => {
      // First get or create the weekly timetable for this week
      let [existingWeeklyTimetable] = await tx
        .select()
        .from(weeklyTimetables)
        .where(
          and(
            eq(weeklyTimetables.classId, classId),
            eq(weeklyTimetables.weekStart, weekStart),
            eq(weeklyTimetables.isActive, true)
          )
        );

      let timetableData: any[] = [];
      let modificationCount = 1;

      if (existingWeeklyTimetable) {
        // Update existing weekly timetable
        timetableData = Array.isArray(existingWeeklyTimetable.timetableData) 
          ? [...existingWeeklyTimetable.timetableData] 
          : [];
        modificationCount = (existingWeeklyTimetable.modificationCount || 0) + 1;
      } else {
        // Create new weekly timetable based on current global timetable for this class
        const globalEntries = await tx
          .select()
          .from(timetableEntries)
          .where(
            and(
              eq(timetableEntries.classId, classId),
              eq(timetableEntries.isActive, true)
            )
          );

        // Convert global entries to weekly timetable format
        timetableData = globalEntries.map(entry => ({
          day: entry.day,
          period: entry.period,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isModified: false
        }));
      }

      // Find and update the specific entry, or add it if it doesn't exist
      const entryIndex = timetableData.findIndex(
        entry => entry.day.toLowerCase() === day.toLowerCase() && entry.period === period
      );

      // If both teacherId and subjectId are null, this is a deletion - remove the entry
      if (!entryData.teacherId && !entryData.subjectId) {
        if (entryIndex >= 0) {
          // Remove the entry from the timetable data
          timetableData.splice(entryIndex, 1);
        }
        // If entry doesn't exist, nothing to delete
      } else {
        // This is an assignment/update - create or update the entry
        const updatedEntry = {
          day: day.toLowerCase(),
          period,
          teacherId: entryData.teacherId,
          subjectId: entryData.subjectId,
          startTime: entryData.startTime || "08:00",
          endTime: entryData.endTime || "08:45",
          room: entryData.room || null,
          isModified: entryData.isModified,
          modificationReason: entryData.modificationReason
        };

        if (entryIndex >= 0) {
          timetableData[entryIndex] = updatedEntry;
        } else {
          timetableData.push(updatedEntry);
        }
      }

      if (existingWeeklyTimetable) {
        // Update existing record
        const [updated] = await tx
          .update(weeklyTimetables)
          .set({
            timetableData,
            modificationCount,
            modifiedBy,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(weeklyTimetables.id, existingWeeklyTimetable.id))
          .returning({ id: weeklyTimetables.id, modificationCount: weeklyTimetables.modificationCount });

        return { id: updated.id, modificationCount: updated.modificationCount };
      } else {
        // Create new record
        const [created] = await tx
          .insert(weeklyTimetables)
          .values({
            classId,
            weekStart,
            weekEnd,
            timetableData,
            modifiedBy,
            modificationCount,
            schoolId: (await tx.select({ schoolId: classes.schoolId }).from(classes).where(eq(classes.id, classId)))[0].schoolId
          })
          .returning({ id: weeklyTimetables.id, modificationCount: weeklyTimetables.modificationCount });

        return { id: created.id, modificationCount: created.modificationCount };
      }
    });
  }

  // Delete global timetable and current/future weekly timetables for a specific class
  async deleteGlobalAndFutureWeeklyTimetables(classId: string): Promise<{ globalDeleted: number, weeklyDeleted: number }> {
    const result = { globalDeleted: 0, weeklyDeleted: 0 };
    
    // Calculate current week start (Monday)
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday of current week
    currentWeekStart.setHours(0, 0, 0, 0); // Start of day
    
    const currentWeekStartString = currentWeekStart.toISOString().split('T')[0];
    
    await db.transaction(async (tx) => {
      // Delete all global timetable entries for this class
      const deletedGlobal = await tx
        .delete(timetableEntries)
        .where(eq(timetableEntries.classId, classId))
        .returning({ id: timetableEntries.id });
      
      result.globalDeleted = deletedGlobal.length;
      
      // Delete only weekly timetables from current week onwards (preserve past weeks for history)
      const deletedWeekly = await tx
        .delete(weeklyTimetables)
        .where(
          and(
            eq(weeklyTimetables.classId, classId),
            gte(weeklyTimetables.weekStart, currentWeekStartString)
          )
        )
        .returning({ id: weeklyTimetables.id });
      
      result.weeklyDeleted = deletedWeekly.length;
    });
    
    return result;
  }

  // RBAC operations implementation

  async getSystemModules(isActive?: boolean): Promise<SystemModule[]> {
    const conditions = [];
    if (isActive !== undefined) {
      conditions.push(eq(systemModules.isActive, isActive));
    }
    
    const query = db.select().from(systemModules);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(systemModules.sortOrder, systemModules.displayName);
    }
    return await query.orderBy(systemModules.sortOrder, systemModules.displayName);
  }

  // Custom Roles operations implementation
  async getCustomRoles(schoolId: string, isActive?: boolean): Promise<CustomRole[]> {
    const conditions = [eq(customRoles.schoolId, schoolId)];
    if (isActive !== undefined) {
      conditions.push(eq(customRoles.isActive, isActive));
    }
    return await db.select().from(customRoles).where(and(...conditions)).orderBy(customRoles.name);
  }

  async getCustomRoleById(id: string): Promise<CustomRole | undefined> {
    const [role] = await db.select().from(customRoles).where(eq(customRoles.id, id)).limit(1);
    return role;
  }

  async createCustomRole(role: InsertCustomRole): Promise<CustomRole> {
    const [created] = await db.insert(customRoles).values(role).returning();
    return created;
  }

  async updateCustomRole(id: string, role: Partial<InsertCustomRole>): Promise<CustomRole> {
    const [updated] = await db
      .update(customRoles)
      .set({ ...role, updatedAt: new Date() })
      .where(eq(customRoles.id, id))
      .returning();
    return updated;
  }

  async deleteCustomRole(id: string): Promise<void> {
    // This will cascade delete rolePermissions and set user.customRoleId to null
    await db.delete(customRoles).where(eq(customRoles.id, id));
  }

  async assignCustomRoleToUser(userId: string, customRoleId: string | null): Promise<void> {
    await db
      .update(users)
      .set({ customRoleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getUserCustomRoles(userId: string): Promise<CustomRole[]> {
    const roles = await db
      .select({
        id: customRoles.id,
        schoolId: customRoles.schoolId,
        name: customRoles.name,
        description: customRoles.description,
        color: customRoles.color,
        basedOnRole: customRoles.basedOnRole,
        isActive: customRoles.isActive,
        createdBy: customRoles.createdBy,
        createdAt: customRoles.createdAt,
        updatedAt: customRoles.updatedAt,
      })
      .from(userCustomRoles)
      .innerJoin(customRoles, eq(userCustomRoles.customRoleId, customRoles.id))
      .where(eq(userCustomRoles.userId, userId));
    return roles;
  }

  async assignCustomRolesToUser(userId: string, customRoleIds: string[], assignedBy: string): Promise<void> {
    // First, remove all existing custom role assignments for this user
    await db.delete(userCustomRoles).where(eq(userCustomRoles.userId, userId));
    
    // Then, add the new assignments
    if (customRoleIds.length > 0) {
      const assignments = customRoleIds.map(customRoleId => ({
        userId,
        customRoleId,
        assignedBy,
      }));
      await db.insert(userCustomRoles).values(assignments);
    }
  }

  async removeCustomRoleFromUser(userId: string, customRoleId: string): Promise<void> {
    await db
      .delete(userCustomRoles)
      .where(and(eq(userCustomRoles.userId, userId), eq(userCustomRoles.customRoleId, customRoleId)));
  }

  async getRolePermissions(schoolId: string, role?: string, customRoleId?: string): Promise<any[]> {
    const conditions = [eq(rolePermissions.schoolId, schoolId), eq(rolePermissions.isActive, true)];
    if (role) {
      conditions.push(eq(rolePermissions.role, role));
    }
    if (customRoleId) {
      conditions.push(eq(rolePermissions.customRoleId, customRoleId));
    }
    return await db.select().from(rolePermissions).where(and(...conditions));
  }

  async setRolePermission(permission: any): Promise<any> {
    const [created] = await db.insert(rolePermissions).values(permission).returning();
    return created;
  }

  async updateRolePermission(id: string, permission: any): Promise<any> {
    const [updated] = await db
      .update(rolePermissions)
      .set({ ...permission, updatedAt: new Date() })
      .where(eq(rolePermissions.id, id))
      .returning();
    return updated;
  }

  async deleteRolePermission(id: string): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.id, id));
  }

  // Post operations for newsfeed system
  async getPosts(schoolId: string, feedScope?: 'school' | 'class', classId?: string, offset?: number, limit?: number, filter?: 'all' | 'circular' | 'resource'): Promise<Post[]> {
    const conditions = [eq(posts.schoolId, schoolId), eq(posts.isActive, true)];
    
    if (feedScope) {
      conditions.push(eq(posts.feedScope, feedScope));
    }
    
    if (classId) {
      conditions.push(eq(posts.classId, classId));
      
      // For class posts, filter by the class's academic session
      const classData = await this.getClass(classId);
      if (classData?.academicSessionId) {
        conditions.push(eq(posts.academicSessionId, classData.academicSessionId));
      }
    }

    // Apply content type filter
    if (filter === 'circular') {
      conditions.push(eq(posts.isCircular, true));
    } else if (filter === 'resource') {
      conditions.push(eq(posts.isResource, true));
    }
    // 'all' filter shows everything, no additional condition needed
    
    let query = db
      .select({
        id: posts.id,
        content: posts.content,
        attachments: posts.attachments,
        postedById: posts.postedById,
        feedScope: posts.feedScope,
        classId: posts.classId,
        schoolId: posts.schoolId,
        academicSessionId: posts.academicSessionId,
        isActive: posts.isActive,
        isCircular: posts.isCircular,
        isResource: posts.isResource,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        // Include author information
        authorName: sql<string>`CASE 
          WHEN ${users.role} = 'admin' THEN ${schools.name}
          ELSE COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')
        END`.as('authorName'),
        authorRole: users.role,
      })
      .from(posts)
      .leftJoin(users, eq(posts.postedById, users.id))
      .leftJoin(schools, and(eq(users.schoolId, schools.id), eq(users.role, 'admin')))
      .where(and(...conditions))
      .orderBy(sql`${posts.createdAt} DESC`);
    
    // Add pagination if provided
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    return await query;
  }

  async getPostById(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [created] = await db.insert(posts).values(post).returning();
    return created;
  }

  async updatePost(id: string, post: Partial<InsertPost>): Promise<Post> {
    const [updated] = await db
      .update(posts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  async deletePost(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  async getPostsWithFileId(fileId: string): Promise<Post[]> {
    // Find posts that contain this fileId in their attachments array
    // Handle both old format (strings) and new format (objects with fileId property)
    return await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.isActive, true),
          sql`(
            ${posts.attachments} ? ${fileId} OR 
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(${posts.attachments}) AS elem 
              WHERE elem->>'fileId' = ${fileId}
            )
          )`
        )
      );
  }

  // CRITICAL SECURITY: Class membership verification methods for file access control
  async isTeacherAssignedToClass(teacherId: string, classId: string): Promise<boolean> {
    try {
      const assignment = await db
        .select()
        .from(classSubjectAssignments)
        .where(
          and(
            eq(classSubjectAssignments.assignedTeacherId, teacherId),
            eq(classSubjectAssignments.classId, classId)
          )
        )
        .limit(1);
      return assignment.length > 0;
    } catch (error) {
      console.error("Error checking teacher class assignment:", error);
      return false; // Deny access on error for security
    }
  }

  async isStudentInClass(studentId: string, classId: string): Promise<boolean> {
    try {
      const student = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.id, studentId),
            eq(students.classId, classId),
            eq(students.isActive, true)
          )
        )
        .limit(1);
      return student.length > 0;
    } catch (error) {
      console.error("Error checking student class membership:", error);
      return false; // Deny access on error for security
    }
  }

  async isParentLinkedToClass(parentId: string, classId: string): Promise<boolean> {
    try {
      // Check if parent has any children in the specified class
      const parentChildren = await db
        .select()
        .from(studentParents)
        .innerJoin(students, eq(studentParents.studentId, students.id))
        .where(
          and(
            eq(studentParents.parentId, parentId),
            eq(students.classId, classId),
            eq(students.isActive, true)
          )
        )
        .limit(1);
      return parentChildren.length > 0;
    } catch (error) {
      console.error("Error checking parent class link:", error);
      return false; // Deny access on error for security
    }
  }

  async getUserFeed(userId: string): Promise<Post[]> {
    const user = await this.getUser(userId);
    if (!user || !user.schoolId) return [];

    const conditions = [eq(posts.schoolId, user.schoolId), eq(posts.isActive, true)];
    
    // Always include school-wide posts
    const schoolCondition = eq(posts.feedScope, 'school');
    
    // If user is a student, also include posts from their class
    let classCondition = null;
    if (user.role === 'student' && user.studentId) {
      // Get student's class
      const student = await db.select().from(students).where(eq(students.id, user.studentId));
      if (student[0]?.classId) {
        classCondition = and(eq(posts.feedScope, 'class'), eq(posts.classId, student[0].classId));
      }
    }
    
    // If user is a teacher, include posts from classes they teach
    if (user.role === 'teacher' && user.teacherId) {
      // Get classes where teacher is assigned
      const teacherClasses = await db
        .select({ classId: classSubjectAssignments.classId })
        .from(classSubjectAssignments)
        .where(eq(classSubjectAssignments.assignedTeacherId, user.teacherId));
      
      if (teacherClasses.length > 0) {
        const classIds = teacherClasses.map(c => c.classId).filter(Boolean);
        if (classIds.length > 0) {
          classCondition = and(eq(posts.feedScope, 'class'), inArray(posts.classId, classIds));
        }
      }
    }
    
    // If user is a parent, include posts from their children's classes
    if (user.role === 'parent' && user.parentId) {
      // Get parent's children and their classes
      const parentChildren = await db
        .select({ classId: students.classId })
        .from(studentParents)
        .innerJoin(students, eq(studentParents.studentId, students.id))
        .where(eq(studentParents.parentId, user.parentId));
      
      if (parentChildren.length > 0) {
        const classIds = parentChildren.map(c => c.classId).filter(Boolean);
        if (classIds.length > 0) {
          classCondition = and(eq(posts.feedScope, 'class'), inArray(posts.classId, classIds));
        }
      }
    }
    
    // Build final condition (school posts OR class posts)
    let finalCondition;
    if (classCondition) {
      finalCondition = and(...conditions, or(schoolCondition, classCondition));
    } else {
      finalCondition = and(...conditions, schoolCondition);
    }
    
    return await db
      .select()
      .from(posts)
      .where(finalCondition)
      .orderBy(sql`${posts.createdAt} DESC`);
  }

  async getUserModulePermissions(userId: string, schoolId?: string): Promise<{ moduleId: string; permissions: any }[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    // CRITICAL SECURITY: For non-super admins, only use their assigned schoolId
    const userSchoolId = user.role === 'super_admin' ? (schoolId || user.schoolId) : user.schoolId;
    if (!userSchoolId) return [];

    // Priority 1: Get permissions from all custom roles assigned to user (from junction table)
    const userCustomRolesData = await db
      .select({ customRoleId: userCustomRoles.customRoleId })
      .from(userCustomRoles)
      .where(eq(userCustomRoles.userId, userId));
    
    if (userCustomRolesData.length > 0) {
      const customRoleIds = userCustomRolesData.map(r => r.customRoleId);
      const customPermissions = await db
        .select({
          moduleId: rolePermissions.moduleId,
          permissions: rolePermissions.permissions,
        })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.schoolId, userSchoolId),
            inArray(rolePermissions.customRoleId, customRoleIds),
            eq(rolePermissions.isActive, true)
          )
        );
      
      // Aggregate permissions: for each module, union all permissions from all roles
      const aggregated = new Map<string, any>();
      for (const perm of customPermissions) {
        const existing = aggregated.get(perm.moduleId);
        if (existing) {
          // Union: if any role grants a permission, user has it
          aggregated.set(perm.moduleId, {
            read: existing.read || perm.permissions.read,
            write: existing.write || perm.permissions.write,
            delete: existing.delete || perm.permissions.delete,
            export: existing.export || perm.permissions.export,
          });
        } else {
          aggregated.set(perm.moduleId, perm.permissions);
        }
      }
      
      if (aggregated.size > 0) {
        return Array.from(aggregated.entries()).map(([moduleId, permissions]) => ({
          moduleId,
          permissions,
        }));
      }
    }

    // Priority 2: Fall back to system role permissions
    const permissions = await db
      .select({
        moduleId: rolePermissions.moduleId,
        permissions: rolePermissions.permissions,
      })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.schoolId, userSchoolId),
          eq(rolePermissions.role, user.role),
          eq(rolePermissions.isActive, true)
        )
      );

    return permissions;
  }

  async checkUserPermission(userId: string, moduleId: string, action: 'read' | 'write' | 'delete' | 'export', schoolId?: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Super admins have all permissions
    if (user.role === 'super_admin') return true;

    // CRITICAL SECURITY: For non-super admins, ignore caller schoolId and use user's assigned school
    const userSchoolId = user.schoolId;
    if (!userSchoolId) return false;

    // Priority 1: Check permissions from all custom roles assigned to user (from junction table)
    const userCustomRolesData = await db
      .select({ customRoleId: userCustomRoles.customRoleId })
      .from(userCustomRoles)
      .where(eq(userCustomRoles.userId, userId));
    
    if (userCustomRolesData.length > 0) {
      const customRoleIds = userCustomRolesData.map(r => r.customRoleId);
      const customPermissions = await db
        .select({ permissions: rolePermissions.permissions })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.schoolId, userSchoolId),
            inArray(rolePermissions.customRoleId, customRoleIds),
            eq(rolePermissions.moduleId, moduleId),
            eq(rolePermissions.isActive, true)
          )
        );
      
      // If any custom role grants the permission, return true
      for (const perm of customPermissions) {
        if (perm.permissions?.[action]) {
          return true;
        }
      }
      
      // If user has custom roles but none grant permission, deny (don't fall back to system role)
      if (userCustomRolesData.length > 0) {
        return false;
      }
    }

    // Priority 2: Fall back to system role permissions
    const [permission] = await db
      .select({ permissions: rolePermissions.permissions })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.schoolId, userSchoolId),
          eq(rolePermissions.role, user.role),
          eq(rolePermissions.moduleId, moduleId),
          eq(rolePermissions.isActive, true)
        )
      );

    return permission?.permissions?.[action] || false;
  }

  // Student operations
  async getStudents(schoolId?: string, classId?: string, academicSessionId?: string, offset?: number, limit?: number): Promise<Student[]> {
    let query = db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        email: students.email,
        contactNumber: students.contactNumber,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        address: students.address,
        classId: students.classId,
        schoolId: students.schoolId,
        rollNumber: students.rollNumber,
        bloodGroup: students.bloodGroup,
        guardianName: students.guardianName,
        guardianRelation: students.guardianRelation,
        guardianContact: students.guardianContact,
        emergencyContact: students.emergencyContact,
        medicalInfo: students.medicalInfo,
        profilePictureUrl: students.profilePictureUrl,
        isActive: students.isActive,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
        class: {
          id: classes.id,
          grade: classes.grade,
          section: classes.section,
          studentCount: classes.studentCount,
          schoolId: classes.schoolId,
          academicSessionId: classes.academicSessionId,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt,
        }
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id));
    
    const conditions = [eq(students.isActive, true)];
    
    if (schoolId) {
      conditions.push(eq(students.schoolId, schoolId));
    }
    if (classId) {
      conditions.push(eq(students.classId, classId));
    }
    
    // Session-aware filtering through classes
    if (academicSessionId) {
      conditions.push(eq(classes.academicSessionId, academicSessionId));
    } else if (schoolId) {
      // Get current session for the school if no session specified
      const currentSession = await this.getCurrentAcademicSession(schoolId);
      if (currentSession) {
        conditions.push(eq(classes.academicSessionId, currentSession.id));
      }
    }
    
    query = query.where(and(...conditions));
    
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    const results = await query;
    
    // Return students with class data (null if no class assigned)
    return results.map(result => ({
      ...result,
      class: result.class && result.class.id ? result.class : null
    }));
  }

  async getStudentCountBySchool(schoolId?: string, classId?: string, academicSessionId?: string): Promise<number> {
    let query = db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id));
    
    const conditions = [eq(students.isActive, true)];
    
    if (schoolId) {
      conditions.push(eq(students.schoolId, schoolId));
    }
    if (classId) {
      conditions.push(eq(students.classId, classId));
    }
    
    // Session-aware filtering through classes
    if (academicSessionId) {
      conditions.push(eq(classes.academicSessionId, academicSessionId));
    } else if (schoolId) {
      // Get current session for the school if no session specified
      const currentSession = await this.getCurrentAcademicSession(schoolId);
      if (currentSession) {
        conditions.push(eq(classes.academicSessionId, currentSession.id));
      }
    }
    
    query = query.where(and(...conditions));
    
    const result = await query;
    return result[0]?.count || 0;
  }

  async getStudent(id: string): Promise<any> {
    const [result] = await db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        email: students.email,
        contactNumber: students.contactNumber,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        address: students.address,
        classId: students.classId,
        schoolId: students.schoolId,
        rollNumber: students.rollNumber,
        bloodGroup: students.bloodGroup,
        guardianName: students.guardianName,
        guardianRelation: students.guardianRelation,
        guardianContact: students.guardianContact,
        emergencyContact: students.emergencyContact,
        medicalInfo: students.medicalInfo,
        profilePictureUrl: students.profilePictureUrl,
        isActive: students.isActive,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
        class: {
          id: classes.id,
          grade: classes.grade,
          section: classes.section,
          studentCount: classes.studentCount,
          schoolId: classes.schoolId,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt,
        }
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.id, id))
      .limit(1);
    
    if (!result) return undefined;
    
    // Return the student with class data (null if no class assigned)
    return {
      ...result,
      class: result.class && result.class.id ? result.class : null
    };
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [created] = await db.insert(students).values(student).returning();
    
    // Update student count for the class
    if (created.classId) {
      await this.updateClassStudentCount(created.classId);
    }
    
    return created;
  }

  async updateStudent(id: string, student: Partial<InsertStudent>): Promise<Student> {
    // Get the original student data before update
    const originalStudent = await this.getStudent(id);
    
    const [updated] = await db
      .update(students)
      .set({ ...student, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();
    
    // Update student count for both old and new classes if class changed
    if (originalStudent?.classId && originalStudent.classId !== updated.classId) {
      await this.updateClassStudentCount(originalStudent.classId);
    }
    if (updated.classId) {
      await this.updateClassStudentCount(updated.classId);
    }
    
    return updated;
  }

  async deleteStudent(id: string): Promise<void> {
    // Get the student's class before deletion for count update
    const studentToDelete = await this.getStudent(id);
    
    await db.update(students).set({ isActive: false }).where(eq(students.id, id));
    
    // Update student count for the class
    if (studentToDelete?.classId) {
      await this.updateClassStudentCount(studentToDelete.classId);
    }
  }

  async getStudentsByClass(classId: string): Promise<Student[]> {
    return await db
      .select()
      .from(students)
      .where(and(eq(students.classId, classId), eq(students.isActive, true)));
  }

  // Helper function to recalculate and update student count for a class
  async updateClassStudentCount(classId: string): Promise<void> {
    const activeStudentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(and(eq(students.classId, classId), eq(students.isActive, true)));
    
    const count = activeStudentCount[0]?.count || 0;
    
    await db
      .update(classes)
      .set({ studentCount: count })
      .where(eq(classes.id, classId));
  }

  // Parent operations
  async getParentsBySchool(schoolId: string): Promise<Parent[]> {
    return await this.getParents(schoolId);
  }

  // Active parents of the active students in a class (each parent once)
  async getParentsByClass(classId: string): Promise<Parent[]> {
    return await db
      .selectDistinct({ parent: parents })
      .from(studentParents)
      .innerJoin(students, eq(studentParents.studentId, students.id))
      .innerJoin(parents, eq(studentParents.parentId, parents.id))
      .where(and(eq(students.classId, classId), eq(students.isActive, true), eq(parents.isActive, true)))
      .then(rows => rows.map(row => row.parent));
  }

  async getParents(schoolId?: string): Promise<Parent[]> {
    let query = db.select().from(parents);
    const conditions = [eq(parents.isActive, true)];
    
    if (schoolId) {
      conditions.push(eq(parents.schoolId, schoolId));
    }
    
    return await query.where(and(...conditions));
  }

  async getParent(id: string): Promise<Parent | undefined> {
    const [parent] = await db.select().from(parents).where(eq(parents.id, id));
    return parent;
  }

  async createParent(parent: InsertParent): Promise<Parent> {
    const [created] = await db.insert(parents).values(parent).returning();
    return created;
  }

  async updateParent(id: string, parent: Partial<InsertParent>): Promise<Parent> {
    const [updated] = await db
      .update(parents)
      .set({ ...parent, updatedAt: new Date() })
      .where(eq(parents.id, id))
      .returning();
    return updated;
  }

  async deleteParent(id: string): Promise<void> {
    await db.update(parents).set({ isActive: false }).where(eq(parents.id, id));
  }

  // Student-Parent relationship operations
  async linkStudentToParent(studentId: string, parentId: string): Promise<StudentParent> {
    const [created] = await db.insert(studentParents).values({
      studentId,
      parentId
    }).returning();
    return created;
  }

  async unlinkStudentFromParent(studentId: string, parentId: string): Promise<void> {
    await db.delete(studentParents).where(
      and(
        eq(studentParents.studentId, studentId),
        eq(studentParents.parentId, parentId)
      )
    );
  }

  async getParentChildren(parentId: string): Promise<Student[]> {
    return await db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        email: students.email,
        contactNumber: students.contactNumber,
        address: students.address,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        bloodGroup: students.bloodGroup,
        classId: students.classId,
        rollNumber: students.rollNumber,
        emergencyContact: students.emergencyContact,
        medicalInfo: students.medicalInfo,
        profilePictureUrl: students.profilePictureUrl,
        schoolId: students.schoolId,
        isActive: students.isActive,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt
      })
      .from(studentParents)
      .innerJoin(students, eq(studentParents.studentId, students.id))
      .where(and(
        eq(studentParents.parentId, parentId),
        eq(students.isActive, true)
      ));
  }

  async getStudentParents(studentId: string): Promise<Parent[]> {
    return await db
      .select({
        id: parents.id,
        firstName: parents.firstName,
        lastName: parents.lastName,
        email: parents.email,
        contactNumber: parents.contactNumber,
        alternateContact: parents.alternateContact,
        address: parents.address,
        occupation: parents.occupation,
        relationToStudent: parents.relationToStudent,
        schoolId: parents.schoolId,
        isActive: parents.isActive,
        createdAt: parents.createdAt,
        updatedAt: parents.updatedAt
      })
      .from(studentParents)
      .innerJoin(parents, eq(studentParents.parentId, parents.id))
      .where(and(
        eq(studentParents.studentId, studentId),
        eq(parents.isActive, true)
      ));
  }

  async getStudentParentsWithDetails(studentId: string): Promise<(StudentParent & { parent: Parent })[]> {
    const results = await db
      .select({
        // StudentParent fields
        id: studentParents.id,
        studentId: studentParents.studentId,
        parentId: studentParents.parentId,
        isPrimary: studentParents.isPrimary,
        spCreatedAt: studentParents.createdAt,
        // Parent fields
        parentData_id: parents.id,
        parentData_firstName: parents.firstName,
        parentData_lastName: parents.lastName,
        parentData_email: parents.email,
        parentData_contactNumber: parents.contactNumber,
        parentData_alternateContact: parents.alternateContact,
        parentData_address: parents.address,
        parentData_occupation: parents.occupation,
        parentData_relationToStudent: parents.relationToStudent,
        parentData_schoolId: parents.schoolId,
        parentData_isActive: parents.isActive,
        parentData_createdAt: parents.createdAt,
        parentData_updatedAt: parents.updatedAt
      })
      .from(studentParents)
      .innerJoin(parents, eq(studentParents.parentId, parents.id))
      .where(and(
        eq(studentParents.studentId, studentId),
        eq(parents.isActive, true)
      ));

    // Transform the flattened result into the expected structure
    return results.map(row => ({
      id: row.id,
      studentId: row.studentId,
      parentId: row.parentId,
      isPrimary: row.isPrimary,
      createdAt: row.spCreatedAt,
      parent: {
        id: row.parentData_id,
        firstName: row.parentData_firstName,
        lastName: row.parentData_lastName,
        email: row.parentData_email,
        contactNumber: row.parentData_contactNumber,
        alternateContact: row.parentData_alternateContact,
        address: row.parentData_address,
        occupation: row.parentData_occupation,
        relationToStudent: row.parentData_relationToStudent,
        schoolId: row.parentData_schoolId,
        isActive: row.parentData_isActive,
        createdAt: row.parentData_createdAt,
        updatedAt: row.parentData_updatedAt
      }
    }));
  }

  async getStudentCredentials(studentId: string): Promise<{ studentLogin: { loginId: string; temporaryPassword?: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null; parentLogin: { loginId: string; temporaryPassword?: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null; }> {
    // Get student user account
    const [studentUser] = await db
      .select({
        loginId: users.loginId,
        temporaryPassword: users.temporaryPasswordPlainText,
        hasTemporaryPassword: sql<boolean>`${users.temporaryPassword} IS NOT NULL`,
        temporaryPasswordExpiresAt: users.temporaryPasswordExpiresAt
      })
      .from(users)
      .where(and(
        eq(users.studentId, studentId),
        eq(users.role, 'student'),
        eq(users.isActive, true)
      ));

    // Get student admission number for parent login
    const [student] = await db
      .select({ admissionNumber: students.admissionNumber })
      .from(students)
      .where(eq(students.id, studentId));

    let parentUser = null;
    if (student) {
      // Parent login ID follows pattern: P + admission number
      const parentLoginId = `P${student.admissionNumber}`;
      
      const [foundParentUser] = await db
        .select({
          loginId: users.loginId,
          temporaryPassword: users.temporaryPasswordPlainText,
          hasTemporaryPassword: sql<boolean>`${users.temporaryPassword} IS NOT NULL`,
          temporaryPasswordExpiresAt: users.temporaryPasswordExpiresAt
        })
        .from(users)
        .where(and(
          eq(users.loginId, parentLoginId),
          eq(users.role, 'parent'),
          eq(users.isActive, true)
        ));
      
      parentUser = foundParentUser || null;
    }

    return {
      studentLogin: studentUser ? {
        loginId: studentUser.loginId,
        temporaryPassword: studentUser.temporaryPassword || undefined,
        hasTemporaryPassword: studentUser.hasTemporaryPassword,
        expiresAt: studentUser.temporaryPasswordExpiresAt?.toISOString() || null
      } : null,
      parentLogin: parentUser ? {
        loginId: parentUser.loginId,
        temporaryPassword: parentUser.temporaryPassword || undefined,
        hasTemporaryPassword: parentUser.hasTemporaryPassword,
        expiresAt: parentUser.temporaryPasswordExpiresAt?.toISOString() || null
      } : null
    };
  }

  // The student's parent record (primary first); one is created from the guardian details if none is linked yet
  async ensureParentRecordForStudent(studentId: string): Promise<string> {
    const links = await db
      .select()
      .from(studentParents)
      .where(eq(studentParents.studentId, studentId))
      .orderBy(desc(studentParents.isPrimary), asc(studentParents.createdAt));
    if (links.length > 0) return links[0].parentId;

    const student = await this.getStudent(studentId);
    if (!student) throw new Error('Student not found');
    const [firstName, ...rest] = (student.guardianName || `Parent of ${student.firstName}`).trim().split(/\s+/);
    const relation = (student.guardianRelation || '').toLowerCase();
    const [parent] = await db.insert(parents).values({
      firstName,
      lastName: rest.join(' ') || student.lastName,
      contactNumber: student.guardianContact || student.emergencyContact || '',
      address: student.address || '',
      relationToStudent: (['father', 'mother', 'guardian'].includes(relation) ? relation : 'guardian') as 'father' | 'mother' | 'guardian',
      schoolId: student.schoolId,
    }).returning();
    await db.insert(studentParents).values({ studentId, parentId: parent.id, isPrimary: true });
    return parent.id;
  }

  // The parent's login account (P + admission number), linked to the parent record; created without a usable password if missing
  async ensureParentUser(parentId: string, admissionNumber: string, schoolId: string, createdBy?: string): Promise<User> {
    const [linkedUser] = await db.select().from(users).where(eq(users.parentId, parentId)).limit(1);
    if (linkedUser) return linkedUser;

    const parent = await this.getParent(parentId);
    const loginId = `P${admissionNumber}`;
    const [unlinkedUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.loginId, loginId), eq(users.role, 'parent'), eq(users.schoolId, schoolId)));
    if (unlinkedUser) {
      // Accounts made before parent linking existed: attach them to the parent record
      const [linked] = await db
        .update(users)
        .set({ parentId, firstName: unlinkedUser.firstName ?? parent?.firstName, lastName: unlinkedUser.lastName ?? parent?.lastName, updatedAt: new Date() })
        .where(eq(users.id, unlinkedUser.id))
        .returning();
      return linked;
    }

    const [created] = await db.insert(users).values({
      email: parent?.email || null,
      loginId,
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12), // Unguessable placeholder - the parent signs in with a temporary password
      role: 'parent',
      schoolId,
      parentId,
      firstName: parent?.firstName,
      lastName: parent?.lastName,
      isFirstLogin: true,
      isActive: true,
      createdBy: createdBy ?? null,
    }).returning();
    return created;
  }

  async refreshStudentCredentials(studentId: string): Promise<{ studentLogin: { userId: string; loginId: string; temporaryPassword: string; expiresAt: Date; }; parentLogin: { userId: string; loginId: string; temporaryPassword: string; expiresAt: Date; }; }> {
    // Get student details
    const [student] = await db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        schoolId: students.schoolId,
        firstName: students.firstName,
        lastName: students.lastName,
        email: students.email
      })
      .from(students)
      .where(eq(students.id, studentId));

    if (!student) {
      throw new Error('Student not found');
    }

    // Generate temporary passwords
    const studentTempPassword = generateTemporaryPassword();
    const parentTempPassword = generateTemporaryPassword();
    
    // Hash temporary passwords for secure storage
    const hashedStudentTempPassword = await bcrypt.hash(studentTempPassword, 12);
    const hashedParentTempPassword = await bcrypt.hash(parentTempPassword, 12);
    
    // Generate expiry dates (48 hours from now)
    const tempPasswordExpiry = generateTemporaryPasswordExpiry();

    // Create or update student user account
    const studentLoginId = student.admissionNumber;
    const [existingStudentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.loginId, studentLoginId),
        eq(users.role, 'student'),
        eq(users.schoolId, student.schoolId)
      ));

    let studentUserId: string;
    if (existingStudentUser) {
      // Update existing student user
      await db
        .update(users)
        .set({
          temporaryPassword: hashedStudentTempPassword,
          temporaryPasswordPlainText: studentTempPassword,
          temporaryPasswordExpiresAt: tempPasswordExpiry,
          isFirstLogin: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingStudentUser.id));
      studentUserId = existingStudentUser.id;
    } else {
      // Create new student user
      const [newUser] = await db.insert(users).values({
        email: student.email || null,
        loginId: studentLoginId,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12), // Unguessable placeholder - the user signs in with the temporary password
        temporaryPassword: hashedStudentTempPassword,
        temporaryPasswordPlainText: studentTempPassword,
        temporaryPasswordExpiresAt: tempPasswordExpiry,
        role: 'student',
        schoolId: student.schoolId,
        studentId: student.id,
        isFirstLogin: true,
        isActive: true
      }).returning({ id: users.id });
      studentUserId = newUser.id;
    }

    // Create or update the parent user account, always linked to the parent record
    const parentId = await this.ensureParentRecordForStudent(student.id);
    const parentUser = await this.ensureParentUser(parentId, student.admissionNumber, student.schoolId);
    await db
      .update(users)
      .set({
        temporaryPassword: hashedParentTempPassword,
        temporaryPasswordPlainText: parentTempPassword,
        temporaryPasswordExpiresAt: tempPasswordExpiry,
        isFirstLogin: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, parentUser.id));
    const parentUserId = parentUser.id;
    const parentLoginId = parentUser.loginId;

    return {
      studentLogin: {
        userId: studentUserId,
        loginId: studentLoginId,
        temporaryPassword: studentTempPassword,
        expiresAt: tempPasswordExpiry
      },
      parentLogin: {
        userId: parentUserId,
        loginId: parentLoginId,
        temporaryPassword: parentTempPassword,
        expiresAt: tempPasswordExpiry
      }
    };
  }

  async getStudentByAdmissionNumber(admissionNumber: string, schoolId: string): Promise<Student | undefined> {
    const [student] = await db
      .select()
      .from(students)
      .where(and(
        eq(students.admissionNumber, admissionNumber),
        eq(students.schoolId, schoolId),
        eq(students.isActive, true)
      ));
    return student;
  }

  async linkParentToStudent(parentId: string, studentId: string): Promise<StudentParent> {
    const [created] = await db.insert(studentParents).values({
      studentId,
      parentId
    }).returning();
    return created;
  }

  // Academic Session operations
  async getAcademicSessions(schoolId: string): Promise<AcademicSession[]> {
    return await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.schoolId, schoolId))
      .orderBy(asc(academicSessions.startDate));
  }

  async getCurrentAcademicSession(schoolId: string): Promise<AcademicSession | undefined> {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const [session] = await db
      .select()
      .from(academicSessions)
      .where(and(
        eq(academicSessions.schoolId, schoolId),
        lte(academicSessions.startDate, currentDate),
        gte(academicSessions.endDate, currentDate)
      ));
    return session;
  }

  async getAcademicSession(id: string): Promise<AcademicSession | undefined> {
    const [session] = await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.id, id));
    return session;
  }

  async createAcademicSession(sessionData: InsertAcademicSession): Promise<AcademicSession> {
    const [session] = await db
      .insert(academicSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateAcademicSession(id: string, sessionData: Partial<InsertAcademicSession>): Promise<AcademicSession> {
    const [session] = await db
      .update(academicSessions)
      .set({ ...sessionData, updatedAt: new Date() })
      .where(eq(academicSessions.id, id))
      .returning();
    return session;
  }

  async hasAcademicSession(schoolId: string): Promise<boolean> {
    const sessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(academicSessions)
      .where(eq(academicSessions.schoolId, schoolId));
    return (sessions[0]?.count || 0) > 0;
  }

  async getActiveAcademicSession(schoolId: string): Promise<AcademicSession | undefined> {
    // Use date-based logic to find current active session
    return await this.getCurrentAcademicSession(schoolId);
  }

  // Note: With simplified academic sessions, we no longer need setCurrentAcademicSession
  // Current session is determined by date ranges, not a flag
  // This method is now a no-op since current session is determined by date-based logic
  async setActiveAcademicSession(schoolId: string, sessionId: string): Promise<void> {
    // No-op: Current session is now determined by date ranges automatically
    // This method exists for API compatibility but performs no database operations

    // Check if the session needs empty classes created
    const sessionClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, sessionId)
      ));

    // If session has no classes, we might want to create them from a previous session
    // For now, we'll leave this to manual class creation workflows
  }

  // Session Migration operations
  async migrateToNewSession(
    currentSessionId: string,
    newSessionId: string,
    schoolId: string,
    options: {
      promoteStudents?: boolean;
      copyClassTeachers?: boolean;
      copySubjectAssignments?: boolean;
    }
  ): Promise<{ success: boolean; message: string; newClassIds: string[] }> {
    try {
      // Clone classes first
      const newClasses = await this.cloneClassesForSession(currentSessionId, newSessionId, schoolId);
      const newClassIds = newClasses.map(c => c.id);

      // Promote students if requested
      if (options.promoteStudents) {
        await this.promoteStudents(currentSessionId, newSessionId, schoolId);
      }

      // Copy subject assignments if requested
      if (options.copySubjectAssignments) {
        await this.copySubjectAssignmentsForSession(currentSessionId, newSessionId, schoolId);
      }

      // Copy class teacher assignments if requested
      if (options.copyClassTeachers) {
        await this.copyClassTeacherAssignmentsForSession(currentSessionId, newSessionId, schoolId);
      }

      return {
        success: true,
        message: `Successfully migrated to new session. Created ${newClasses.length} classes.`,
        newClassIds
      };
    } catch (error) {
      console.error('Migration error:', error);
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        newClassIds: []
      };
    }
  }

  async cloneClassesForSession(fromSessionId: string, toSessionId: string, schoolId: string): Promise<Class[]> {
    // Get all classes from the current session
    const currentClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, fromSessionId)
      ));

    // Clone each class for the new session
    const newClasses: Class[] = [];
    for (const currentClass of currentClasses) {
      const { id, createdAt, updatedAt, ...classData } = currentClass;
      const [newClass] = await db
        .insert(classes)
        .values({
          ...classData,
          academicSessionId: toSessionId
        })
        .returning();
      newClasses.push(newClass);
    }

    return newClasses;
  }

  async promoteStudents(fromSessionId: string, toSessionId: string, schoolId: string): Promise<void> {
    // Get class mapping from old session to new session
    const oldClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, fromSessionId)
      ));

    const newClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, toSessionId)
      ));

    // Create mapping based on grade and section
    const classMapping = new Map<string, string>();
    for (const oldClass of oldClasses) {
      const matchingNewClass = newClasses.find(
        nc => nc.grade === oldClass.grade && nc.section === oldClass.section
      );
      if (matchingNewClass) {
        classMapping.set(oldClass.id, matchingNewClass.id);
      }
    }

    // Get all active students from the old session classes
    const studentsToPromote = await db
      .select()
      .from(students)
      .where(and(
        eq(students.schoolId, schoolId),
        eq(students.isActive, true),
        inArray(students.classId, Array.from(classMapping.keys()))
      ));

    // Update students to new classes
    for (const student of studentsToPromote) {
      if (student.classId && classMapping.has(student.classId)) {
        const newClassId = classMapping.get(student.classId);
        if (newClassId) {
          await db
            .update(students)
            .set({ classId: newClassId })
            .where(eq(students.id, student.id));
        }
      }
    }
  }

  private async copySubjectAssignmentsForSession(fromSessionId: string, toSessionId: string, schoolId: string): Promise<void> {
    // Get old and new class mappings
    const oldClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, fromSessionId)
      ));

    const newClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, toSessionId)
      ));

    const classMapping = new Map<string, string>();
    for (const oldClass of oldClasses) {
      const matchingNewClass = newClasses.find(
        nc => nc.grade === oldClass.grade && nc.section === oldClass.section
      );
      if (matchingNewClass) {
        classMapping.set(oldClass.id, matchingNewClass.id);
      }
    }

    // Get all subject assignments from old session
    const oldAssignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(and(
        eq(classSubjectAssignments.academicSessionId, fromSessionId),
        inArray(classSubjectAssignments.classId, Array.from(classMapping.keys()))
      ));

    // Copy assignments to new session
    for (const assignment of oldAssignments) {
      const newClassId = classMapping.get(assignment.classId);
      if (newClassId) {
        const { id, createdAt, updatedAt, ...assignmentData } = assignment;
        await db
          .insert(classSubjectAssignments)
          .values({
            ...assignmentData,
            classId: newClassId,
            academicSessionId: toSessionId
          });
      }
    }
  }

  private async copyClassTeacherAssignmentsForSession(fromSessionId: string, toSessionId: string, schoolId: string): Promise<void> {
    // Get old and new class mappings
    const oldClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, fromSessionId)
      ));

    const newClasses = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(classes.academicSessionId, toSessionId)
      ));

    const classMapping = new Map<string, string>();
    for (const oldClass of oldClasses) {
      const matchingNewClass = newClasses.find(
        nc => nc.grade === oldClass.grade && nc.section === oldClass.section
      );
      if (matchingNewClass) {
        classMapping.set(oldClass.id, matchingNewClass.id);
      }
    }

    // Get all class teacher assignments from old session
    const oldAssignments = await db
      .select()
      .from(classTeacherAssignments)
      .where(and(
        eq(classTeacherAssignments.schoolId, schoolId),
        eq(classTeacherAssignments.academicSessionId, fromSessionId),
        inArray(classTeacherAssignments.classId, Array.from(classMapping.keys()))
      ));

    // Copy assignments to new session
    for (const assignment of oldAssignments) {
      const newClassId = classMapping.get(assignment.classId);
      if (newClassId) {
        const { id, createdAt, updatedAt, ...assignmentData } = assignment;
        await db
          .insert(classTeacherAssignments)
          .values({
            ...assignmentData,
            classId: newClassId,
            academicSessionId: toSessionId
          });
      }
    }
  }

  // ============================================================================
  // FEE MANAGEMENT IMPLEMENTATIONS
  // ============================================================================

  // Fee Types operations
  async getFeeTypes(schoolId: string): Promise<FeeType[]> {
    return await db.select().from(feeTypes).where(eq(feeTypes.schoolId, schoolId));
  }

  async getFeeType(id: string): Promise<FeeType | undefined> {
    const [feeType] = await db.select().from(feeTypes).where(eq(feeTypes.id, id));
    return feeType;
  }

  async createFeeType(feeType: InsertFeeType): Promise<FeeType> {
    const [created] = await db.insert(feeTypes).values(feeType).returning();
    return created;
  }

  async updateFeeType(id: string, feeType: Partial<InsertFeeType>): Promise<FeeType> {
    const [updated] = await db
      .update(feeTypes)
      .set({ ...feeType, updatedAt: new Date() })
      .where(eq(feeTypes.id, id))
      .returning();
    return updated;
  }

  async deleteFeeType(id: string): Promise<void> {
    await db.delete(feeTypes).where(eq(feeTypes.id, id));
  }

  // Fee Structures operations
  async getFeeStructures(schoolId: string, academicSessionId?: string): Promise<FeeStructure[]> {
    return await db.select().from(feeStructures).where(and(
      eq(feeStructures.schoolId, schoolId),
      academicSessionId ? eq(feeStructures.academicSessionId, academicSessionId) : undefined
    ));
  }

  async getFeeStructure(id: string): Promise<FeeStructure | undefined> {
    const [feeStructure] = await db.select().from(feeStructures).where(eq(feeStructures.id, id));
    return feeStructure;
  }

  async createFeeStructure(feeStructure: InsertFeeStructure): Promise<FeeStructure> {
    const [created] = await db.insert(feeStructures).values(feeStructure).returning();
    return created;
  }

  async updateFeeStructure(id: string, feeStructure: Partial<InsertFeeStructure>): Promise<FeeStructure> {
    const [updated] = await db
      .update(feeStructures)
      .set({ ...feeStructure, updatedAt: new Date() })
      .where(eq(feeStructures.id, id))
      .returning();
    return updated;
  }

  async deleteFeeStructure(id: string): Promise<void> {
    await db.delete(feeStructures).where(eq(feeStructures.id, id));
  }

  async getFeeStructureByGradeAndCategory(schoolId: string, grade: string, section: string | null, studentCategory: string, academicSessionId: string): Promise<FeeStructure | undefined> {
    const [feeStructure] = await db
      .select()
      .from(feeStructures)
      .where(and(
        eq(feeStructures.schoolId, schoolId),
        eq(feeStructures.grade, grade),
        section ? eq(feeStructures.section, section) : sql`${feeStructures.section} IS NULL`,
        eq(feeStructures.studentCategory, studentCategory),
        eq(feeStructures.academicSessionId, academicSessionId),
        eq(feeStructures.isActive, true)
      ));
    return feeStructure;
  }

  // Fee Structure Items operations
  async getFeeStructureItems(feeStructureId: string): Promise<FeeStructureItem[]> {
    return await db.select().from(feeStructureItems).where(eq(feeStructureItems.feeStructureId, feeStructureId));
  }

  async getFeeStructureItem(id: string): Promise<FeeStructureItem | undefined> {
    const [item] = await db.select().from(feeStructureItems).where(eq(feeStructureItems.id, id));
    return item;
  }

  async createFeeStructureItem(feeStructureItem: InsertFeeStructureItem): Promise<FeeStructureItem> {
    const [created] = await db.insert(feeStructureItems).values(feeStructureItem).returning();
    return created;
  }

  async updateFeeStructureItem(id: string, feeStructureItem: Partial<InsertFeeStructureItem>): Promise<FeeStructureItem> {
    const [updated] = await db
      .update(feeStructureItems)
      .set({ ...feeStructureItem, updatedAt: new Date() })
      .where(eq(feeStructureItems.id, id))
      .returning();
    return updated;
  }

  async deleteFeeStructureItem(id: string): Promise<void> {
    await db.delete(feeStructureItems).where(eq(feeStructureItems.id, id));
  }

  // Student Fee Assignments operations
  async getStudentFeeAssignments(schoolId: string, academicSessionId?: string): Promise<StudentFeeAssignment[]> {
    return await db.select().from(studentFeeAssignments).where(and(
      eq(studentFeeAssignments.schoolId, schoolId),
      academicSessionId ? eq(studentFeeAssignments.academicSessionId, academicSessionId) : undefined
    ));
  }

  async getStudentFeeAssignment(id: string): Promise<StudentFeeAssignment | undefined> {
    const [assignment] = await db.select().from(studentFeeAssignments).where(eq(studentFeeAssignments.id, id));
    return assignment;
  }

  async getStudentFeeAssignmentByStudent(studentId: string, academicSessionId: string): Promise<StudentFeeAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(studentFeeAssignments)
      .where(and(
        eq(studentFeeAssignments.studentId, studentId),
        eq(studentFeeAssignments.academicSessionId, academicSessionId),
        eq(studentFeeAssignments.isActive, true)
      ));
    return assignment;
  }

  async createStudentFeeAssignment(assignment: InsertStudentFeeAssignment): Promise<StudentFeeAssignment> {
    const [created] = await db.insert(studentFeeAssignments).values(assignment).returning();
    return created;
  }

  async updateStudentFeeAssignment(id: string, assignment: Partial<InsertStudentFeeAssignment>): Promise<StudentFeeAssignment> {
    const [updated] = await db
      .update(studentFeeAssignments)
      .set({ ...assignment, updatedAt: new Date() })
      .where(eq(studentFeeAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteStudentFeeAssignment(id: string): Promise<void> {
    await db.delete(studentFeeAssignments).where(eq(studentFeeAssignments.id, id));
  }

  async assignFeeStructureToStudent(studentId: string, feeStructureId: string, academicSessionId: string, assignedBy: string, discountPercentage = 0, discountAmount = 0, discountReason?: string): Promise<StudentFeeAssignment> {
    // Get student to determine school
    const student = await this.getStudent(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Check if assignment already exists
    const existing = await this.getStudentFeeAssignmentByStudent(studentId, academicSessionId);
    if (existing) {
      throw new Error('Student already has fee assignment for this academic session');
    }

    const assignment: InsertStudentFeeAssignment = {
      studentId,
      feeStructureId,
      academicSessionId,
      schoolId: student.schoolId,
      discountPercentage,
      discountAmount,
      discountReason,
      assignedBy
    };

    return await this.createStudentFeeAssignment(assignment);
  }

  // Fee Invoices operations
  async getFeeInvoices(schoolId: string, academicSessionId?: string): Promise<any[]> {
    let query = db
      .select({
        id: feeInvoices.id,
        invoiceNumber: feeInvoices.invoiceNumber,
        studentId: feeInvoices.studentId,
        studentName: sql<string>`CONCAT(${students.firstName}, ' ', ${students.lastName})`,
        studentAdmissionNumber: students.admissionNumber,
        academicSessionId: feeInvoices.academicSessionId,
        schoolId: feeInvoices.schoolId,
        totalAmount: feeInvoices.totalAmount,
        discountAmount: feeInvoices.discountAmount,
        netAmount: feeInvoices.netAmount,
        paidAmount: feeInvoices.paidAmount,
        balanceAmount: feeInvoices.balanceAmount,
        dueDate: feeInvoices.dueDate,
        status: feeInvoices.status,
        generatedAt: feeInvoices.createdAt,
        createdAt: feeInvoices.createdAt,
        updatedAt: feeInvoices.updatedAt,
      })
      .from(feeInvoices)
      .leftJoin(students, eq(feeInvoices.studentId, students.id))
      .where(and(
        eq(feeInvoices.schoolId, schoolId),
        academicSessionId ? eq(feeInvoices.academicSessionId, academicSessionId) : undefined
      ));

    return await query;
  }

  async getFeeInvoice(id: string): Promise<FeeInvoice | undefined> {
    const [invoice] = await db.select().from(feeInvoices).where(eq(feeInvoices.id, id));
    return invoice;
  }

  async getFeeInvoicesByStudent(studentId: string, academicSessionId: string): Promise<FeeInvoice[]> {
    return await db
      .select()
      .from(feeInvoices)
      .where(and(
        eq(feeInvoices.studentId, studentId),
        eq(feeInvoices.academicSessionId, academicSessionId)
      ));
  }

  async createFeeInvoice(invoice: InsertFeeInvoice): Promise<FeeInvoice> {
    const [created] = await db.insert(feeInvoices).values(invoice).returning();
    return created;
  }

  async updateFeeInvoice(id: string, invoice: Partial<InsertFeeInvoice>): Promise<FeeInvoice> {
    const [updated] = await db
      .update(feeInvoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(feeInvoices.id, id))
      .returning();
    return updated;
  }

  async deleteFeeInvoice(id: string): Promise<void> {
    await db.delete(feeInvoices).where(eq(feeInvoices.id, id));
  }

  async generateInvoiceForStudent(studentId: string, academicSessionId: string, generatedBy: string): Promise<FeeInvoice> {
    // Get student and their fee assignment
    const student = await this.getStudent(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    const feeAssignment = await this.getStudentFeeAssignmentByStudent(studentId, academicSessionId);
    if (!feeAssignment) {
      throw new Error('No fee assignment found for student');
    }

    // Check if invoice already exists for this student, fee structure, and academic session
    const existingInvoices = await db
      .select()
      .from(feeInvoices)
      .where(and(
        eq(feeInvoices.studentId, studentId),
        eq(feeInvoices.academicSessionId, academicSessionId)
      ));
    
    if (existingInvoices.length > 0) {
      throw new Error(`Invoice already exists for this student in this academic session`);
    }

    // Get fee structure and items
    const feeStructure = await this.getFeeStructure(feeAssignment.feeStructureId);
    if (!feeStructure) {
      throw new Error('Fee structure not found');
    }

    const feeItems = await this.getFeeStructureItems(feeStructure.id);

    console.log('[INVOICE GEN] Fee items count:', feeItems.length);
    console.log('[INVOICE GEN] Fee items:', feeItems.map(i => ({ amount: i.amount })));

    // Calculate total amount
    let totalAmount = 0;
    for (const item of feeItems) {
      const itemAmount = item.amount || 0;
      console.log('[INVOICE GEN] Item calculation:', item.amount, '=', itemAmount);
      totalAmount += itemAmount;
    }

    console.log('[INVOICE GEN] Total amount:', totalAmount);
    console.log('[INVOICE GEN] Discount percentage:', feeAssignment.discountPercentage);
    console.log('[INVOICE GEN] Discount amount:', feeAssignment.discountAmount);

    // Apply discounts - handle undefined/null values
    const percentageDiscount = Math.floor((totalAmount * (feeAssignment.discountPercentage || 0)) / 100);
    const discountAmount = (feeAssignment.discountAmount || 0) + percentageDiscount;
    const netAmount = totalAmount - discountAmount;

    console.log('[INVOICE GEN] Calculated values - total:', totalAmount, 'discount:', discountAmount, 'net:', netAmount);

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${studentId.slice(-4)}`;

    // Create invoice
    const invoice: InsertFeeInvoice = {
      invoiceNumber,
      studentId,
      academicSessionId,
      schoolId: student.schoolId,
      totalAmount,
      discountAmount,
      netAmount,
      balanceAmount: netAmount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      generatedBy
    };

    const createdInvoice = await this.createFeeInvoice(invoice);

    // Create invoice items
    for (const item of feeItems) {
      const feeType = await this.getFeeType(item.feeTypeId);
      await this.createFeeInvoiceItem({
        invoiceId: createdInvoice.id,
        feeTypeId: item.feeTypeId,
        description: feeType?.name || 'Fee',
        amount: item.amount,
        quantity: 1,
        discountAmount: 0,
        netAmount: item.amount
      });
    }

    return createdInvoice;
  }

  async updateInvoiceStatus(invoiceId: string, status: string): Promise<FeeInvoice> {
    return await this.updateFeeInvoice(invoiceId, { status });
  }

  // Fee Invoice Items operations
  async getFeeInvoiceItems(invoiceId: string): Promise<FeeInvoiceItem[]> {
    return await db.select().from(feeInvoiceItems).where(eq(feeInvoiceItems.invoiceId, invoiceId));
  }

  async getFeeInvoiceItem(id: string): Promise<FeeInvoiceItem | undefined> {
    const [item] = await db.select().from(feeInvoiceItems).where(eq(feeInvoiceItems.id, id));
    return item;
  }

  async createFeeInvoiceItem(invoiceItem: InsertFeeInvoiceItem): Promise<FeeInvoiceItem> {
    const [created] = await db.insert(feeInvoiceItems).values(invoiceItem).returning();
    return created;
  }

  async updateFeeInvoiceItem(id: string, invoiceItem: Partial<InsertFeeInvoiceItem>): Promise<FeeInvoiceItem> {
    const [updated] = await db
      .update(feeInvoiceItems)
      .set({ ...invoiceItem, updatedAt: new Date() })
      .where(eq(feeInvoiceItems.id, id))
      .returning();
    return updated;
  }

  async deleteFeeInvoiceItem(id: string): Promise<void> {
    await db.delete(feeInvoiceItems).where(eq(feeInvoiceItems.id, id));
  }

  // Fee Payments operations
  async getFeePayments(schoolId: string): Promise<FeePayment[]> {
    const payments = await db
      .select()
      .from(feePayments)
      .where(eq(feePayments.schoolId, schoolId))
      .orderBy(desc(feePayments.paymentDate));
    
    if (payments.length === 0) {
      return [];
    }
    
    // Batch fetch invoices and students
    const invoiceIds = [...new Set(payments.map(p => p.invoiceId).filter(Boolean))];
    const studentIds = [...new Set(payments.map(p => p.studentId).filter(Boolean))];
    
    const invoices = invoiceIds.length > 0
      ? await db.select().from(feeInvoices).where(inArray(feeInvoices.id, invoiceIds as string[]))
      : [];
    const studentsData = studentIds.length > 0
      ? await db.select().from(students).where(inArray(students.id, studentIds as string[]))
      : [];
    
    // Create lookup maps
    const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));
    const studentMap = new Map(studentsData.map(stu => [stu.id, stu]));
    
    // Enrich payments with invoice and student data
    const enrichedPayments = payments.map(payment => {
      const student = payment.studentId ? studentMap.get(payment.studentId) : null;
      const studentName = student 
        ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || null
        : null;
      
      return {
        ...payment,
        invoiceNumber: payment.invoiceId ? (invoiceMap.get(payment.invoiceId)?.invoiceNumber || null) : null,
        studentName,
        studentAdmissionNumber: student?.admissionNumber || null,
      };
    });
    
    return enrichedPayments as any;
  }

  async getFeePayment(id: string): Promise<FeePayment | undefined> {
    const [payment] = await db.select().from(feePayments).where(eq(feePayments.id, id));
    return payment;
  }

  async getFeePaymentsByInvoice(invoiceId: string): Promise<FeePayment[]> {
    return await db.select().from(feePayments).where(eq(feePayments.invoiceId, invoiceId));
  }

  async getFeePaymentsByStudent(studentId: string): Promise<FeePayment[]> {
    return await db.select().from(feePayments).where(eq(feePayments.studentId, studentId));
  }

  async createFeePayment(payment: InsertFeePayment): Promise<FeePayment> {
    const [created] = await db.insert(feePayments).values(payment).returning();
    return created;
  }

  async updateFeePayment(id: string, payment: Partial<InsertFeePayment>): Promise<FeePayment> {
    const [updated] = await db
      .update(feePayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(feePayments.id, id))
      .returning();
    return updated;
  }

  async deleteFeePayment(id: string): Promise<void> {
    await db.delete(feePayments).where(eq(feePayments.id, id));
  }

  async recordPayment(invoiceId: string, amount: number, paymentMethod: string, paymentMode: string, collectedBy: string, paymentDate: string, transactionId?: string, referenceNumber?: string, bankName?: string, notes?: string): Promise<FeePayment> {
    // Get invoice
    const invoice = await this.getFeeInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Generate payment number
    const paymentNumber = `PAY-${Date.now()}-${invoice.studentId.slice(-4)}`;

    // Create payment
    const payment: InsertFeePayment = {
      paymentNumber,
      invoiceId,
      studentId: invoice.studentId,
      schoolId: invoice.schoolId,
      amount,
      paymentMethod,
      paymentMode,
      transactionId,
      referenceNumber,
      bankName,
      paymentDate,
      notes,
      collectedBy
    };

    const createdPayment = await this.createFeePayment(payment);

    // Update invoice paid amount and status
    const newPaidAmount = invoice.paidAmount + amount;
    const newBalanceAmount = invoice.netAmount - newPaidAmount;
    const newStatus = newBalanceAmount <= 0 ? 'paid' : 'partial';

    await this.updateFeeInvoice(invoiceId, {
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      status: newStatus
    });

    return createdPayment;
  }

  // Fee Notifications operations
  async getFeeNotifications(schoolId: string): Promise<FeeNotification[]> {
    return await db.select().from(feeNotifications).where(eq(feeNotifications.schoolId, schoolId));
  }

  async getFeeNotification(id: string): Promise<FeeNotification | undefined> {
    const [notification] = await db.select().from(feeNotifications).where(eq(feeNotifications.id, id));
    return notification;
  }

  async getFeeNotificationsByStudent(studentId: string): Promise<FeeNotification[]> {
    return await db.select().from(feeNotifications).where(eq(feeNotifications.studentId, studentId));
  }

  async createFeeNotification(notification: InsertFeeNotification): Promise<FeeNotification> {
    const [created] = await db.insert(feeNotifications).values(notification).returning();
    return created;
  }

  async updateFeeNotification(id: string, notification: Partial<InsertFeeNotification>): Promise<FeeNotification> {
    const [updated] = await db
      .update(feeNotifications)
      .set({ ...notification, updatedAt: new Date() })
      .where(eq(feeNotifications.id, id))
      .returning();
    return updated;
  }

  async deleteFeeNotification(id: string): Promise<void> {
    await db.delete(feeNotifications).where(eq(feeNotifications.id, id));
  }

  async createDueReminder(invoiceId: string, studentId: string, schoolId: string): Promise<FeeNotification> {
    const invoice = await this.getFeeInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const student = await this.getStudent(studentId);
    const message = `Fee payment reminder: Your fee payment of ₹${(invoice.balanceAmount / 100).toFixed(2)} is due on ${invoice.dueDate}. Please make the payment to avoid late fees.`;

    const notification: InsertFeeNotification = {
      invoiceId,
      studentId,
      schoolId,
      notificationType: 'due_reminder',
      message,
      recipientEmail: student?.email || undefined,
      recipientPhone: student?.contactNumber || undefined
    };

    return await this.createFeeNotification(notification);
  }

  async createOverdueAlert(invoiceId: string, studentId: string, schoolId: string): Promise<FeeNotification> {
    const invoice = await this.getFeeInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const student = await this.getStudent(studentId);
    const message = `OVERDUE: Your fee payment of ₹${(invoice.balanceAmount / 100).toFixed(2)} was due on ${invoice.dueDate}. Please make immediate payment to avoid additional late fees.`;

    const notification: InsertFeeNotification = {
      invoiceId,
      studentId,
      schoolId,
      notificationType: 'overdue_alert',
      message,
      recipientEmail: student?.email || undefined,
      recipientPhone: student?.contactNumber || undefined
    };

    return await this.createFeeNotification(notification);
  }

  // ============================================================================
  // TRANSPORT MANAGEMENT IMPLEMENTATIONS
  // ============================================================================

  // Transport Routes operations
  async getTransportRoutes(schoolId: string): Promise<TransportRoute[]> {
    return await db.select().from(transportRoutes).where(eq(transportRoutes.schoolId, schoolId));
  }

  async getTransportRoute(id: string): Promise<TransportRoute | undefined> {
    const [route] = await db.select().from(transportRoutes).where(eq(transportRoutes.id, id));
    return route;
  }

  async createTransportRoute(route: InsertTransportRoute): Promise<TransportRoute> {
    const [created] = await db.insert(transportRoutes).values(route).returning();
    return created;
  }

  async updateTransportRoute(id: string, route: Partial<InsertTransportRoute>): Promise<TransportRoute> {
    const [updated] = await db
      .update(transportRoutes)
      .set({ ...route, updatedAt: new Date() })
      .where(eq(transportRoutes.id, id))
      .returning();
    return updated;
  }

  async deleteTransportRoute(id: string): Promise<void> {
    await db.delete(transportRoutes).where(eq(transportRoutes.id, id));
  }

  // Transport Stops operations
  async getTransportStops(routeId: string): Promise<TransportStop[]> {
    return await db
      .select()
      .from(transportStops)
      .where(eq(transportStops.routeId, routeId))
      .orderBy(asc(transportStops.stopOrder));
  }

  async getTransportStop(id: string): Promise<TransportStop | undefined> {
    const [stop] = await db.select().from(transportStops).where(eq(transportStops.id, id));
    return stop;
  }

  async createTransportStop(stop: InsertTransportStop): Promise<TransportStop> {
    const [created] = await db.insert(transportStops).values(stop).returning();
    return created;
  }

  async updateTransportStop(id: string, stop: Partial<InsertTransportStop>): Promise<TransportStop> {
    const [updated] = await db
      .update(transportStops)
      .set({ ...stop, updatedAt: new Date() })
      .where(eq(transportStops.id, id))
      .returning();
    return updated;
  }

  async deleteTransportStop(id: string): Promise<void> {
    await db.delete(transportStops).where(eq(transportStops.id, id));
  }

  // Transport Vehicles operations
  async getTransportVehicles(schoolId: string): Promise<TransportVehicle[]> {
    return await db.select().from(transportVehicles).where(eq(transportVehicles.schoolId, schoolId));
  }

  async getTransportVehicle(id: string): Promise<TransportVehicle | undefined> {
    const [vehicle] = await db.select().from(transportVehicles).where(eq(transportVehicles.id, id));
    return vehicle;
  }

  async createTransportVehicle(vehicle: InsertTransportVehicle): Promise<TransportVehicle> {
    const [created] = await db.insert(transportVehicles).values(vehicle).returning();
    return created;
  }

  async updateTransportVehicle(id: string, vehicle: Partial<InsertTransportVehicle>): Promise<TransportVehicle> {
    const [updated] = await db
      .update(transportVehicles)
      .set({ ...vehicle, updatedAt: new Date() })
      .where(eq(transportVehicles.id, id))
      .returning();
    return updated;
  }

  async deleteTransportVehicle(id: string): Promise<void> {
    await db.delete(transportVehicles).where(eq(transportVehicles.id, id));
  }

  // Transport Route Assignments operations
  async getTransportRouteAssignments(schoolId: string, academicSessionId?: string): Promise<TransportRouteAssignment[]> {
    return await db.select().from(transportRouteAssignments).where(and(
      eq(transportRouteAssignments.schoolId, schoolId),
      academicSessionId ? eq(transportRouteAssignments.academicSessionId, academicSessionId) : undefined
    ));
  }

  async getTransportRouteAssignment(id: string): Promise<TransportRouteAssignment | undefined> {
    const [assignment] = await db.select().from(transportRouteAssignments).where(eq(transportRouteAssignments.id, id));
    return assignment;
  }

  async createTransportRouteAssignment(assignment: InsertTransportRouteAssignment): Promise<TransportRouteAssignment> {
    const [created] = await db.insert(transportRouteAssignments).values(assignment).returning();
    return created;
  }

  async updateTransportRouteAssignment(id: string, assignment: Partial<InsertTransportRouteAssignment>): Promise<TransportRouteAssignment> {
    const [updated] = await db
      .update(transportRouteAssignments)
      .set({ ...assignment, updatedAt: new Date() })
      .where(eq(transportRouteAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteTransportRouteAssignment(id: string): Promise<void> {
    await db.delete(transportRouteAssignments).where(eq(transportRouteAssignments.id, id));
  }

  // Transport Student Assignments operations
  async getTransportStudentAssignments(schoolId: string, academicSessionId?: string): Promise<TransportStudentAssignment[]> {
    return await db.select().from(transportStudentAssignments).where(and(
      eq(transportStudentAssignments.schoolId, schoolId),
      academicSessionId ? eq(transportStudentAssignments.academicSessionId, academicSessionId) : undefined
    ));
  }

  async getTransportStudentAssignment(id: string): Promise<TransportStudentAssignment | undefined> {
    const [assignment] = await db.select().from(transportStudentAssignments).where(eq(transportStudentAssignments.id, id));
    return assignment;
  }

  async getTransportStudentAssignmentsByStudent(studentId: string, academicSessionId: string): Promise<TransportStudentAssignment[]> {
    return await db
      .select()
      .from(transportStudentAssignments)
      .where(and(
        eq(transportStudentAssignments.studentId, studentId),
        eq(transportStudentAssignments.academicSessionId, academicSessionId),
        eq(transportStudentAssignments.isActive, true)
      ));
  }

  async createTransportStudentAssignment(assignment: InsertTransportStudentAssignment): Promise<TransportStudentAssignment> {
    const [created] = await db.insert(transportStudentAssignments).values(assignment).returning();
    return created;
  }

  async updateTransportStudentAssignment(id: string, assignment: Partial<InsertTransportStudentAssignment>): Promise<TransportStudentAssignment> {
    const [updated] = await db
      .update(transportStudentAssignments)
      .set({ ...assignment, updatedAt: new Date() })
      .where(eq(transportStudentAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteTransportStudentAssignment(id: string): Promise<void> {
    await db.delete(transportStudentAssignments).where(eq(transportStudentAssignments.id, id));
  }

  async assignStudentToRoute(studentId: string, routeId: string, stopId: string, academicSessionId: string, assignedBy: string, transportType = 'both', monthlyFee?: number): Promise<TransportStudentAssignment> {
    // Get student to determine school
    const student = await this.getStudent(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Get route to get fee if not provided
    const route = await this.getTransportRoute(routeId);
    if (!route) {
      throw new Error('Transport route not found');
    }

    const assignment: InsertTransportStudentAssignment = {
      studentId,
      routeId,
      stopId,
      academicSessionId,
      schoolId: student.schoolId,
      assignedFrom: new Date().toISOString().split('T')[0],
      transportType,
      monthlyFee: monthlyFee || route.monthlyFee,
      assignedBy
    };

    return await this.createTransportStudentAssignment(assignment);
  }

  // Fee and Transport Integration operations
  async getFeeInvoiceWithTransportFees(studentId: string, academicSessionId: string): Promise<FeeInvoice | undefined> {
    const invoices = await this.getFeeInvoicesByStudent(studentId, academicSessionId);
    // Return the latest invoice that might include transport fees
    return invoices.length > 0 ? invoices[invoices.length - 1] : undefined;
  }

  async updateInvoiceWithTransportFees(invoiceId: string, transportFees: number): Promise<FeeInvoice> {
    const invoice = await this.getFeeInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newTotalAmount = invoice.totalAmount + transportFees;
    const newNetAmount = newTotalAmount - invoice.discountAmount;
    const newBalanceAmount = newNetAmount - invoice.paidAmount;

    return await this.updateFeeInvoice(invoiceId, {
      totalAmount: newTotalAmount,
      netAmount: newNetAmount,
      balanceAmount: newBalanceAmount
    });
  }

  // ============================================================================
  // MESSAGE OPERATIONS IMPLEMENTATION
  // ============================================================================

  async sendMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getConversationMessages(schoolId: string, senderType: string, senderId: string, receiverType: string, receiverId: string, limit = 50, offset = 0): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.schoolId, schoolId),
        or(
          and(
            eq(messages.senderType, senderType),
            eq(messages.senderId, senderId),
            eq(messages.receiverType, receiverType),
            eq(messages.receiverId, receiverId)
          ),
          and(
            eq(messages.senderType, receiverType),
            eq(messages.senderId, receiverId),
            eq(messages.receiverType, senderType),
            eq(messages.receiverId, senderId)
          )
        )
      ))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadMessagesCount(schoolId: string, receiverType: string, receiverId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(messages)
      .where(and(
        eq(messages.schoolId, schoolId),
        eq(messages.receiverType, receiverType),
        eq(messages.receiverId, receiverId),
        eq(messages.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  async markMessageAsRead(messageId: string, receiverType: string, receiverId: string): Promise<Message> {
    const [updated] = await db
      .update(messages)
      .set({ isRead: true, updatedAt: new Date() })
      .where(and(
        eq(messages.id, messageId),
        eq(messages.receiverType, receiverType),
        eq(messages.receiverId, receiverId)
      ))
      .returning();
    return updated;
  }

  async markConversationAsRead(schoolId: string, senderType: string, senderId: string, receiverType: string, receiverId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true, updatedAt: new Date() })
      .where(and(
        eq(messages.schoolId, schoolId),
        eq(messages.senderType, senderType),
        eq(messages.senderId, senderId),
        eq(messages.receiverType, receiverType),
        eq(messages.receiverId, receiverId)
      ));
  }

  async deleteConversation(schoolId: string, currentUserType: string, currentUserId: string, otherUserType: string, otherUserId: string): Promise<void> {
    await db
      .delete(messages)
      .where(and(
        eq(messages.schoolId, schoolId),
        or(
          and(
            eq(messages.senderType, currentUserType),
            eq(messages.senderId, currentUserId),
            eq(messages.receiverType, otherUserType),
            eq(messages.receiverId, otherUserId)
          ),
          and(
            eq(messages.senderType, otherUserType),
            eq(messages.senderId, otherUserId),
            eq(messages.receiverType, currentUserType),
            eq(messages.receiverId, currentUserId)
          )
        )
      ));
  }

  async getConversationsList(schoolId: string, userType: string, userId: string): Promise<any[]> {
    // Use a simpler approach to avoid GROUP BY errors
    const conversationsQuery = sql`
      WITH unique_conversations AS (
        SELECT DISTINCT
          CASE 
            WHEN (sender_type = ${userType} AND sender_id = ${userId}) 
            THEN receiver_type || ':' || receiver_id
            ELSE sender_type || ':' || sender_id
          END as other_user_key,
          CASE 
            WHEN (sender_type = ${userType} AND sender_id = ${userId}) 
            THEN receiver_type
            ELSE sender_type
          END as other_user_type,
          CASE 
            WHEN (sender_type = ${userType} AND sender_id = ${userId}) 
            THEN receiver_id
            ELSE sender_id
          END as other_user_id
        FROM messages 
        WHERE school_id = ${schoolId}
        AND ((sender_type = ${userType} AND sender_id = ${userId}) OR (receiver_type = ${userType} AND receiver_id = ${userId}))
      ),
      latest_messages AS (
        SELECT 
          uc.other_user_type,
          uc.other_user_id,
          (
            SELECT content 
            FROM messages m 
            WHERE m.school_id = ${schoolId}
            AND (
              (m.sender_type = ${userType} AND m.sender_id = ${userId} AND m.receiver_type = uc.other_user_type AND m.receiver_id = uc.other_user_id)
              OR 
              (m.receiver_type = ${userType} AND m.receiver_id = ${userId} AND m.sender_type = uc.other_user_type AND m.sender_id = uc.other_user_id)
            )
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as last_message_content,
          (
            SELECT created_at 
            FROM messages m 
            WHERE m.school_id = ${schoolId}
            AND (
              (m.sender_type = ${userType} AND m.sender_id = ${userId} AND m.receiver_type = uc.other_user_type AND m.receiver_id = uc.other_user_id)
              OR 
              (m.receiver_type = ${userType} AND m.receiver_id = ${userId} AND m.sender_type = uc.other_user_type AND m.sender_id = uc.other_user_id)
            )
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as last_message_time,
          (
            SELECT COUNT(*) 
            FROM messages m 
            WHERE m.school_id = ${schoolId}
            AND m.receiver_type = ${userType} 
            AND m.receiver_id = ${userId}
            AND m.sender_type = uc.other_user_type
            AND m.sender_id = uc.other_user_id
            AND m.is_read = false
          ) as unread_count,
          (
            SELECT CASE WHEN (sender_type = ${userType} AND sender_id = ${userId}) THEN true ELSE false END
            FROM messages m 
            WHERE m.school_id = ${schoolId}
            AND (
              (m.sender_type = ${userType} AND m.sender_id = ${userId} AND m.receiver_type = uc.other_user_type AND m.receiver_id = uc.other_user_id)
              OR 
              (m.receiver_type = ${userType} AND m.receiver_id = ${userId} AND m.sender_type = uc.other_user_type AND m.sender_id = uc.other_user_id)
            )
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as is_last_message_from_me
        FROM unique_conversations uc
      )
      SELECT * FROM latest_messages
      ORDER BY last_message_time DESC
    `;

    const result = await db.execute(conversationsQuery);
    const conversations = result.rows || [];

    // Get user details for each conversation
    const conversationsWithUsers = [];
    for (const conv of conversations) {
      let otherUser;
      if (conv.other_user_type === 'teacher') {
        const teacherData = await db
          .select({
            id: teachers.id,
            name: teachers.name,
            email: teachers.email
          })
          .from(teachers)
          .where(eq(teachers.id, conv.other_user_id))
          .limit(1);
        
        if (teacherData.length > 0) {
          otherUser = {
            id: teacherData[0].id,
            name: teacherData[0].name,
            role: 'teacher',
            email: teacherData[0].email
          };
        }
      } else if (conv.other_user_type === 'student') {
        const studentData = await db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
            email: students.email
          })
          .from(students)
          .where(eq(students.id, conv.other_user_id))
          .limit(1);
        
        if (studentData.length > 0) {
          otherUser = {
            id: studentData[0].id,
            name: `${studentData[0].firstName || ''} ${studentData[0].lastName || ''}`.trim() || 'Unknown Student',
            role: 'student',
            email: studentData[0].email
          };
        }
      } else if (conv.other_user_type === 'parent') {
        const parentData = await db
          .select({
            id: parents.id,
            firstName: parents.firstName,
            lastName: parents.lastName,
            email: parents.email
          })
          .from(parents)
          .where(eq(parents.id, conv.other_user_id))
          .limit(1);
        
        if (parentData.length > 0) {
          otherUser = {
            id: parentData[0].id,
            name: `${parentData[0].firstName || ''} ${parentData[0].lastName || ''}`.trim() || 'Unknown Parent',
            role: 'parent',
            email: parentData[0].email
          };
        }
      } else if (conv.other_user_type === 'admin') {
        const adminData = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email
          })
          .from(users)
          .where(eq(users.id, conv.other_user_id))
          .limit(1);
        
        if (adminData.length > 0) {
          otherUser = {
            id: adminData[0].id,
            name: `${adminData[0].firstName || ''} ${adminData[0].lastName || ''}`.trim() || 'Unknown Admin',
            role: 'admin',
            email: adminData[0].email
          };
        }
      }

      if (otherUser) {
        conversationsWithUsers.push({
          otherUserId: otherUser.id,
          otherUserName: otherUser.name,
          otherUserRole: otherUser.role,
          otherUserProfilePicture: null,
          lastMessage: conv.last_message_content || '',
          lastMessageTime: conv.last_message_time || new Date().toISOString(),
          unreadCount: parseInt(conv.unread_count) || 0,
          isLastMessageFromMe: conv.is_last_message_from_me || false
        });
      }
    }

    return conversationsWithUsers;
  }

  async getUsersAllowedToMessage(schoolId: string, currentUserId: string, currentUserRole: string): Promise<User[]> {
    const allowedUsers: User[] = [];

    // Role-based permissions:
    // Teachers → all users (students, teachers, parents, admin)
    // Students → teachers, students, admin
    // Parents → teachers, admin only
    // Admin → all users

    // Get all teachers from this school (all roles can message teachers)
    const teachersData = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        email: teachers.email,
        schoolId: teachers.schoolId,
        isActive: teachers.isActive
      })
      .from(teachers)
      .where(and(
        eq(teachers.schoolId, schoolId),
        eq(teachers.isActive, true)
      ))
      .orderBy(teachers.name);

    // Add teachers to allowed users
    for (const teacher of teachersData) {
      allowedUsers.push({
        id: teacher.id,
        name: teacher.name || 'Unknown Teacher',
        role: 'teacher' as const,
        email: teacher.email,
        firstName: null,
        lastName: null,
        loginId: null,
        schoolId: teacher.schoolId,
        isActive: teacher.isActive,
        studentId: null,
        teacherId: null
      });
    }

    // Get all students from this school (teachers, students, admin can message students)
    if (currentUserRole === 'teacher' || currentUserRole === 'student' || currentUserRole === 'admin') {
      const studentsData = await db
        .select({
          id: students.id,
          firstName: students.firstName,
          lastName: students.lastName,
          email: students.email,
          schoolId: students.schoolId,
          isActive: students.isActive,
          classId: students.classId,
          grade: classes.grade,
          section: classes.section
        })
        .from(students)
        .leftJoin(classes, eq(students.classId, classes.id))
        .where(and(
          eq(students.schoolId, schoolId),
          eq(students.isActive, true)
        ))
        .orderBy(students.firstName, students.lastName);

      // Add students to allowed users
      for (const student of studentsData) {
        const displayName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
        allowedUsers.push({
          id: student.id,
          name: displayName,
          role: 'student' as const,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          loginId: null,
          schoolId: student.schoolId,
          isActive: student.isActive,
          studentId: student.id,
          teacherId: null,
          class: student.grade,
          section: student.section
        });
      }
    }

    // Get all parents from this school (teachers, admin can message parents)
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
      const parentsData = await db
        .select({
          id: parents.id,
          firstName: parents.firstName,
          lastName: parents.lastName,
          email: parents.email,
          schoolId: parents.schoolId,
          isActive: parents.isActive
        })
        .from(parents)
        .where(and(
          eq(parents.schoolId, schoolId),
          eq(parents.isActive, true)
        ))
        .orderBy(parents.firstName, parents.lastName);

      // Add parents to allowed users
      for (const parent of parentsData) {
        const displayName = `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Unknown Parent';
        allowedUsers.push({
          id: parent.id,
          name: displayName,
          role: 'parent' as const,
          email: parent.email,
          firstName: parent.firstName,
          lastName: parent.lastName,
          loginId: null,
          schoolId: parent.schoolId,
          isActive: parent.isActive,
          studentId: null,
          teacherId: null
        });
      }
    }

    // Get all admins from this school (all roles can message admins)
    const adminsData = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        schoolId: users.schoolId,
        isActive: users.isActive,
        role: users.role
      })
      .from(users)
      .where(and(
        eq(users.schoolId, schoolId),
        eq(users.isActive, true),
        or(eq(users.role, 'admin'), eq(users.role, 'super_admin'))
      ))
      .orderBy(users.firstName, users.lastName);

    // Add admins to allowed users
    for (const admin of adminsData) {
      const displayName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Unknown Admin';
      allowedUsers.push({
        id: admin.id,
        name: displayName,
        role: 'admin' as const,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        loginId: null,
        schoolId: admin.schoolId,
        isActive: admin.isActive,
        studentId: null,
        teacherId: null
      });
    }

    // Sort by name and return
    return allowedUsers.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ===== NOTIFICATION OPERATIONS =====
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return result;
  }

  async getNotifications(recipientId: string, recipientRole: string, limit: number = 20, offset: number = 0): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.recipientRole, recipientRole)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadNotificationsCount(recipientId: string, recipientRole: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.recipientRole, recipientRole),
        eq(notifications.isRead, false)
      ));
    return Number(result[0]?.count || 0);
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification> {
    const [result] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, notificationId))
      .returning();
    return result;
  }

  async markAllNotificationsAsRead(recipientId: string, recipientRole: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.recipientRole, recipientRole),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await db
      .delete(notifications)
      .where(eq(notifications.id, notificationId));
  }

  // ===== INCREMENTAL CHANGE REQUEST OPERATIONS =====
  
  async getIncrementalChangeRequests(schoolId: string, status?: string): Promise<IncrementalChangeRequest[]> {
    const conditions = [eq(incrementalChangeRequests.schoolId, schoolId)];
    if (status) {
      conditions.push(eq(incrementalChangeRequests.status, status as any));
    }
    
    return await db
      .select()
      .from(incrementalChangeRequests)
      .where(and(...conditions))
      .orderBy(incrementalChangeRequests.createdAt);
  }

  async getIncrementalChangeRequest(id: string): Promise<IncrementalChangeRequest | undefined> {
    const results = await db
      .select()
      .from(incrementalChangeRequests)
      .where(eq(incrementalChangeRequests.id, id))
      .limit(1);
    return results[0];
  }

  async createIncrementalChangeRequest(request: InsertIncrementalChangeRequest): Promise<IncrementalChangeRequest> {
    const [result] = await db
      .insert(incrementalChangeRequests)
      .values(request)
      .returning();
    return result;
  }

  async updateIncrementalChangeRequest(id: string, request: Partial<InsertIncrementalChangeRequest>): Promise<IncrementalChangeRequest> {
    const [result] = await db
      .update(incrementalChangeRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(incrementalChangeRequests.id, id))
      .returning();
    return result;
  }

  async deleteIncrementalChangeRequest(id: string): Promise<void> {
    await db
      .delete(incrementalChangeRequests)
      .where(eq(incrementalChangeRequests.id, id));
  }

  // ===== CONFLICT DETECTION RESULT OPERATIONS =====
  
  async getConflictDetectionResults(changeRequestId: string): Promise<ConflictDetectionResult[]> {
    return await db
      .select()
      .from(conflictDetectionResults)
      .where(eq(conflictDetectionResults.changeRequestId, changeRequestId))
      .orderBy(conflictDetectionResults.severity, conflictDetectionResults.createdAt);
  }

  async getConflictDetectionResult(id: string): Promise<ConflictDetectionResult | undefined> {
    const results = await db
      .select()
      .from(conflictDetectionResults)
      .where(eq(conflictDetectionResults.id, id))
      .limit(1);
    return results[0];
  }

  async createConflictDetectionResult(result: InsertConflictDetectionResult): Promise<ConflictDetectionResult> {
    const [createdResult] = await db
      .insert(conflictDetectionResults)
      .values(result)
      .returning();
    return createdResult;
  }

  async updateConflictDetectionResult(id: string, result: Partial<InsertConflictDetectionResult>): Promise<ConflictDetectionResult> {
    const [updatedResult] = await db
      .update(conflictDetectionResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(conflictDetectionResults.id, id))
      .returning();
    return updatedResult;
  }

  async deleteConflictDetectionResult(id: string): Promise<void> {
    await db
      .delete(conflictDetectionResults)
      .where(eq(conflictDetectionResults.id, id));
  }

  async deleteConflictDetectionResultsByRequest(changeRequestId: string): Promise<void> {
    await db
      .delete(conflictDetectionResults)
      .where(eq(conflictDetectionResults.changeRequestId, changeRequestId));
  }

  // ===== CHANGE IMPACT ANALYSIS OPERATIONS =====
  
  async getChangeImpactAnalysis(changeRequestId: string): Promise<ChangeImpactAnalysis | undefined> {
    const results = await db
      .select()
      .from(changeImpactAnalysis)
      .where(eq(changeImpactAnalysis.changeRequestId, changeRequestId))
      .limit(1);
    return results[0];
  }

  async createChangeImpactAnalysis(analysis: InsertChangeImpactAnalysis): Promise<ChangeImpactAnalysis> {
    const [result] = await db
      .insert(changeImpactAnalysis)
      .values(analysis)
      .returning();
    return result;
  }

  async updateChangeImpactAnalysis(id: string, analysis: Partial<InsertChangeImpactAnalysis>): Promise<ChangeImpactAnalysis> {
    const [result] = await db
      .update(changeImpactAnalysis)
      .set({ ...analysis, updatedAt: new Date() })
      .where(eq(changeImpactAnalysis.id, id))
      .returning();
    return result;
  }

  async deleteChangeImpactAnalysis(id: string): Promise<void> {
    await db
      .delete(changeImpactAnalysis)
      .where(eq(changeImpactAnalysis.id, id));
  }

  async deleteChangeImpactAnalysisByRequest(changeRequestId: string): Promise<void> {
    await db
      .delete(changeImpactAnalysis)
      .where(eq(changeImpactAnalysis.changeRequestId, changeRequestId));
  }

  // ===== ADDITIONAL HELPER METHODS FOR INCREMENTAL UPDATES =====
  
  async getClassSubjectAssignmentsBySubject(subjectId: string): Promise<ClassSubjectAssignment[]> {
    return await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.subjectId, subjectId));
  }

  async getClassSubjectAssignmentsByTeacher(teacherId: string): Promise<ClassSubjectAssignment[]> {
    return await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.assignedTeacherId, teacherId));
  }

  // ===== SCHOOL SETTINGS OPERATIONS =====
  
  async getSchoolSetting(schoolId: string, settingKey: string): Promise<SchoolSetting | undefined> {
    const [setting] = await db
      .select()
      .from(schoolSettings)
      .where(
        and(
          eq(schoolSettings.schoolId, schoolId),
          eq(schoolSettings.settingKey, settingKey),
          eq(schoolSettings.isActive, true)
        )
      );
    return setting;
  }

  async getSchoolSettings(schoolId: string, category?: string): Promise<SchoolSetting[]> {
    const conditions = [
      eq(schoolSettings.schoolId, schoolId),
      eq(schoolSettings.isActive, true)
    ];
    
    if (category) {
      conditions.push(eq(schoolSettings.category, category));
    }

    return await db
      .select()
      .from(schoolSettings)
      .where(and(...conditions))
      .orderBy(schoolSettings.category, schoolSettings.settingKey);
  }

  async createSchoolSetting(setting: InsertSchoolSetting): Promise<SchoolSetting> {
    const [created] = await db
      .insert(schoolSettings)
      .values(setting)
      .returning();
    return created;
  }

  async updateSchoolSetting(
    schoolId: string, 
    settingKey: string, 
    settingValue: any, 
    lastModifiedBy: string
  ): Promise<SchoolSetting> {
    // First try to update existing setting
    const [updated] = await db
      .update(schoolSettings)
      .set({ 
        settingValue, 
        lastModifiedBy, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(schoolSettings.schoolId, schoolId),
          eq(schoolSettings.settingKey, settingKey)
        )
      )
      .returning();

    // If no setting exists, create a new one
    if (!updated) {
      return await this.createSchoolSetting({
        schoolId,
        settingKey,
        settingValue,
        category: 'timetable', // Default category for timetable generation settings
        lastModifiedBy,
        description: `Auto-created setting for ${settingKey}`
      });
    }

    return updated;
  }

  async deleteSchoolSetting(schoolId: string, settingKey: string): Promise<void> {
    await db
      .delete(schoolSettings)
      .where(
        and(
          eq(schoolSettings.schoolId, schoolId),
          eq(schoolSettings.settingKey, settingKey)
        )
      );
  }

  // ===== CALENDAR EVENTS OPERATIONS =====

  async getCalendarEvents(schoolId: string, filters?: { month?: number; year?: number; eventType?: string }): Promise<CalendarEvent[]> {
    const conditions = [eq(calendarEvents.schoolId, schoolId)];
    
    if (filters?.eventType) {
      conditions.push(eq(calendarEvents.eventType, filters.eventType));
    }
    
    let query = db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startDate));
    
    const events = await query;
    
    // Filter by month and year if provided (in IST timezone)
    if (filters?.month !== undefined && filters?.year !== undefined) {
      return events.filter(event => {
        const utcDate = new Date(event.startDate);
        // Convert UTC to IST by adding 5 hours 30 minutes
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        return istDate.getUTCMonth() === filters.month && istDate.getUTCFullYear() === filters.year;
      });
    }
    
    return events;
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id));
    return event;
  }

  async getCalendarHolidays(schoolId: string): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.schoolId, schoolId),
          eq(calendarEvents.eventType, 'holiday')
        )
      )
      .orderBy(asc(calendarEvents.startDate));
  }

  async getUpcomingCalendarEvents(schoolId: string, days: number = 30): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.schoolId, schoolId),
          gte(calendarEvents.startDate, now),
          lte(calendarEvents.startDate, futureDate)
        )
      )
      .orderBy(asc(calendarEvents.startDate));
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [created] = await db
      .insert(calendarEvents)
      .values(event)
      .returning();
    return created;
  }

  async updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [updated] = await db
      .update(calendarEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.id, id));
  }

  // ============================================================================
  // ADMISSION MANAGEMENT OPERATIONS
  // ============================================================================

  async getAdmissionApplications(schoolId: string, filters?: { status?: string; classId?: string; sessionId?: string }): Promise<AdmissionApplication[]> {
    const conditions = [eq(admissionApplications.schoolId, schoolId)];
    
    if (filters?.status) {
      conditions.push(eq(admissionApplications.applicationStatus, filters.status));
    }
    
    if (filters?.classId) {
      conditions.push(eq(admissionApplications.classAppliedFor, filters.classId));
    }
    
    if (filters?.sessionId) {
      conditions.push(eq(admissionApplications.academicSessionId, filters.sessionId));
    }
    
    return await db
      .select()
      .from(admissionApplications)
      .where(and(...conditions))
      .orderBy(desc(admissionApplications.createdAt));
  }

  async getAdmissionApplication(id: string): Promise<AdmissionApplication | undefined> {
    const [application] = await db
      .select()
      .from(admissionApplications)
      .where(eq(admissionApplications.id, id));
    return application;
  }

  async createAdmissionApplication(application: InsertAdmissionApplication): Promise<AdmissionApplication> {
    const [created] = await db
      .insert(admissionApplications)
      .values(application)
      .returning();
    return created;
  }

  async updateAdmissionApplication(id: string, application: Partial<InsertAdmissionApplication>): Promise<AdmissionApplication> {
    const [updated] = await db
      .update(admissionApplications)
      .set({ ...application, updatedAt: new Date() })
      .where(eq(admissionApplications.id, id))
      .returning();
    return updated;
  }

  async deleteAdmissionApplication(id: string): Promise<void> {
    await db
      .delete(admissionApplications)
      .where(eq(admissionApplications.id, id));
  }

  async getAdmissionDocuments(applicationId: string): Promise<AdmissionDocument[]> {
    return await db
      .select()
      .from(admissionDocuments)
      .where(eq(admissionDocuments.applicationId, applicationId))
      .orderBy(asc(admissionDocuments.uploadedAt));
  }

  async createAdmissionDocument(document: InsertAdmissionDocument): Promise<AdmissionDocument> {
    const [created] = await db
      .insert(admissionDocuments)
      .values(document)
      .returning();
    return created;
  }

  async deleteAdmissionDocument(id: string): Promise<void> {
    await db
      .delete(admissionDocuments)
      .where(eq(admissionDocuments.id, id));
  }

  // ============================================================================
  // EXAM MODULE OPERATIONS
  // ============================================================================

  async getExams(schoolId: string, filters?: { academicSessionId?: string; examType?: string }): Promise<Exam[]> {
    const conditions = [eq(exams.schoolId, schoolId)];
    
    if (filters?.academicSessionId) {
      conditions.push(eq(exams.academicSessionId, filters.academicSessionId));
    }
    
    if (filters?.examType) {
      conditions.push(eq(exams.examType, filters.examType));
    }
    
    return await db
      .select()
      .from(exams)
      .where(and(...conditions))
      .orderBy(desc(exams.startDate));
  }

  async getExam(id: string): Promise<Exam | undefined> {
    const [exam] = await db
      .select()
      .from(exams)
      .where(eq(exams.id, id));
    return exam;
  }

  async createExam(exam: InsertExam): Promise<Exam> {
    const [created] = await db
      .insert(exams)
      .values(exam)
      .returning();
    return created;
  }

  async updateExam(id: string, exam: Partial<InsertExam>): Promise<Exam> {
    const [updated] = await db
      .update(exams)
      .set({ ...exam, updatedAt: new Date() })
      .where(eq(exams.id, id))
      .returning();
    return updated;
  }

  async deleteExam(id: string): Promise<void> {
    await db
      .delete(exams)
      .where(eq(exams.id, id));
  }

  // Exam Classes Management
  async getExamClasses(examId: string) {
    const results = await db
      .select({
        id: examClasses.id,
        examId: examClasses.examId,
        classId: examClasses.classId,
        createdAt: examClasses.createdAt,
        class: classes,
      })
      .from(examClasses)
      .leftJoin(classes, eq(examClasses.classId, classes.id))
      .where(eq(examClasses.examId, examId));
    
    return results;
  }

  async addExamClass(examId: string, classId: string, defaultMaxMarks: number = 100, defaultPassingMarks: number = 40) {
    // Add the class to the exam
    const [created] = await db
      .insert(examClasses)
      .values({ examId, classId })
      .returning();
    
    // Get all subjects for this class from class-subject assignments
    const assignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, classId));
    
    // Auto-create exam_subjects for each subject in the class
    for (const assignment of assignments) {
      // Check if exam_subject already exists
      const existing = await db
        .select()
        .from(examSubjects)
        .where(and(
          eq(examSubjects.examId, examId),
          eq(examSubjects.subjectId, assignment.subjectId)
        ));
      
      // Only create if it doesn't exist
      if (existing.length === 0) {
        await db
          .insert(examSubjects)
          .values({
            examId,
            subjectId: assignment.subjectId,
            maxMarks: defaultMaxMarks,
            passingMarks: defaultPassingMarks,
          });
      }
    }
    
    return created;
  }

  async removeExamClass(examId: string, classId: string): Promise<void> {
    await db
      .delete(examClasses)
      .where(and(
        eq(examClasses.examId, examId),
        eq(examClasses.classId, classId)
      ));
  }

  async getExamSubjects(examId: string): Promise<any[]> {
    return await db
      .select({
        id: examSubjects.id,
        examId: examSubjects.examId,
        subjectId: examSubjects.subjectId,
        maxMarks: examSubjects.maxMarks,
        passingMarks: examSubjects.passingMarks,
        createdAt: examSubjects.createdAt,
        subject: subjects,
      })
      .from(examSubjects)
      .leftJoin(subjects, eq(examSubjects.subjectId, subjects.id))
      .where(eq(examSubjects.examId, examId))
      .orderBy(asc(examSubjects.createdAt));
  }

  async getExamSubject(examSubjectId: string, schoolId: string): Promise<any | null> {
    const result = await db
      .select({
        id: examSubjects.id,
        examId: examSubjects.examId,
        subjectId: examSubjects.subjectId,
        maxMarks: examSubjects.maxMarks,
        passingMarks: examSubjects.passingMarks,
        createdAt: examSubjects.createdAt,
      })
      .from(examSubjects)
      .innerJoin(exams, eq(examSubjects.examId, exams.id))
      .where(and(
        eq(examSubjects.id, examSubjectId),
        eq(exams.schoolId, schoolId)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  async createExamSubject(examSubject: InsertExamSubject): Promise<ExamSubject> {
    const [created] = await db
      .insert(examSubjects)
      .values(examSubject)
      .returning();
    return created;
  }

  async updateExamSubjectMaxMarks(examSubjectId: string, maxMarks: number, schoolId: string): Promise<ExamSubject | null> {
    // First verify the exam subject belongs to the school
    const [examSubject] = await db
      .select()
      .from(examSubjects)
      .innerJoin(exams, eq(examSubjects.examId, exams.id))
      .where(and(
        eq(examSubjects.id, examSubjectId),
        eq(exams.schoolId, schoolId)
      ))
      .limit(1);

    if (!examSubject) {
      return null;
    }

    // Update max marks
    const [updated] = await db
      .update(examSubjects)
      .set({ maxMarks })
      .where(eq(examSubjects.id, examSubjectId))
      .returning();

    return updated;
  }

  async updateExamSubjectMarks(examSubjectId: string, updateData: { maxMarks?: number; passingMarks?: number }, schoolId: string): Promise<ExamSubject | null> {
    // First verify the exam subject belongs to the school
    const [examSubject] = await db
      .select()
      .from(examSubjects)
      .innerJoin(exams, eq(examSubjects.examId, exams.id))
      .where(and(
        eq(examSubjects.id, examSubjectId),
        eq(exams.schoolId, schoolId)
      ))
      .limit(1);

    if (!examSubject) {
      return null;
    }

    // Update marks
    const [updated] = await db
      .update(examSubjects)
      .set(updateData)
      .where(eq(examSubjects.id, examSubjectId))
      .returning();

    return updated;
  }

  async deleteExamSubject(id: string): Promise<void> {
    await db
      .delete(examSubjects)
      .where(eq(examSubjects.id, id));
  }

  async getExamMarks(examId: string): Promise<ExamMark[]> {
    return await db
      .select()
      .from(examMarks)
      .where(eq(examMarks.examId, examId))
      .orderBy(asc(examMarks.studentId));
  }

  async getStudentExamMarks(examId: string, studentId: string): Promise<ExamMark[]> {
    return await db
      .select()
      .from(examMarks)
      .where(and(
        eq(examMarks.examId, examId),
        eq(examMarks.studentId, studentId)
      ))
      .orderBy(asc(examMarks.examSubjectId));
  }

  async createExamMark(mark: InsertExamMark): Promise<ExamMark> {
    // Check if mark already exists for this student-subject combination
    const [existing] = await db
      .select()
      .from(examMarks)
      .where(and(
        eq(examMarks.studentId, mark.studentId),
        eq(examMarks.examSubjectId, mark.examSubjectId)
      ))
      .limit(1);

    if (existing) {
      // Update existing mark
      const [updated] = await db
        .update(examMarks)
        .set({
          marksObtained: mark.marksObtained,
          isAbsent: mark.isAbsent,
          remarks: mark.remarks,
          enteredBy: mark.enteredBy,
          updatedAt: new Date(),
        })
        .where(eq(examMarks.id, existing.id))
        .returning();
      return updated;
    } else {
      // Insert new mark
      const [created] = await db
        .insert(examMarks)
        .values(mark)
        .returning();
      return created;
    }
  }

  async updateExamMark(id: string, mark: Partial<InsertExamMark>): Promise<ExamMark> {
    const [updated] = await db
      .update(examMarks)
      .set({ ...mark, updatedAt: new Date() })
      .where(eq(examMarks.id, id))
      .returning();
    return updated;
  }

  async deleteExamMark(id: string): Promise<void> {
    await db
      .delete(examMarks)
      .where(eq(examMarks.id, id));
  }

  async getExamResults(examId: string): Promise<ExamResult[]> {
    return await db
      .select()
      .from(examResults)
      .where(eq(examResults.examId, examId))
      .orderBy(desc(examResults.percentage));
  }

  async getStudentExamResult(examId: string, studentId: string): Promise<ExamResult | undefined> {
    const [result] = await db
      .select()
      .from(examResults)
      .where(and(
        eq(examResults.examId, examId),
        eq(examResults.studentId, studentId)
      ));
    return result;
  }

  async createExamResult(result: InsertExamResult): Promise<ExamResult> {
    const [created] = await db
      .insert(examResults)
      .values(result)
      .returning();
    return created;
  }

  async updateExamResult(id: string, result: Partial<InsertExamResult>): Promise<ExamResult> {
    const [updated] = await db
      .update(examResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(examResults.id, id))
      .returning();
    return updated;
  }

  async deleteExamResult(id: string): Promise<void> {
    await db
      .delete(examResults)
      .where(eq(examResults.id, id));
  }

  // ============================================================================
  // HOSTEL MANAGEMENT OPERATIONS
  // ============================================================================

  async getHostels(schoolId: string): Promise<Hostel[]> {
    return await db
      .select()
      .from(hostels)
      .where(eq(hostels.schoolId, schoolId))
      .orderBy(asc(hostels.name));
  }

  async getHostel(id: string): Promise<Hostel | undefined> {
    const [hostel] = await db
      .select()
      .from(hostels)
      .where(eq(hostels.id, id));
    return hostel;
  }

  async createHostel(hostel: InsertHostel): Promise<Hostel> {
    const [created] = await db
      .insert(hostels)
      .values(hostel)
      .returning();
    return created;
  }

  async updateHostel(id: string, hostel: Partial<InsertHostel>): Promise<Hostel> {
    const [updated] = await db
      .update(hostels)
      .set({ ...hostel, updatedAt: new Date() })
      .where(eq(hostels.id, id))
      .returning();
    return updated;
  }

  async deleteHostel(id: string): Promise<void> {
    await db
      .delete(hostels)
      .where(eq(hostels.id, id));
  }

  async getHostelRooms(hostelId: string): Promise<HostelRoom[]> {
    return await db
      .select()
      .from(hostelRooms)
      .where(eq(hostelRooms.hostelId, hostelId))
      .orderBy(asc(hostelRooms.roomNumber));
  }

  async getHostelRoom(id: string): Promise<HostelRoom | undefined> {
    const [room] = await db
      .select()
      .from(hostelRooms)
      .where(eq(hostelRooms.id, id));
    return room;
  }

  async createHostelRoom(room: InsertHostelRoom): Promise<HostelRoom> {
    const [created] = await db
      .insert(hostelRooms)
      .values(room)
      .returning();
    return created;
  }

  async updateHostelRoom(id: string, room: Partial<InsertHostelRoom>): Promise<HostelRoom> {
    const [updated] = await db
      .update(hostelRooms)
      .set({ ...room, updatedAt: new Date() })
      .where(eq(hostelRooms.id, id))
      .returning();
    return updated;
  }

  async deleteHostelRoom(id: string): Promise<void> {
    await db
      .delete(hostelRooms)
      .where(eq(hostelRooms.id, id));
  }

  async getHostelAllocations(filters?: { schoolId?: string; hostelId?: string; studentId?: string; isActive?: boolean; sessionId?: string }): Promise<HostelAllocation[]> {
    const conditions = [];

    // Allocations have no school column - scope them through the student
    if (filters?.schoolId) {
      conditions.push(inArray(hostelAllocations.studentId, db.select({ id: students.id }).from(students).where(eq(students.schoolId, filters.schoolId))));
    }

    if (filters?.studentId) {
      conditions.push(eq(hostelAllocations.studentId, filters.studentId));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(hostelAllocations.isActive, filters.isActive));
    }
    
    if (filters?.sessionId) {
      conditions.push(eq(hostelAllocations.academicSessionId, filters.sessionId));
    }
    
    if (filters?.hostelId) {
      conditions.push(eq(hostelRooms.hostelId, filters.hostelId));
    }

    // Join the room so each allocation carries its hostel and room number (the Hostel page shows both)
    return await db
      .select({
        id: hostelAllocations.id,
        roomId: hostelAllocations.roomId,
        studentId: hostelAllocations.studentId,
        academicSessionId: hostelAllocations.academicSessionId,
        allocationDate: hostelAllocations.allocationDate,
        checkOutDate: hostelAllocations.checkOutDate,
        isActive: hostelAllocations.isActive,
        createdAt: hostelAllocations.createdAt,
        updatedAt: hostelAllocations.updatedAt,
        hostelId: hostelRooms.hostelId,
        roomNumber: hostelRooms.roomNumber,
      })
      .from(hostelAllocations)
      .innerJoin(hostelRooms, eq(hostelRooms.id, hostelAllocations.roomId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(hostelAllocations.allocationDate));
  }

  async getHostelAllocation(id: string): Promise<HostelAllocation | undefined> {
    const [allocation] = await db
      .select()
      .from(hostelAllocations)
      .where(eq(hostelAllocations.id, id));
    return allocation;
  }

  async createHostelAllocation(allocation: InsertHostelAllocation): Promise<HostelAllocation> {
    const [created] = await db
      .insert(hostelAllocations)
      .values(allocation)
      .returning();
    return created;
  }

  async updateHostelAllocation(id: string, allocation: Partial<InsertHostelAllocation>): Promise<HostelAllocation> {
    const [updated] = await db
      .update(hostelAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(hostelAllocations.id, id))
      .returning();
    return updated;
  }

  async deleteHostelAllocation(id: string): Promise<void> {
    await db
      .delete(hostelAllocations)
      .where(eq(hostelAllocations.id, id));
  }

  async getHostelFees(filters?: { schoolId?: string; hostelId?: string; studentId?: string; paymentStatus?: string; sessionId?: string }): Promise<HostelFee[]> {
    const conditions = [];

    // Hostel fees have no school column - scope them through the student
    if (filters?.schoolId) {
      conditions.push(inArray(hostelFees.studentId, db.select({ id: students.id }).from(students).where(eq(students.schoolId, filters.schoolId))));
    }

    if (filters?.hostelId) {
      conditions.push(eq(hostelFees.hostelId, filters.hostelId));
    }
    
    if (filters?.studentId) {
      conditions.push(eq(hostelFees.studentId, filters.studentId));
    }
    
    if (filters?.paymentStatus) {
      conditions.push(eq(hostelFees.paymentStatus, filters.paymentStatus));
    }
    
    if (filters?.sessionId) {
      conditions.push(eq(hostelFees.academicSessionId, filters.sessionId));
    }
    
    return await db
      .select()
      .from(hostelFees)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(hostelFees.dueDate));
  }

  async getHostelFee(id: string): Promise<HostelFee | undefined> {
    const [fee] = await db
      .select()
      .from(hostelFees)
      .where(eq(hostelFees.id, id));
    return fee;
  }

  async createHostelFee(fee: InsertHostelFee): Promise<HostelFee> {
    const [created] = await db
      .insert(hostelFees)
      .values(fee)
      .returning();
    return created;
  }

  async updateHostelFee(id: string, fee: Partial<InsertHostelFee>): Promise<HostelFee> {
    const [updated] = await db
      .update(hostelFees)
      .set({ ...fee, updatedAt: new Date() })
      .where(eq(hostelFees.id, id))
      .returning();
    return updated;
  }

  async deleteHostelFee(id: string): Promise<void> {
    await db
      .delete(hostelFees)
      .where(eq(hostelFees.id, id));
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  async getInventoryCategories(schoolId: string): Promise<InventoryCategory[]> {
    return await db
      .select()
      .from(inventoryCategories)
      .where(eq(inventoryCategories.schoolId, schoolId))
      .orderBy(inventoryCategories.name);
  }

  async getInventoryCategory(id: string): Promise<InventoryCategory | undefined> {
    const [category] = await db
      .select()
      .from(inventoryCategories)
      .where(eq(inventoryCategories.id, id));
    return category;
  }

  async createInventoryCategory(category: InsertInventoryCategory): Promise<InventoryCategory> {
    const [created] = await db
      .insert(inventoryCategories)
      .values(category)
      .returning();
    return created;
  }

  async updateInventoryCategory(id: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory> {
    const [updated] = await db
      .update(inventoryCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(inventoryCategories.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryCategory(id: string): Promise<void> {
    await db
      .delete(inventoryCategories)
      .where(eq(inventoryCategories.id, id));
  }

  async getInventoryItems(schoolId: string, filters?: { categoryId?: string; lowStock?: boolean }): Promise<InventoryItem[]> {
    const conditions = [eq(inventoryItems.schoolId, schoolId)];
    
    if (filters?.categoryId) {
      conditions.push(eq(inventoryItems.categoryId, filters.categoryId));
    }
    
    if (filters?.lowStock) {
      conditions.push(sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`);
    }
    
    return await db
      .select()
      .from(inventoryItems)
      .where(and(...conditions))
      .orderBy(inventoryItems.itemName);
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [created] = await db
      .insert(inventoryItems)
      .values(item)
      .returning();
    return created;
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const [updated] = await db
      .update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, id));
  }

  async getLowStockItems(schoolId: string): Promise<InventoryItem[]> {
    return await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.schoolId, schoolId),
          sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`
        )
      )
      .orderBy(inventoryItems.itemName);
  }

  async getInventoryTransactions(filters?: { itemId?: string; transactionType?: string; startDate?: string; endDate?: string }): Promise<InventoryTransaction[]> {
    const conditions = [];
    
    if (filters?.itemId) {
      conditions.push(eq(inventoryTransactions.itemId, filters.itemId));
    }
    
    if (filters?.transactionType) {
      conditions.push(eq(inventoryTransactions.transactionType, filters.transactionType));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(inventoryTransactions.transactionDate, new Date(filters.startDate)));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(inventoryTransactions.transactionDate, new Date(filters.endDate)));
    }
    
    return await db
      .select()
      .from(inventoryTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryTransactions.transactionDate));
  }

  async getInventoryTransaction(id: string): Promise<InventoryTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.id, id));
    return transaction;
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [created] = await db
      .insert(inventoryTransactions)
      .values(transaction)
      .returning();
    
    const item = await this.getInventoryItem(transaction.itemId);
    if (!item) throw new Error("Item not found");
    
    let newStock = item.currentStock;
    if (transaction.transactionType === 'purchase' || transaction.transactionType === 'return') {
      newStock += transaction.quantity;
    } else if (transaction.transactionType === 'issue' || transaction.transactionType === 'damaged') {
      newStock -= transaction.quantity;
    } else if (transaction.transactionType === 'adjustment') {
      newStock = transaction.quantity;
    }
    
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }
    
    await this.updateInventoryItem(transaction.itemId, { currentStock: newStock });
    
    return created;
  }

  async getItemTransactions(itemId: string): Promise<InventoryTransaction[]> {
    return await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId))
      .orderBy(desc(inventoryTransactions.transactionDate));
  }

  // ============================================================================
  // TEACHER PLANNER SETTINGS
  // ============================================================================

  async getTeacherPlannerSettings(schoolId: string): Promise<TeacherPlannerSettings | undefined> {
    const [settings] = await db
      .select()
      .from(teacherPlannerSettings)
      .where(eq(teacherPlannerSettings.schoolId, schoolId));
    return settings;
  }

  async upsertTeacherPlannerSettings(schoolId: string, maxPeriodsPerTeacher: number): Promise<TeacherPlannerSettings> {
    const existing = await this.getTeacherPlannerSettings(schoolId);
    
    if (existing) {
      const [updated] = await db
        .update(teacherPlannerSettings)
        .set({ 
          maxPeriodsPerTeacher,
          updatedAt: new Date()
        })
        .where(eq(teacherPlannerSettings.schoolId, schoolId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(teacherPlannerSettings)
        .values({
          schoolId,
          maxPeriodsPerTeacher
        })
        .returning();
      return created;
    }
  }

  // ============================================================================
  // SCHOOL INSIGHTS (Rule-Based Calculations)
  // ============================================================================

  async getTeacherShortageInsights(schoolId: string): Promise<any[]> {
    const insights: any[] = [];
    
    // Get all classes for the school
    const schoolClasses = await db
      .select()
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    for (const schoolClass of schoolClasses) {
      let totalRequiredPeriods = 0;
      let totalAvailableCapacity = 0;
      const issues: string[] = [];

      // Get class subject assignments (planned periods)
      const assignments = await db
        .select({
          assignment: classSubjectAssignments,
          teacher: teachers,
          subject: subjects
        })
        .from(classSubjectAssignments)
        .leftJoin(teachers, eq(classSubjectAssignments.assignedTeacherId, teachers.id))
        .leftJoin(subjects, eq(classSubjectAssignments.subjectId, subjects.id))
        .where(eq(classSubjectAssignments.classId, schoolClass.id));

      // Calculate required periods and check for unassigned subjects
      for (const { assignment, teacher, subject } of assignments) {
        totalRequiredPeriods += assignment.weeklyFrequency;

        if (!teacher) {
          issues.push(`${subject?.name || 'Subject'} has no teacher assigned (${assignment.weeklyFrequency} periods)`);
        } else {
          totalAvailableCapacity += assignment.weeklyFrequency;

          const teacherTotalPeriods = await db
            .select({
              totalPeriods: sql<number>`CAST(COALESCE(SUM(${classSubjectAssignments.weeklyFrequency}), 0) AS INTEGER)`
            })
            .from(classSubjectAssignments)
            .where(eq(classSubjectAssignments.assignedTeacherId, teacher.id));

          const usedCapacity = teacherTotalPeriods[0]?.totalPeriods || 0;
          
          // Weekly capacity = daily limit x 6 working days (teachers have no separate weekly limit)
          const weeklyCapacity = teacher.maxDailyPeriods * 6;
          if (usedCapacity > weeklyCapacity) {
            issues.push(`${teacher.name} is over-capacity (${usedCapacity}/${weeklyCapacity} periods)`);
          }
        }
      }

      // Check for timetable gaps (generated but incomplete)
      const timetableEntryCount = await db
        .select({
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`
        })
        .from(timetableEntries)
        .where(
          and(
            eq(timetableEntries.classId, schoolClass.id),
            eq(timetableEntries.isActive, true)
          )
        );

      const actualScheduledPeriods = timetableEntryCount[0]?.count || 0;

      // Calculate shortage
      const shortage = totalRequiredPeriods - totalAvailableCapacity;
      const timetableGap = totalRequiredPeriods - actualScheduledPeriods;

      if (shortage > 0 || timetableGap > 0 || issues.length > 0) {
        const hasUnassignedSubjects = shortage > 0;
        const hasTimetableGap = timetableGap > 0;
        const hasTeacherIssues = issues.some(issue => issue.includes('over-capacity') || issue.includes('at full capacity'));
        
        let title = 'Staffing Alert';
        let message = '';
        let severity: 'critical' | 'warning' | 'info' = 'info';

        if (hasUnassignedSubjects) {
          title = 'Teacher Shortage Detected';
          message = `Class ${schoolClass.grade} ${schoolClass.section} has ${shortage} periods with no teacher assigned`;
          severity = shortage > 10 ? 'critical' : shortage > 5 ? 'warning' : 'info';
        } else if (hasTimetableGap) {
          title = 'Timetable Incomplete';
          message = `${timetableGap} periods not yet scheduled in timetable`;
          severity = timetableGap > 10 ? 'critical' : timetableGap > 5 ? 'warning' : 'info';
        } else if (hasTeacherIssues) {
          title = 'Teacher Over-Capacity';
          message = `Some teachers are over their maximum load`;
          severity = 'warning';
        } else {
          title = 'Class Assignment Issues';
          message = `Class has assignment issues that need attention`;
          severity = 'info';
        }

        insights.push({
          id: `shortage-${schoolClass.id}`,
          category: 'staffing',
          severity,
          classId: schoolClass.id,
          className: `${schoolClass.grade} ${schoolClass.section}`,
          title,
          message,
          details: {
            requiredPeriods: totalRequiredPeriods,
            availableCapacity: totalAvailableCapacity,
            scheduledPeriods: actualScheduledPeriods,
            shortage,
            timetableGap,
            issues
          },
          action: { type: 'view_class', classId: schoolClass.id }
        });
      }
    }

    return insights;
  }

  async getAttendanceInsights(schoolId: string): Promise<any[]> {
    const insights: any[] = [];
    
    // Get all classes
    const schoolClasses = await db
      .select()
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    for (const schoolClass of schoolClasses) {
      // Calculate average attendance (recent 30 days or all-time if less)
      const attendanceStats = await db
        .select({
          totalDays: sql<number>`CAST(COUNT(DISTINCT ${studentAttendance.attendanceDate}) AS INTEGER)`,
          totalPresent: sql<number>`CAST(SUM(CASE WHEN ${studentAttendance.status} = 'present' THEN 1 ELSE 0 END) AS INTEGER)`,
          totalStudents: sql<number>`CAST(COUNT(DISTINCT ${studentAttendance.studentId}) AS INTEGER)`
        })
        .from(studentAttendance)
        .innerJoin(students, eq(studentAttendance.studentId, students.id))
        .where(eq(students.classId, schoolClass.id));

      const stats = attendanceStats[0];
      if (stats && stats.totalDays > 0 && stats.totalStudents > 0) {
        const totalPossibleAttendance = stats.totalDays * stats.totalStudents;
        const attendancePercentage = totalPossibleAttendance > 0 
          ? Math.round((stats.totalPresent / totalPossibleAttendance) * 100) 
          : 0;

        if (attendancePercentage < 75) {
          insights.push({
            id: `attendance-${schoolClass.id}`,
            category: 'attendance',
            severity: attendancePercentage < 60 ? 'critical' : 'warning',
            classId: schoolClass.id,
            className: `${schoolClass.grade} ${schoolClass.section}`,
            title: `Low Attendance Alert`,
            message: `Class ${schoolClass.grade} ${schoolClass.section} has ${attendancePercentage}% attendance (last ${stats.totalDays} days)`,
            details: {
              percentage: attendancePercentage,
              totalDays: stats.totalDays,
              totalPresent: stats.totalPresent,
              totalStudents: stats.totalStudents
            },
            action: { type: 'view_attendance', classId: schoolClass.id }
          });
        }
      }
    }

    return insights;
  }

  async getTeacherAbsenceInsights(schoolId: string): Promise<any[]> {
    const insights: any[] = [];

    // Get teacher absence counts (all-time)
    const absenceCounts = await db
      .select({
        teacherId: teacherAttendance.teacherId,
        teacherName: teachers.name,
        absentDays: sql<number>`CAST(COUNT(*) AS INTEGER)`
      })
      .from(teacherAttendance)
      .innerJoin(teachers, eq(teacherAttendance.teacherId, teachers.id))
      .where(
        and(
          eq(teachers.schoolId, schoolId),
          eq(teacherAttendance.status, 'absent')
        )
      )
      .groupBy(teacherAttendance.teacherId, teachers.name)
      .orderBy(desc(sql<number>`CAST(COUNT(*) AS INTEGER)`))
      .limit(5); // Top 5 most absent teachers

    // Flag teachers with more than 3 absences
    for (const absence of absenceCounts) {
      if (absence.absentDays > 3) {
        insights.push({
          id: `absence-${absence.teacherId}`,
          category: 'staffing',
          severity: absence.absentDays > 7 ? 'critical' : absence.absentDays > 5 ? 'warning' : 'info',
          teacherId: absence.teacherId,
          teacherName: absence.teacherName,
          title: `High Teacher Absence`,
          message: `${absence.teacherName} has been absent ${absence.absentDays} days`,
          details: {
            absentDays: absence.absentDays
          },
          action: { type: 'view_teacher', teacherId: absence.teacherId }
        });
      }
    }

    return insights;
  }

  async getAllSchoolInsights(schoolId: string): Promise<any[]> {
    const [shortageInsights, attendanceInsights, absenceInsights] = await Promise.all([
      this.getTeacherShortageInsights(schoolId),
      this.getAttendanceInsights(schoolId),
      this.getTeacherAbsenceInsights(schoolId)
    ]);

    const allInsights = [
      ...shortageInsights,
      ...attendanceInsights,
      ...absenceInsights
    ];

    // Sort by severity: critical > warning > info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return allInsights;
  }

  // ============================================================================
  // PAYROLL MANAGEMENT
  // ============================================================================

  async getPayrollEmployees(schoolId: string): Promise<PayrollEmployee[]> {
    return await db
      .select()
      .from(payrollEmployees)
      .where(eq(payrollEmployees.schoolId, schoolId))
      .orderBy(payrollEmployees.designation);
  }

  async getPayrollEmployee(id: string): Promise<PayrollEmployee | undefined> {
    const [employee] = await db
      .select()
      .from(payrollEmployees)
      .where(eq(payrollEmployees.id, id));
    return employee;
  }

  async createPayrollEmployee(employee: InsertPayrollEmployee): Promise<PayrollEmployee> {
    const [newEmployee] = await db
      .insert(payrollEmployees)
      .values(employee)
      .returning();
    return newEmployee;
  }

  async updatePayrollEmployee(id: string, employee: Partial<InsertPayrollEmployee>): Promise<PayrollEmployee> {
    const [updated] = await db
      .update(payrollEmployees)
      .set({ ...employee, updatedAt: new Date() })
      .where(eq(payrollEmployees.id, id))
      .returning();
    return updated;
  }

  async deletePayrollEmployee(id: string): Promise<void> {
    await db.delete(payrollEmployees).where(eq(payrollEmployees.id, id));
  }

  async getSalaryComponents(employeeId: string): Promise<SalaryComponent[]> {
    return await db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.payrollEmployeeId, employeeId))
      .orderBy(salaryComponents.componentType);
  }

  async getSalaryComponent(id: string): Promise<SalaryComponent | undefined> {
    const [component] = await db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.id, id));
    return component;
  }

  async createSalaryComponent(component: InsertSalaryComponent): Promise<SalaryComponent> {
    const [newComponent] = await db
      .insert(salaryComponents)
      .values(component)
      .returning();
    return newComponent;
  }

  async updateSalaryComponent(id: string, component: Partial<InsertSalaryComponent>): Promise<SalaryComponent> {
    const [updated] = await db
      .update(salaryComponents)
      .set({ ...component, updatedAt: new Date() })
      .where(eq(salaryComponents.id, id))
      .returning();
    return updated;
  }

  async deleteSalaryComponent(id: string): Promise<void> {
    await db.delete(salaryComponents).where(eq(salaryComponents.id, id));
  }

  async getPayrollCycles(schoolId: string, filters?: { month?: number; year?: number; status?: string }): Promise<PayrollCycle[]> {
    const conditions = [eq(payrollCycles.schoolId, schoolId)];
    
    if (filters?.month) {
      conditions.push(eq(payrollCycles.cycleMonth, filters.month));
    }
    if (filters?.year) {
      conditions.push(eq(payrollCycles.cycleYear, filters.year));
    }
    if (filters?.status) {
      conditions.push(eq(payrollCycles.status, filters.status as any));
    }

    return await db
      .select()
      .from(payrollCycles)
      .where(and(...conditions))
      .orderBy(desc(payrollCycles.cycleYear), desc(payrollCycles.cycleMonth));
  }

  async getPayrollCycle(id: string): Promise<PayrollCycle | undefined> {
    const [cycle] = await db
      .select()
      .from(payrollCycles)
      .where(eq(payrollCycles.id, id));
    return cycle;
  }

  async createPayrollCycle(cycle: InsertPayrollCycle): Promise<PayrollCycle> {
    const [newCycle] = await db
      .insert(payrollCycles)
      .values(cycle)
      .returning();
    return newCycle;
  }

  async updatePayrollCycle(id: string, cycle: Partial<InsertPayrollCycle>): Promise<PayrollCycle> {
    const [updated] = await db
      .update(payrollCycles)
      .set({ ...cycle, updatedAt: new Date() })
      .where(eq(payrollCycles.id, id))
      .returning();
    return updated;
  }

  async processPayrollCycle(cycleId: string, processedBy: string): Promise<{ success: boolean; message: string; payslips: PayrollPayslip[] }> {
    const cycle = await this.getPayrollCycle(cycleId);
    if (!cycle) {
      return { success: false, message: 'Payroll cycle not found', payslips: [] };
    }

    const employees = await this.getPayrollEmployees(cycle.schoolId);
    const payslipsToCreate: InsertPayrollPayslip[] = [];
    let totalAmount = 0;

    for (const employee of employees) {
      const components = await this.getSalaryComponents(employee.id);
      
      let basicSalary = 0;
      let totalAllowances = 0;
      let totalDeductions = 0;

      for (const component of components) {
        const amount = parseFloat(component.amount);
        if (component.componentType === 'basic_salary') {
          basicSalary += amount;
        } else if (component.componentType === 'allowance') {
          totalAllowances += amount;
        } else if (component.componentType === 'deduction') {
          totalDeductions += amount;
        }
      }

      const netSalary = basicSalary + totalAllowances - totalDeductions;
      totalAmount += netSalary;

      payslipsToCreate.push({
        cycleId: cycle.id,
        payrollEmployeeId: employee.id,
        basicSalary: basicSalary.toFixed(2),
        totalAllowances: totalAllowances.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        netSalary: netSalary.toFixed(2),
        paymentStatus: 'pending'
      });
    }

    const createdPayslips = await db
      .insert(payrollPayslips)
      .values(payslipsToCreate)
      .returning();

    await db
      .update(payrollCycles)
      .set({
        status: 'completed',
        totalEmployees: employees.length,
        totalAmount: totalAmount.toFixed(2),
        processedBy,
        processedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(payrollCycles.id, cycleId));

    return { 
      success: true, 
      message: `Successfully generated ${createdPayslips.length} payslips`, 
      payslips: createdPayslips 
    };
  }

  async markCycleAsPaid(cycleId: string): Promise<PayrollCycle> {
    const [updated] = await db
      .update(payrollCycles)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(payrollCycles.id, cycleId))
      .returning();
    return updated;
  }

  async getPayrollPayslips(cycleId: string): Promise<PayrollPayslip[]> {
    return await db
      .select()
      .from(payrollPayslips)
      .where(eq(payrollPayslips.cycleId, cycleId))
      .orderBy(payrollPayslips.payrollEmployeeId);
  }

  async getPayrollPayslip(id: string): Promise<PayrollPayslip | undefined> {
    const [payslip] = await db
      .select()
      .from(payrollPayslips)
      .where(eq(payrollPayslips.id, id));
    return payslip;
  }

  async markPayslipAsPaid(id: string, paymentDate: Date): Promise<PayrollPayslip> {
    const [updated] = await db
      .update(payrollPayslips)
      .set({ 
        paymentStatus: 'paid', 
        paymentDate,
        updatedAt: new Date() 
      })
      .where(eq(payrollPayslips.id, id))
      .returning();
    return updated;
  }

  async getPayrollEmployeeByUserId(userId: string, schoolId: string): Promise<PayrollEmployee | undefined> {
    const [employee] = await db
      .select()
      .from(payrollEmployees)
      .where(
        and(
          eq(payrollEmployees.employeeId, userId),
          eq(payrollEmployees.schoolId, schoolId)
        )
      );
    return employee;
  }

  async getTeacherPayslips(payrollEmployeeId: string): Promise<PayrollPayslip[]> {
    return await db
      .select()
      .from(payrollPayslips)
      .where(eq(payrollPayslips.payrollEmployeeId, payrollEmployeeId))
      .orderBy(desc(payrollPayslips.createdAt));
  }

  // ==================== EXPENSE MANAGEMENT OPERATIONS ====================

  async getExpenseCategories(schoolId: string): Promise<ExpenseCategory[]> {
    return await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.schoolId, schoolId))
      .orderBy(expenseCategories.categoryName);
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    const [category] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, id));
    return category;
  }

  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [created] = await db
      .insert(expenseCategories)
      .values(category)
      .returning();
    return created;
  }

  async updateExpenseCategory(id: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory> {
    const [updated] = await db
      .update(expenseCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(expenseCategories.id, id))
      .returning();
    return updated;
  }

  async deleteExpenseCategory(id: string): Promise<void> {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
  }

  async getExpenses(schoolId: string, filters?: { categoryId?: string; sessionId?: string; status?: string; startDate?: string; endDate?: string }): Promise<Expense[]> {
    const conditions = [eq(expenses.schoolId, schoolId)];
    
    if (filters?.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }
    if (filters?.sessionId) {
      conditions.push(eq(expenses.academicSessionId, filters.sessionId));
    }
    if (filters?.status) {
      conditions.push(eq(expenses.paymentStatus, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(expenses.expenseDate, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.expenseDate, new Date(filters.endDate)));
    }

    return await db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db
      .insert(expenses)
      .values(expense)
      .returning();
    return created;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense> {
    const [updated] = await db
      .update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async approveExpense(id: string, approvedBy: string): Promise<Expense> {
    const [expense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id));

    if (!expense) {
      throw new Error('Expense not found');
    }

    const [updated] = await db
      .update(expenses)
      .set({ 
        paymentStatus: 'approved',
        approvedBy,
        updatedAt: new Date() 
      })
      .where(eq(expenses.id, id))
      .returning();

    await this.updateBudgetSpent(expense.categoryId, expense.academicSessionId, parseFloat(expense.amount));

    return updated;
  }

  async rejectExpense(id: string, approvedBy: string): Promise<Expense> {
    const [updated] = await db
      .update(expenses)
      .set({ 
        paymentStatus: 'rejected',
        approvedBy,
        updatedAt: new Date() 
      })
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async getBudgets(schoolId: string, filters?: { categoryId?: string; sessionId?: string }): Promise<Budget[]> {
    const conditions = [eq(budgets.schoolId, schoolId)];
    
    if (filters?.categoryId) {
      conditions.push(eq(budgets.categoryId, filters.categoryId));
    }
    if (filters?.sessionId) {
      conditions.push(eq(budgets.academicSessionId, filters.sessionId));
    }

    return await db
      .select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(budgets.categoryId);
  }

  async getBudget(id: string): Promise<Budget | undefined> {
    const [budget] = await db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id));
    return budget;
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db
      .insert(budgets)
      .values(budget)
      .returning();
    return created;
  }

  async updateBudget(id: string, budget: Partial<InsertBudget>): Promise<Budget> {
    const [updated] = await db
      .update(budgets)
      .set({ ...budget, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    return updated;
  }

  async getBudgetSummary(schoolId: string, sessionId?: string): Promise<any[]> {
    const conditions = [eq(budgets.schoolId, schoolId)];
    
    if (sessionId) {
      conditions.push(eq(budgets.academicSessionId, sessionId));
    }

    const budgetData = await db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        categoryName: expenseCategories.categoryName,
        allocatedAmount: budgets.allocatedAmount,
        spentAmount: budgets.spentAmount,
        remainingAmount: budgets.remainingAmount,
        status: budgets.status,
        sessionId: budgets.academicSessionId,
      })
      .from(budgets)
      .innerJoin(expenseCategories, eq(budgets.categoryId, expenseCategories.id))
      .where(and(...conditions))
      .orderBy(expenseCategories.categoryName);

    return budgetData;
  }

  async updateBudgetSpent(categoryId: string, sessionId: string, amount: number): Promise<void> {
    const [budget] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.categoryId, categoryId),
          eq(budgets.academicSessionId, sessionId)
        )
      );

    if (budget) {
      const newSpent = parseFloat(budget.spentAmount) + amount;
      const newRemaining = parseFloat(budget.allocatedAmount) - newSpent;
      const newStatus = newSpent > parseFloat(budget.allocatedAmount) ? 'exceeded' : 'active';

      await db
        .update(budgets)
        .set({
          spentAmount: newSpent.toString(),
          remainingAmount: newRemaining.toString(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(budgets.id, budget.id));
    }
  }

  // ==================== ID CARD TEMPLATES ====================

  async getIdCardTemplates(schoolId: string, type?: 'student' | 'teacher'): Promise<IdCardTemplate[]> {
    const conditions = [eq(idCardTemplates.schoolId, schoolId)];
    
    if (type) {
      conditions.push(eq(idCardTemplates.type, type));
    }

    return await db
      .select()
      .from(idCardTemplates)
      .where(and(...conditions))
      .orderBy(desc(idCardTemplates.isDefault), idCardTemplates.name);
  }

  async getIdCardTemplate(id: string): Promise<IdCardTemplate | undefined> {
    const [template] = await db
      .select()
      .from(idCardTemplates)
      .where(eq(idCardTemplates.id, id));
    return template;
  }

  async createIdCardTemplate(template: InsertIdCardTemplate): Promise<IdCardTemplate> {
    // If setting as default, unset other defaults of same type
    if (template.isDefault) {
      await db
        .update(idCardTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(idCardTemplates.schoolId, template.schoolId),
            eq(idCardTemplates.type, template.type)
          )
        );
    }

    const [created] = await db
      .insert(idCardTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateIdCardTemplate(id: string, template: Partial<InsertIdCardTemplate>): Promise<IdCardTemplate> {
    // If setting as default, unset other defaults
    if (template.isDefault) {
      const current = await this.getIdCardTemplate(id);
      if (current) {
        await db
          .update(idCardTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(idCardTemplates.schoolId, current.schoolId),
              eq(idCardTemplates.type, current.type),
              ne(idCardTemplates.id, id)
            )
          );
      }
    }

    const [updated] = await db
      .update(idCardTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(idCardTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteIdCardTemplate(id: string): Promise<void> {
    await db.delete(idCardTemplates).where(eq(idCardTemplates.id, id));
  }

  // ==================== ID CARDS ====================

  async getIdCards(schoolId: string, personType?: 'student' | 'teacher', personId?: string): Promise<IdCard[]> {
    const conditions = [eq(idCards.schoolId, schoolId)];
    
    if (personType) {
      conditions.push(eq(idCards.personType, personType));
    }
    if (personId) {
      conditions.push(eq(idCards.personId, personId));
    }

    return await db
      .select()
      .from(idCards)
      .where(and(...conditions))
      .orderBy(desc(idCards.createdAt));
  }

  async getIdCard(id: string): Promise<IdCard | undefined> {
    const [card] = await db
      .select()
      .from(idCards)
      .where(eq(idCards.id, id));
    return card;
  }

  async createIdCard(card: InsertIdCard): Promise<IdCard> {
    const [created] = await db
      .insert(idCards)
      .values(card)
      .returning();
    return created;
  }

  async deleteIdCard(id: string): Promise<void> {
    await db.delete(idCards).where(eq(idCards.id, id));
  }

  async deleteIdCardsByPerson(personType: 'student' | 'teacher', personId: string): Promise<void> {
    await db.delete(idCards).where(
      and(
        eq(idCards.personType, personType),
        eq(idCards.personId, personId)
      )
    );
  }

  // ==================== CERTIFICATE TEMPLATES ====================

  async getCertificateTemplates(schoolId: string, category?: string): Promise<CertificateTemplate[]> {
    const conditions = [eq(certificateTemplates.schoolId, schoolId)];
    
    if (category) {
      conditions.push(eq(certificateTemplates.category, category));
    }

    return await db
      .select()
      .from(certificateTemplates)
      .where(and(...conditions))
      .orderBy(desc(certificateTemplates.isDefault), certificateTemplates.name);
  }

  async getCertificateTemplate(id: string): Promise<CertificateTemplate | undefined> {
    const [template] = await db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.id, id));
    return template;
  }

  async createCertificateTemplate(template: InsertCertificateTemplate): Promise<CertificateTemplate> {
    // If setting as default, unset other defaults of same category
    if (template.isDefault && template.category) {
      await db
        .update(certificateTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(certificateTemplates.schoolId, template.schoolId),
            eq(certificateTemplates.category, template.category)
          )
        );
    }

    const [created] = await db
      .insert(certificateTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateCertificateTemplate(id: string, template: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate> {
    // If setting as default, unset other defaults
    if (template.isDefault) {
      const current = await this.getCertificateTemplate(id);
      if (current && current.category) {
        await db
          .update(certificateTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(certificateTemplates.schoolId, current.schoolId),
              eq(certificateTemplates.category, current.category),
              ne(certificateTemplates.id, id)
            )
          );
      }
    }

    const [updated] = await db
      .update(certificateTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteCertificateTemplate(id: string): Promise<void> {
    await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id));
  }

  // ==================== CERTIFICATES ====================

  async getCertificates(schoolId: string, filters?: { 
    recipientType?: 'student' | 'teacher' | 'other';
    recipientId?: string;
    eventName?: string;
  }): Promise<Certificate[]> {
    const conditions = [eq(certificates.schoolId, schoolId)];
    
    if (filters?.recipientType) {
      conditions.push(eq(certificates.recipientType, filters.recipientType));
    }
    if (filters?.recipientId) {
      conditions.push(eq(certificates.recipientId, filters.recipientId));
    }
    if (filters?.eventName) {
      conditions.push(eq(certificates.eventName, filters.eventName));
    }

    return await db
      .select()
      .from(certificates)
      .where(and(...conditions))
      .orderBy(desc(certificates.createdAt));
  }

  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id));
    return certificate;
  }

  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [created] = await db
      .insert(certificates)
      .values(certificate)
      .returning();
    return created;
  }

  async updateCertificate(id: string, certificate: Partial<InsertCertificate>): Promise<Certificate> {
    const [updated] = await db
      .update(certificates)
      .set({ ...certificate, updatedAt: new Date() })
      .where(eq(certificates.id, id))
      .returning();
    return updated;
  }

  async deleteCertificate(id: string): Promise<void> {
    await db.delete(certificates).where(eq(certificates.id, id));
  }

  async getClassesForClassTeacher(teacherId: string, schoolId: string, academicSessionId?: string): Promise<Class[]> {
    const conditions = [
      eq(classTeacherAssignments.teacherId, teacherId),
      eq(classTeacherAssignments.schoolId, schoolId),
      eq(classTeacherAssignments.isActive, true),
      eq(classTeacherAssignments.isPrimary, true), // Only primary class teachers
    ];

    if (academicSessionId) {
      conditions.push(eq(classTeacherAssignments.academicSessionId, academicSessionId));
    }

    const assignments = await db
      .select({
        class: classes,
      })
      .from(classTeacherAssignments)
      .innerJoin(classes, eq(classes.id, classTeacherAssignments.classId))
      .where(and(...conditions));

    return assignments.map(a => a.class);
  }
}

export const storage = new DatabaseStorage();