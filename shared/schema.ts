import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  uuid,
  index,
  uniqueIndex,
  date,
  check,
  unique,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Academic Sessions table
export const academicSessions = pgTable("academic_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(), // e.g., 2025-04-01
  endDate: date("end_date").notNull(), // e.g., 2026-03-31
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure end date is after start date
  endDateAfterStartDate: check("end_date_after_start_date", sql`${table.endDate} > ${table.startDate}`),
  // Index for efficient queries
  schoolDateIdx: index("academic_sessions_school_date_idx").on(table.schoolId, table.startDate, table.endDate),
  // Unique constraint: one session per school per start date
  uniqueSchoolSession: unique("unique_school_session").on(table.schoolId, table.startDate),
}));

// Schools table
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  contactPhone: varchar("contact_phone", { length: 15 }),
  adminName: varchar("admin_name", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  timetableFrozen: boolean("timetable_frozen").notNull().default(false),
  defaultMaxPeriodsPerDay: integer("default_max_periods_per_day").notNull().default(6),
  openaiApiKey: text("openai_api_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// School Settings table - for persistent configuration storage
export const schoolSettings = pgTable("school_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  settingKey: varchar("setting_key", { length: 100 }).notNull(),
  settingValue: jsonb("setting_value").$type<{
    // Timetable generation settings - AI Smart Timetable only
    timetableGenerationMode?: 'ai_smart';
    generationStrategy?: 'individual' | 'staged_hybrid' | 'lightweight_bulk';
    autoOptimization?: boolean;
    conflictResolution?: 'manual' | 'auto';
    // Other school-wide settings can be added here
    [key: string]: any;
  }>().notNull(),
  category: varchar("category", { 
    enum: ["timetable", "academic", "admin", "notification", "integration"] 
  }).notNull().default("admin"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  lastModifiedBy: varchar("last_modified_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure unique setting per school
  schoolSettingIdx: unique("school_setting_unique").on(table.schoolId, table.settingKey),
  // Index for efficient queries
  schoolCategoryIdx: index("school_settings_school_category_idx").on(table.schoolId, table.category),
}));

// Users table - Extended for RBAC system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }),
  loginId: varchar("login_id", { length: 255 }).notNull().unique(), // Employee ID, Admission Number, or P+AdmissionNumber
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  temporaryPassword: varchar("temporary_password", { length: 255 }), // Hashed temporary password
  temporaryPasswordPlainText: varchar("temporary_password_plain_text", { length: 255 }), // Plain text for admin sharing (cleared on first login)
  temporaryPasswordExpiresAt: timestamp("temporary_password_expires_at"), // Expiry timestamp for temporary password
  role: varchar("role", { enum: ["super_admin", "admin", "teacher", "student", "parent"] }).notNull().default("teacher"),
  customRoleId: uuid("custom_role_id").references(() => customRoles.id, { onDelete: "set null" }), // Optional custom role assignment
  isFirstLogin: boolean("is_first_login").notNull().default(true), // Force password change on first login
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),  
  parentId: uuid("parent_id").references(() => parents.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  passwordChangedAt: timestamp("password_changed_at"),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // Self-reference to user who created this user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Preferences table - for storing user-specific preferences
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userKeyIdx: unique("user_preferences_user_key_unique").on(table.userId, table.key),
}));

// Students table
export const students = pgTable("students", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionNumber: varchar("admission_number", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  contactNumber: varchar("contact_number", { length: 15 }),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { enum: ["male", "female", "other"] }),
  address: text("address"),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  rollNumber: varchar("roll_number", { length: 20 }),
  bloodGroup: varchar("blood_group", { length: 5 }),
  guardianName: varchar("guardian_name", { length: 255 }),
  guardianRelation: varchar("guardian_relation", { length: 50 }),
  guardianContact: varchar("guardian_contact", { length: 15 }),
  emergencyContact: varchar("emergency_contact", { length: 15 }),
  medicalInfo: text("medical_info"),
  profilePictureUrl: varchar("profile_picture_url", { length: 500 }), // Path to profile picture
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { enum: ["active", "inactive", "graduated", "transferred"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Parents table
export const parents = pgTable("parents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  contactNumber: varchar("contact_number", { length: 15 }).notNull(),
  alternateContact: varchar("alternate_contact", { length: 15 }),
  address: text("address").notNull(),
  occupation: varchar("occupation", { length: 255 }),
  relationToStudent: varchar("relation_to_student", { enum: ["father", "mother", "guardian", "other"] }).notNull(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student-Parent relationship table (many-to-many)
export const studentParents = pgTable("student_parents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").notNull().references(() => parents.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false), // Primary contact parent
  createdAt: timestamp("created_at").defaultNow(),
});

// System modules table (for RBAC)
export const systemModules = pgTable("system_modules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  routePath: varchar("route_path", { length: 500 }), // Frontend route path
  category: varchar("category", { length: 100 }), // Group modules by category
  icon: varchar("icon", { length: 100 }), // Icon name for UI
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0), // For ordering in UI
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Custom Roles table (school-specific custom roles)
export const customRoles = pgTable("custom_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Fee Manager", "Accountant"
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#6366f1"), // Badge color for UI
  basedOnRole: varchar("based_on_role", { enum: ["admin", "teacher", "student", "parent"] }).notNull().default("teacher"), // System role this extends
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one custom role name per school
  uniqueSchoolRole: unique("unique_school_custom_role").on(table.schoolId, table.name),
}));

// User Custom Roles junction table (many-to-many: users can have multiple custom roles)
export const userCustomRoles = pgTable("user_custom_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customRoleId: uuid("custom_role_id").notNull().references(() => customRoles.id, { onDelete: "cascade" }),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Admin who assigned
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one assignment per user-role combination
  uniqueUserRole: unique("unique_user_custom_role").on(table.userId, table.customRoleId),
}));

// Role permissions table (defines what modules each role can access per school)
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  role: varchar("role", { enum: ["admin", "teacher", "student", "parent"] }),
  customRoleId: uuid("custom_role_id").references(() => customRoles.id, { onDelete: "cascade" }), // For custom roles
  moduleId: uuid("module_id").notNull().references(() => systemModules.id, { onDelete: "cascade" }),
  permissions: jsonb("permissions").$type<{
    read: boolean;
    write: boolean;
    delete: boolean;
    export: boolean;
  }>().notNull().default(sql`'{"read": true, "write": false, "delete": false, "export": false}'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Super admin who assigned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure either role or customRoleId is set (but not both)
  roleOrCustomRoleCheck: check("role_or_custom_role_check", 
    sql`(${table.role} IS NOT NULL AND ${table.customRoleId} IS NULL) OR (${table.role} IS NULL AND ${table.customRoleId} IS NOT NULL)`
  ),
}));

// Teachers table - Extended for RBAC
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 50 }).notNull().unique(), // Used for login
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  contactNumber: varchar("contact_number", { length: 15 }),
  schoolIdNumber: varchar("school_id_number", { length: 50 }),
  
  // New fields from the redesign
  aadhar: varchar("aadhar", { length: 12 }), // Aadhar number
  gender: varchar("gender", { enum: ["male", "female", "other"] }),
  bloodGroup: varchar("blood_group", { length: 5 }), // A+, B-, O+, etc.
  designation: varchar("designation", { length: 100 }), // Teacher designation/position
  dateOfBirth: date("date_of_birth"),
  fatherHusbandName: varchar("father_husband_name", { length: 255 }),
  address: text("address"),
  category: varchar("category", { length: 50 }), // general, obc, sc, st, etc.
  religion: varchar("religion", { length: 50 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 500 }), // Path to profile picture
  
  classes: jsonb("classes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  availability: jsonb("availability").$type<{
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }>().notNull().default(sql`'{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":true,"sunday":false}'::jsonb`),
  maxDailyPeriods: integer("max_daily_periods").notNull().default(6), // Maximum periods per day
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { enum: ["active", "inactive", "left_school"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  periodsPerWeek: integer("periods_per_week").notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Classes table
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  grade: varchar("grade", { length: 50 }).notNull(),
  section: varchar("section", { length: 10 }).notNull(),
  studentCount: integer("student_count").notNull().default(0),
  requiredSubjects: jsonb("required_subjects").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }),
  room: varchar("room", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Class Subject Assignments with weekly frequency
export const classSubjectAssignments = pgTable("class_subject_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  weeklyFrequency: integer("weekly_frequency").notNull(), // How many periods per week
  assignedTeacherId: uuid("assigned_teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable entries
export const timetableEntries = pgTable("timetable_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  day: varchar("day", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] }).notNull(),
  period: integer("period").notNull(), // 1-8 for different time slots
  startTime: varchar("start_time", { length: 5 }).notNull(), // "09:00"
  endTime: varchar("end_time", { length: 5 }).notNull(), // "09:45"
  room: varchar("room", { length: 100 }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable validity periods table
export const timetableValidityPeriods = pgTable("timetable_validity_periods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable Changes table - for tracking all modifications
export const timetableChanges = pgTable("timetable_changes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timetableEntryId: uuid("timetable_entry_id").notNull().references(() => timetableEntries.id, { onDelete: "cascade" }),
  changeType: varchar("change_type", { enum: ["cancellation", "room_change", "time_change", "incremental_update"] }).notNull(),
  changeDate: date("change_date").notNull(),
  originalTeacherId: uuid("original_teacher_id").references(() => teachers.id),
  newTeacherId: uuid("new_teacher_id").references(() => teachers.id),
  originalRoom: varchar("original_room", { length: 100 }),
  newRoom: varchar("new_room", { length: 100 }),
  reason: text("reason").notNull(),
  changeSource: varchar("change_source", { enum: ["manual", "auto_absence", "incremental_update"] }).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").notNull().default(true),
  viewedBy: jsonb("viewed_by").$type<string[]>().default(sql`'[]'::jsonb`), // Track which admins have viewed this notification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Incremental Change Requests table - for tracking incremental update requests
export const incrementalChangeRequests = pgTable("incremental_change_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  requestType: varchar("request_type", { 
    enum: ["add_class", "update_subject", "reassign_teacher", "add_subject", "remove_subject", "update_class_schedule"] 
  }).notNull(),
  entityId: uuid("entity_id").notNull(), // ID of class, subject, or teacher being changed
  entityType: varchar("entity_type", { enum: ["class", "subject", "teacher", "assignment"] }).notNull(),
  changeDetails: jsonb("change_details").$type<{
    // For add_class
    className?: string;
    grade?: string;
    section?: string;
    academicSessionId?: string;
    // For update_subject
    subjectChanges?: { [key: string]: any };
    // For reassign_teacher
    oldTeacherId?: string;
    newTeacherId?: string;
    affectedClassIds?: string[];
    // For scheduling changes
    scheduleChanges?: {
      classId: string;
      subjectId: string;
      weeklyFrequency?: number;
      teacherId?: string;
    }[];
  }>().notNull(),
  status: varchar("status", { enum: ["pending", "processing", "completed", "failed", "cancelled"] }).notNull().default("pending"),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  affectedEntries: jsonb("affected_entries").$type<string[]>().default(sql`'[]'::jsonb`), // Timetable entry IDs affected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolStatusIdx: index("incremental_requests_school_status_idx").on(table.schoolId, table.status),
  entityTypeIdx: index("incremental_requests_entity_type_idx").on(table.entityType, table.entityId),
}));

// Conflict Detection Results table - for tracking detected conflicts and resolutions
export const conflictDetectionResults = pgTable("conflict_detection_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: uuid("change_request_id").notNull().references(() => incrementalChangeRequests.id, { onDelete: "cascade" }),
  conflictType: varchar("conflict_type", { 
    enum: ["teacher_overlap", "classroom_conflict", "subject_frequency", "teacher_capacity", "time_constraint"] 
  }).notNull(),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  conflictDetails: jsonb("conflict_details").$type<{
    description: string;
    affectedTeachers?: string[];
    affectedClasses?: string[];
    affectedTimeSlots?: { day: string; period: number }[];
    currentAssignments?: { teacherId: string; classId: string; subjectId: string; day: string; period: number }[];
    proposedResolutions?: {
      type: string;
      description: string;
      action: string;
      requiredApproval: boolean;
    }[];
  }>().notNull(),
  resolutionStatus: varchar("resolution_status", { 
    enum: ["unresolved", "auto_resolved", "manual_resolution_needed", "resolved", "ignored"] 
  }).notNull().default("unresolved"),
  resolutionDetails: jsonb("resolution_details").$type<{
    strategy: string;
    appliedChanges?: { [key: string]: any };
    manualActions?: string[];
    resolvedBy?: string;
  }>(),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  requestConflictIdx: index("conflict_request_idx").on(table.changeRequestId),
  severityStatusIdx: index("conflict_severity_status_idx").on(table.severity, table.resolutionStatus),
}));

// Change Impact Analysis table - for tracking the scope of changes
export const changeImpactAnalysis = pgTable("change_impact_analysis", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: uuid("change_request_id").notNull().references(() => incrementalChangeRequests.id, { onDelete: "cascade" }),
  impactScope: varchar("impact_scope", { enum: ["single_class", "multiple_classes", "school_wide", "teacher_specific"] }).notNull(),
  impactLevel: varchar("impact_level", { enum: ["minimal", "moderate", "significant", "major"] }).notNull(),
  affectedEntities: jsonb("affected_entities").$type<{
    classes: { id: string; name: string; impactType: string }[];
    teachers: { id: string; name: string; impactType: string }[];
    subjects: { id: string; name: string; impactType: string }[];
    timetableEntries: { id: string; impactType: string }[];
  }>().notNull(),
  estimatedProcessingTime: integer("estimated_processing_time"), // in minutes
  requiresFullRegeneration: boolean("requires_full_regeneration").notNull().default(false),
  generationStrategy: varchar("generation_strategy", { 
    enum: ["incremental_only", "hybrid_targeted", "full_regeneration"] 
  }).notNull().default("incremental_only"),
  recommendations: jsonb("recommendations").$type<{
    suggestedApproach: string;
    alternativeOptions?: string[];
    riskFactors?: string[];
    prerequisites?: string[];
  }>(),
  analysisResults: jsonb("analysis_results").$type<{
    conflictsDetected: number;
    entriesAffected: number;
    teachersAffected: number;
    classesAffected: number;
    estimatedSuccessRate: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  requestImpactIdx: index("impact_request_idx").on(table.changeRequestId),
  scopeLevelIdx: index("impact_scope_level_idx").on(table.impactScope, table.impactLevel),
}));

// Timetable Structure table
export const timetableStructures = pgTable("timetable_structures", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  periodsPerDay: integer("periods_per_day").notNull().default(8),
  workingDays: jsonb("working_days").$type<string[]>().notNull().default(sql`'["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb`),
  timeSlots: jsonb("time_slots").$type<{
    period: number;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
  }[]>().notNull().default(sql`'[{"period":1,"startTime":"07:30","endTime":"08:15"},{"period":2,"startTime":"08:15","endTime":"09:00"},{"period":3,"startTime":"09:00","endTime":"09:45"},{"period":4,"startTime":"09:45","endTime":"10:15"},{"period":5,"startTime":"10:15","endTime":"11:00","isBreak":true},{"period":6,"startTime":"11:00","endTime":"11:45"},{"period":7,"startTime":"11:45","endTime":"12:30"},{"period":8,"startTime":"12:30","endTime":"13:15"}]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly Timetables table - stores admin-modified weekly timetable snapshots
export const weeklyTimetables = pgTable("weekly_timetables", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(), // Monday of the week
  weekEnd: date("week_end").notNull(), // Sunday of the week  
  timetableData: jsonb("timetable_data").$type<{
    day: string;
    period: number;
    teacherId: string | null; // null for cancelled periods
    subjectId: string | null; // null for cancelled periods
    startTime: string;
    endTime: string;
    room: string | null;
    isModified: boolean; // true if different from global timetable
    modificationReason?: string;
  }[]>().notNull().default(sql`'[]'::jsonb`),
  modifiedBy: varchar("modified_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  modificationCount: integer("modification_count").notNull().default(1), // Track number of changes made
  basedOnGlobalVersion: varchar("based_on_global_version"), // Track which global version this was based on
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure only one active weekly timetable per class per week
  classWeekIdx: index("class_week_idx").on(table.classId, table.weekStart),
  // Unique constraint to prevent duplicate weekly timetables
  uniqueWeeklyTimetable: unique("unique_weekly_timetable").on(table.classId, table.weekStart, table.weekEnd),
}));

// Class Teacher Assignments table - for Primary/Co-Class Teacher management
export const classTeacherAssignments = pgTable("class_teacher_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  role: varchar("role", { enum: ["primary", "co_class"] }).notNull(), // primary = Primary Class Teacher, co_class = Co-Class Teacher
  isPrimary: boolean("is_primary").notNull().default(false), // Only one primary teacher per class
  privileges: jsonb("privileges").$type<{
    attendance: boolean;
    classFeedPosting: boolean;
    parentCommunication: boolean;
    leaveApproval: boolean;
  }>().notNull().default(sql`'{"attendance": true, "classFeedPosting": true, "parentCommunication": true, "leaveApproval": true}'::jsonb`),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }), // School admin who assigned
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teacher attendance table
export const teacherAttendance = pgTable("teacher_attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: varchar("status", { enum: ["present", "absent", "late", "on_leave", "medical_leave", "personal_leave"] }).notNull().default("present"),
  reason: text("reason"), // Reason for absence or leave
  leaveStartDate: date("leave_start_date"), // For multi-day leave tracking
  leaveEndDate: date("leave_end_date"), // For multi-day leave tracking
  isFullDay: boolean("is_full_day").notNull().default(true), // For half-day leaves
  markedBy: varchar("marked_by").references(() => users.id), // Who marked the attendance
  markedAt: timestamp("marked_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one attendance record per teacher per day per school
  teacherDateUnique: uniqueIndex("teacher_attendance_unique_idx")
    .on(table.teacherId, table.schoolId, table.attendanceDate),
}));

// Teacher Leave Applications table - For formal leave request workflow
export const leaveApplications = pgTable("leave_applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  leaveType: varchar("leave_type", { enum: ["medical", "personal", "casual", "maternity", "paternity", "emergency"] }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }), // Admin who approved/rejected
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Admin's notes when approving/rejecting
  attachmentUrl: text("attachment_url"), // Optional medical certificate or other documents
  appliedAt: timestamp("applied_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for efficient queries
  teacherIdx: index("leave_applications_teacher_idx").on(table.teacherId),
  statusIdx: index("leave_applications_status_idx").on(table.status),
  schoolStatusIdx: index("leave_applications_school_status_idx").on(table.schoolId, table.status),
  dateRangeIdx: index("leave_applications_date_range_idx").on(table.startDate, table.endDate),
}));

// Teacher Substitutions table - For managing teacher replacements
export const teacherSubstitutions = pgTable("teacher_substitutions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalTeacherId: uuid("original_teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  substituteTeacherId: uuid("substitute_teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // Specific date of substitution
  period: integer("period").notNull(), // Which period (1-10)
  dayOfWeek: varchar("day_of_week", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM format
  endTime: varchar("end_time", { length: 5 }).notNull(), // HH:MM format
  reason: varchar("reason", { enum: ["absent", "leave"] }).notNull(),
  status: varchar("status", { enum: ["pending", "suggested", "assigned", "completed", "cancelled"] }).notNull().default("pending"),
  suggestedSubstitutes: jsonb("suggested_substitutes").$type<Array<{
    teacherId: string;
    teacherName: string;
    score: number;
    reasons: string[];
  }>>(),
  assignedBy: varchar("assigned_by").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at"),
  notes: text("notes"),
  teacherAttendanceId: uuid("teacher_attendance_id").references(() => teacherAttendance.id, { onDelete: "cascade" }), // Link to attendance record
  viewedBy: jsonb("viewed_by").$type<string[]>().default(sql`'[]'::jsonb`), // Track which admins have viewed this notification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for efficient queries
  dateIdx: index("teacher_substitutions_date_idx").on(table.date),
  statusIdx: index("teacher_substitutions_status_idx").on(table.status),
  schoolDateIdx: index("teacher_substitutions_school_date_idx").on(table.schoolId, table.date),
  originalTeacherIdx: index("teacher_substitutions_original_teacher_idx").on(table.originalTeacherId),
  substituteTeacherIdx: index("teacher_substitutions_substitute_teacher_idx").on(table.substituteTeacherId),
  // Partial unique index to prevent duplicate active substitutions (prevents race conditions)
  activeSubstitutionUnique: uniqueIndex("teacher_substitutions_active_unique")
    .on(table.originalTeacherId, table.date, table.period, table.classId)
    .where(sql`${table.status} IN ('pending', 'suggested', 'assigned')`),
}));

// Student attendance table
export const studentAttendance = pgTable("student_attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: varchar("status", { enum: ["present", "absent", "late", "excused"] }).notNull().default("present"),
  reason: text("reason"), // Reason for absence
  markedBy: varchar("marked_by").references(() => users.id), // Who marked the attendance
  markedAt: timestamp("marked_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit logs table for tracking changes
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(), // CREATE, UPDATE, DELETE
  entityType: varchar("entity_type", { length: 50 }).notNull(), // TEACHER, TIMETABLE_ENTRY
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table for direct messaging between students, teachers, parents, and admins
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  senderType: varchar("sender_type", { enum: ["student", "teacher", "parent", "admin"] }).notNull(),
  senderId: uuid("sender_id").notNull(), // References students.id, teachers.id, parents.id, or users.id (for admin) based on senderType
  receiverType: varchar("receiver_type", { enum: ["student", "teacher", "parent", "admin"] }).notNull(),
  receiverId: uuid("receiver_id").notNull(), // References students.id, teachers.id, parents.id, or users.id (for admin) based on receiverType
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for efficient conversation queries (sender + receiver + time)
  conversationIdx: index("messages_conversation_idx").on(table.schoolId, table.senderType, table.senderId, table.receiverType, table.receiverId, table.createdAt),
  // Index for unread message queries
  unreadIdx: index("messages_unread_idx").on(table.receiverType, table.receiverId, table.isRead, table.schoolId),
  // Index for sender message history
  senderIdx: index("messages_sender_idx").on(table.senderType, table.senderId, table.schoolId, table.createdAt),
}));

// Notifications table for system notifications to users
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull(), // References users.id, students.id, teachers.id, or parents.id based on recipientRole
  recipientRole: varchar("recipient_role", { enum: ["student", "teacher", "parent", "admin"] }).notNull(),
  type: varchar("type", { 
    enum: [
      // Teacher notifications
      "leave_applied",
      "leave_approved", 
      "leave_rejected", 
      "schedule_generated", 
      "class_assigned", 
      "substitution_assigned", 
      "class_teacher_assigned", 
      "school_feed_post",
      // Student/Parent notifications
      "circular_posted",
      "resource_posted",
      "student_absent",
      "report_card_generated",
      "fee_overdue",
      "student_leave_approved",
      "student_leave_rejected",
      // General
      "system"
    ] 
  }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Additional context (e.g., classId, leaveId, postId)
  actionUrl: varchar("action_url", { length: 500 }), // Optional URL to navigate to
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Index for efficient recipient queries
  recipientIdx: index("notifications_recipient_idx").on(table.recipientRole, table.recipientId, table.isRead, table.createdAt),
  // Index for school-wide queries
  schoolIdx: index("notifications_school_idx").on(table.schoolId, table.createdAt),
  // Index for unread notifications
  unreadIdx: index("notifications_unread_idx").on(table.recipientId, table.recipientRole, table.isRead),
}));

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  teachers: many(teachers),
  students: many(students),
  parents: many(parents),
  subjects: many(subjects),
  classes: many(classes),
  timetableStructures: many(timetableStructures),
  weeklyTimetables: many(weeklyTimetables),
  rolePermissions: many(rolePermissions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  teacher: one(teachers, {
    fields: [users.teacherId],
    references: [teachers.id],
  }),
  student: one(students, {
    fields: [users.studentId],
    references: [students.id],
  }),
  parent: one(parents, {
    fields: [users.parentId],
    references: [parents.id],
  }),
  customRole: one(customRoles, {
    fields: [users.customRoleId],
    references: [customRoles.id],
  }),
  createdByUser: one(users, {
    fields: [users.createdBy],
    references: [users.id],
  }),
  userCustomRoles: many(userCustomRoles),
  sentMessages: many(messages, { relationName: "senderMessages" }),
  receivedMessages: many(messages, { relationName: "receiverMessages" }),
}));

// Messages relations
export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "senderMessages",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiverMessages",
  }),
  school: one(schools, {
    fields: [messages.schoolId],
    references: [schools.id],
  }),
}));

// New RBAC relations
export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  user: one(users),
  studentParents: many(studentParents),
  attendanceRecords: many(studentAttendance),
}));

export const parentsRelations = relations(parents, ({ one, many }) => ({
  school: one(schools, {
    fields: [parents.schoolId],
    references: [schools.id],
  }),
  user: one(users),
  studentParents: many(studentParents),
}));

export const studentParentsRelations = relations(studentParents, ({ one }) => ({
  student: one(students, {
    fields: [studentParents.studentId],
    references: [students.id],
  }),
  parent: one(parents, {
    fields: [studentParents.parentId],
    references: [parents.id],
  }),
}));

export const systemModulesRelations = relations(systemModules, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  school: one(schools, {
    fields: [customRoles.schoolId],
    references: [schools.id],
  }),
  createdByUser: one(users, {
    fields: [customRoles.createdBy],
    references: [users.id],
  }),
  rolePermissions: many(rolePermissions),
  userCustomRoles: many(userCustomRoles),
}));

export const userCustomRolesRelations = relations(userCustomRoles, ({ one }) => ({
  user: one(users, {
    fields: [userCustomRoles.userId],
    references: [users.id],
  }),
  customRole: one(customRoles, {
    fields: [userCustomRoles.customRoleId],
    references: [customRoles.id],
  }),
  assignedByUser: one(users, {
    fields: [userCustomRoles.assignedBy],
    references: [users.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  school: one(schools, {
    fields: [rolePermissions.schoolId],
    references: [schools.id],
  }),
  module: one(systemModules, {
    fields: [rolePermissions.moduleId],
    references: [systemModules.id],
  }),
  customRole: one(customRoles, {
    fields: [rolePermissions.customRoleId],
    references: [customRoles.id],
  }),
  assignedByUser: one(users, {
    fields: [rolePermissions.assignedBy],
    references: [users.id],
  }),
}));

export const teachersRelations = relations(teachers, ({ one, many }) => ({
  school: one(schools, {
    fields: [teachers.schoolId],
    references: [schools.id],
  }),
  user: one(users),
  timetableEntries: many(timetableEntries),
  attendanceRecords: many(teacherAttendance),
  classTeacherAssignments: many(classTeacherAssignments),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, {
    fields: [subjects.schoolId],
    references: [schools.id],
  }),
  timetableEntries: many(timetableEntries),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  students: many(students),
  timetableEntries: many(timetableEntries),
  timetableValidityPeriods: many(timetableValidityPeriods),
  classSubjectAssignments: many(classSubjectAssignments),
  weeklyTimetables: many(weeklyTimetables),
  classTeacherAssignments: many(classTeacherAssignments),
  studentAttendanceRecords: many(studentAttendance),
}));

export const classSubjectAssignmentsRelations = relations(classSubjectAssignments, ({ one }) => ({
  class: one(classes, {
    fields: [classSubjectAssignments.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [classSubjectAssignments.subjectId],
    references: [subjects.id],
  }),
  assignedTeacher: one(teachers, {
    fields: [classSubjectAssignments.assignedTeacherId],
    references: [teachers.id],
  }),
}));

export const timetableEntriesRelations = relations(timetableEntries, ({ one, many }) => ({
  class: one(classes, {
    fields: [timetableEntries.classId],
    references: [classes.id],
  }),
  teacher: one(teachers, {
    fields: [timetableEntries.teacherId],
    references: [teachers.id],
  }),
  subject: one(subjects, {
    fields: [timetableEntries.subjectId],
    references: [subjects.id],
  }),
}));

export const timetableChangesRelations = relations(timetableChanges, ({ one }) => ({
  timetableEntry: one(timetableEntries, {
    fields: [timetableChanges.timetableEntryId],
    references: [timetableEntries.id],
  }),
  originalTeacher: one(teachers, {
    fields: [timetableChanges.originalTeacherId],
    references: [teachers.id],
    relationName: "originalTeacher",
  }),
  newTeacher: one(teachers, {
    fields: [timetableChanges.newTeacherId],
    references: [teachers.id],
    relationName: "newTeacher",
  }),
  approver: one(users, {
    fields: [timetableChanges.approvedBy],
    references: [users.id],
  }),
}));

export const timetableValidityPeriodsRelations = relations(timetableValidityPeriods, ({ one }) => ({
  class: one(classes, {
    fields: [timetableValidityPeriods.classId],
    references: [classes.id],
  }),
}));

export const timetableStructuresRelations = relations(timetableStructures, ({ one }) => ({
  school: one(schools, {
    fields: [timetableStructures.schoolId],
    references: [schools.id],
  }),
}));

export const teacherAttendanceRelations = relations(teacherAttendance, ({ one }) => ({
  teacher: one(teachers, {
    fields: [teacherAttendance.teacherId],
    references: [teachers.id],
  }),
  school: one(schools, {
    fields: [teacherAttendance.schoolId],
    references: [schools.id],
  }),
  markedByUser: one(users, {
    fields: [teacherAttendance.markedBy],
    references: [users.id],
  }),
}));

export const leaveApplicationsRelations = relations(leaveApplications, ({ one }) => ({
  teacher: one(teachers, {
    fields: [leaveApplications.teacherId],
    references: [teachers.id],
  }),
  school: one(schools, {
    fields: [leaveApplications.schoolId],
    references: [schools.id],
  }),
  reviewer: one(users, {
    fields: [leaveApplications.reviewedBy],
    references: [users.id],
  }),
}));

export const teacherSubstitutionsRelations = relations(teacherSubstitutions, ({ one }) => ({
  originalTeacher: one(teachers, {
    fields: [teacherSubstitutions.originalTeacherId],
    references: [teachers.id],
    relationName: "original_teacher",
  }),
  substituteTeacher: one(teachers, {
    fields: [teacherSubstitutions.substituteTeacherId],
    references: [teachers.id],
    relationName: "substitute_teacher",
  }),
  class: one(classes, {
    fields: [teacherSubstitutions.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [teacherSubstitutions.subjectId],
    references: [subjects.id],
  }),
  school: one(schools, {
    fields: [teacherSubstitutions.schoolId],
    references: [schools.id],
  }),
  assignedByUser: one(users, {
    fields: [teacherSubstitutions.assignedBy],
    references: [users.id],
  }),
  teacherAttendance: one(teacherAttendance, {
    fields: [teacherSubstitutions.teacherAttendanceId],
    references: [teacherAttendance.id],
  }),
}));

export const studentAttendanceRelations = relations(studentAttendance, ({ one }) => ({
  student: one(students, {
    fields: [studentAttendance.studentId],
    references: [students.id],
  }),
  school: one(schools, {
    fields: [studentAttendance.schoolId],
    references: [schools.id],
  }),
  class: one(classes, {
    fields: [studentAttendance.classId],
    references: [classes.id],
  }),
  markedByUser: one(users, {
    fields: [studentAttendance.markedBy],
    references: [users.id],
  }),
}));

export const classTeacherAssignmentsRelations = relations(classTeacherAssignments, ({ one }) => ({
  class: one(classes, {
    fields: [classTeacherAssignments.classId],
    references: [classes.id],
  }),
  teacher: one(teachers, {
    fields: [classTeacherAssignments.teacherId],
    references: [teachers.id],
  }),
  school: one(schools, {
    fields: [classTeacherAssignments.schoolId],
    references: [schools.id],
  }),
  assignedByUser: one(users, {
    fields: [classTeacherAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools, {
    fields: [auditLogs.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const weeklyTimetablesRelations = relations(weeklyTimetables, ({ one }) => ({
  class: one(classes, {
    fields: [weeklyTimetables.classId],
    references: [classes.id],
  }),
  school: one(schools, {
    fields: [weeklyTimetables.schoolId],
    references: [schools.id],
  }),
  modifiedByUser: one(users, {
    fields: [weeklyTimetables.modifiedBy],
    references: [users.id],
  }),
}));


// Insert schemas
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email or Login ID is required"), // Can be email or loginId (Employee ID, Admission Number, P+AdmissionNumber)
  password: z.string().min(6),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Messages insert schema
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notifications insert schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

// New RBAC insert schemas
export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertParentSchema = createInsertSchema(parents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudentParentSchema = createInsertSchema(studentParents).omit({
  id: true,
  createdAt: true,
});

export const insertSystemModuleSchema = createInsertSchema(systemModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomRoleSchema = createInsertSchema(customRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCustomRoleSchema = createInsertSchema(userCustomRoles).omit({
  id: true,
  assignedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for creating and assigning a subject to a class in one operation
export const createAndAssignSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(255, "Subject name too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").default("#3B82F6"),
  classId: z.string().uuid("Invalid class ID"),
  weeklyFrequency: z.number().min(1, "Weekly frequency must be at least 1").max(8, "Weekly frequency cannot exceed 8 periods"),
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => !data.section || !data.section.includes(","),
  "Section cannot contain commas. Each class-section combination must be separate."
);

export const updateClassSchema = createInsertSchema(classes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial().refine(
  (data) => !data.section || !data.section.includes(","),
  "Section cannot contain commas. Each class-section combination must be separate."
);

export const insertTimetableEntrySchema = createInsertSchema(timetableEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyTimetableSchema = createInsertSchema(weeklyTimetables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableChangeSchema = createInsertSchema(timetableChanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Incremental Change Request schemas
export const insertIncrementalChangeRequestSchema = createInsertSchema(incrementalChangeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Conflict Detection Result schemas
export const insertConflictDetectionResultSchema = createInsertSchema(conflictDetectionResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Change Impact Analysis schemas
export const insertChangeImpactAnalysisSchema = createInsertSchema(changeImpactAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableValidityPeriodSchema = createInsertSchema(timetableValidityPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClassSubjectAssignmentSchema = createInsertSchema(classSubjectAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableStructureSchema = createInsertSchema(timetableStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClassTeacherAssignmentSchema = createInsertSchema(classTeacherAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Manual Assignment Audit Log table - AFTER all other table definitions
export const manualAssignmentAudits = pgTable("manual_assignment_audits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timetableEntryId: uuid("timetable_entry_id").notNull(), // Remove foreign key constraint to allow audit logs of deleted entries
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  day: varchar("day", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] }).notNull(),
  period: integer("period").notNull(),
  oldTeacherId: uuid("old_teacher_id").references(() => teachers.id),
  newTeacherId: uuid("new_teacher_id").references(() => teachers.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").references(() => subjects.id),
  changeReason: text("change_reason").default("Manual assignment by admin"),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teacher Replacements table - For tracking permanent teacher replacements
export const teacherReplacements = pgTable("teacher_replacements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalTeacherId: uuid("original_teacher_id").notNull().references(() => teachers.id),
  replacementTeacherId: uuid("replacement_teacher_id").notNull().references(() => teachers.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  replacementDate: timestamp("replacement_date").notNull(),
  reason: text("reason").notNull(),
  affectedTimetableEntries: integer("affected_timetable_entries").notNull().default(0),
  conflictDetails: jsonb("conflict_details").$type<{
    hasConflicts: boolean;
    conflictEntries?: {
      day: string;
      period: number;
      existingClass: string;
      conflictingClass: string;
    }[];
  }>().notNull().default(sql`'{"hasConflicts": false}'::jsonb`),
  status: varchar("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  replacedBy: varchar("replaced_by").notNull().references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for teacherReplacements
export const teacherReplacementsRelations = relations(teacherReplacements, ({ one }) => ({
  originalTeacher: one(teachers, {
    fields: [teacherReplacements.originalTeacherId],
    references: [teachers.id],
    relationName: "originalTeacher",
  }),
  replacementTeacher: one(teachers, {
    fields: [teacherReplacements.replacementTeacherId],
    references: [teachers.id],
    relationName: "replacementTeacher",
  }),
  school: one(schools, {
    fields: [teacherReplacements.schoolId],
    references: [schools.id],
  }),
  replacedByUser: one(users, {
    fields: [teacherReplacements.replacedBy],
    references: [users.id],
  }),
}));

export const insertManualAssignmentAuditSchema = createInsertSchema(manualAssignmentAudits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherReplacementSchema = createInsertSchema(teacherReplacements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherAttendanceSchema = createInsertSchema(teacherAttendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  markedAt: true,
});

export const insertLeaveApplicationSchema = createInsertSchema(leaveApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  appliedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
});

export const insertTeacherSubstitutionSchema = createInsertSchema(teacherSubstitutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  suggestedSubstitutes: z.array(z.object({
    teacherId: z.string().uuid(),
    teacherName: z.string(),
    score: z.number(),
    reasons: z.array(z.string()),
  })).optional(),
});

export const insertStudentAttendanceSchema = createInsertSchema(studentAttendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  markedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Schema for updating teacher daily periods
export const updateTeacherDailyPeriodsSchema = z.object({
  teacherId: z.string().uuid().optional(),
  maxDailyPeriods: z.number().min(1).max(10),
  applyToAll: z.boolean().default(false), // If true, apply to all teachers in school
});

// Posts table for newsfeed system
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<Array<{fileId: string; filename: string; mimetype: string}>>().notNull().default(sql`'[]'::jsonb`), // Array of attachment objects
  postedById: varchar("posted_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  feedScope: varchar("feed_scope", { enum: ["school", "class"] }).notNull(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }), // Required for class feeds
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").references(() => academicSessions.id, { onDelete: "cascade" }), // Required for class posts, null for school posts
  isActive: boolean("is_active").notNull().default(true),
  isCircular: boolean("is_circular").notNull().default(false), // Mark post as circular
  isResource: boolean("is_resource").notNull().default(false), // Mark post as resource
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Post schemas
export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePostSchema = createInsertSchema(posts).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Academic Session schemas
export const insertAcademicSessionSchema = createInsertSchema(academicSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// FEE MANAGEMENT MODULE TABLES
// ============================================================================

// Fee types table - defines different types of fees
export const feeTypes = pgTable("fee_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(), // tuition, admission, exam, lab, transport, etc.
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // academic, transport, extracurricular, etc.
  isActive: boolean("is_active").notNull().default(true),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee structures table - templates for different grades/sections/categories
export const feeStructures = pgTable("fee_structures", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Grade 5 General Fee Structure"
  grade: varchar("grade", { length: 50 }).notNull(),
  section: varchar("section", { length: 10 }), // null means applies to all sections
  studentCategory: varchar("student_category", { length: 50 }).notNull().default("general"), // general, sc, st, obc, etc.
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee structure items - individual fee items within a structure
export const feeStructureItems = pgTable("fee_structure_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  feeStructureId: uuid("fee_structure_id").notNull().references(() => feeStructures.id, { onDelete: "cascade" }),
  feeTypeId: uuid("fee_type_id").notNull().references(() => feeTypes.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // amount in paise (multiply by 100 for rupees)
  frequency: varchar("frequency", { enum: ["one_time", "monthly", "quarterly", "annually"] }).notNull(),
  dueDate: date("due_date"), // specific due date for one-time fees
  dueDayOfMonth: integer("due_day_of_month"), // for recurring fees (1-28)
  isOptional: boolean("is_optional").notNull().default(false),
  lateFeeAmount: integer("late_fee_amount").default(0), // late fee in paise
  lateFeeDays: integer("late_fee_days").default(7), // days after which late fee applies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student fee assignments - assign fee structures to students with overrides
export const studentFeeAssignments = pgTable("student_fee_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  feeStructureId: uuid("fee_structure_id").notNull().references(() => feeStructures.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  discountPercentage: integer("discount_percentage").default(0), // 0-100
  discountAmount: integer("discount_amount").default(0), // fixed discount in paise
  discountReason: text("discount_reason"),
  isActive: boolean("is_active").notNull().default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee invoices - generated invoices for students
export const feeInvoices = pgTable("fee_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  totalAmount: integer("total_amount").notNull(), // total in paise
  discountAmount: integer("discount_amount").default(0), // total discount in paise
  netAmount: integer("net_amount").notNull(), // amount after discount in paise
  paidAmount: integer("paid_amount").default(0), // amount paid in paise
  balanceAmount: integer("balance_amount").notNull(), // remaining amount in paise
  dueDate: date("due_date").notNull(),
  status: varchar("status", { enum: ["draft", "finalized", "pending", "partial", "paid", "overdue", "cancelled"] }).notNull().default("draft"),
  paymentDueReminder: boolean("payment_due_reminder").notNull().default(false), // reminder sent flag
  lateFeeAmount: integer("late_fee_amount").default(0), // late fee applied in paise
  invoiceType: varchar("invoice_type", { enum: ["regular", "supplementary", "advance"] }).notNull().default("regular"),
  generatedBy: varchar("generated_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at").defaultNow(),
  finalizedBy: varchar("finalized_by").references(() => users.id, { onDelete: "cascade" }), // user who finalized the invoice
  finalizedAt: timestamp("finalized_at"), // timestamp when invoice was finalized
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee invoice items - line items in invoices
export const feeInvoiceItems = pgTable("fee_invoice_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  feeTypeId: uuid("fee_type_id").notNull().references(() => feeTypes.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  amount: integer("amount").notNull(), // amount in paise
  quantity: integer("quantity").notNull().default(1),
  discountAmount: integer("discount_amount").default(0), // discount for this item in paise
  netAmount: integer("net_amount").notNull(), // amount after discount in paise
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee payments - payment records
export const feePayments = pgTable("fee_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentNumber: varchar("payment_number", { length: 50 }).notNull().unique(),
  invoiceId: uuid("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // amount in paise
  paymentMethod: varchar("payment_method", { enum: ["cash", "cheque", "dd", "online", "bank_transfer", "upi"] }).notNull(),
  paymentMode: varchar("payment_mode", { enum: ["offline", "online"] }).notNull(),
  transactionId: varchar("transaction_id", { length: 255 }), // for online payments
  referenceNumber: varchar("reference_number", { length: 255 }), // cheque/dd number
  bankName: varchar("bank_name", { length: 255 }),
  paymentDate: date("payment_date").notNull(),
  status: varchar("status", { enum: ["pending", "completed", "failed", "cancelled"] }).notNull().default("completed"),
  notes: text("notes"),
  collectedBy: varchar("collected_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  collectedAt: timestamp("collected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee notifications - reminders and alerts
export const feeNotifications = pgTable("fee_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  notificationType: varchar("notification_type", { enum: ["due_reminder", "overdue_alert", "payment_confirmation", "late_fee_applied"] }).notNull(),
  message: text("message").notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 15 }),
  sendVia: jsonb("send_via").$type<string[]>().notNull().default(sql`'["portal"]'::jsonb`), // portal, email, sms
  status: varchar("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// TRANSPORT MANAGEMENT MODULE TABLES
// ============================================================================

// Transport routes - route definitions
export const transportRoutes = pgTable("transport_routes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  routeName: varchar("route_name", { length: 255 }).notNull(),
  routeCode: varchar("route_code", { length: 50 }).notNull().unique(),
  description: text("description"),
  startLocation: varchar("start_location", { length: 255 }).notNull(),
  endLocation: varchar("end_location", { length: 255 }).notNull(),
  totalDistance: integer("total_distance"), // in kilometers
  estimatedDuration: integer("estimated_duration"), // in minutes
  monthlyFee: integer("monthly_fee").notNull(), // fee in paise
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transport stops - stops on routes
export const transportStops = pgTable("transport_stops", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: uuid("route_id").notNull().references(() => transportRoutes.id, { onDelete: "cascade" }),
  stopName: varchar("stop_name", { length: 255 }).notNull(),
  stopOrder: integer("stop_order").notNull(), // sequence of stop on route
  location: varchar("location", { length: 500 }),
  pickupTime: varchar("pickup_time", { length: 5 }), // HH:MM format
  dropTime: varchar("drop_time", { length: 5 }), // HH:MM format
  landmark: varchar("landmark", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transport vehicles - bus/vehicle details
export const transportVehicles = pgTable("transport_vehicles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleNumber: varchar("vehicle_number", { length: 50 }).notNull().unique(),
  vehicleType: varchar("vehicle_type", { enum: ["bus", "van", "auto"] }).notNull().default("bus"),
  capacity: integer("capacity").notNull(),
  driverName: varchar("driver_name", { length: 255 }).notNull(),
  driverContact: varchar("driver_contact", { length: 15 }).notNull(),
  driverLicense: varchar("driver_license", { length: 50 }),
  conductorName: varchar("conductor_name", { length: 255 }),
  conductorContact: varchar("conductor_contact", { length: 15 }),
  fitnessExpiry: date("fitness_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  permitExpiry: date("permit_expiry"),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { enum: ["active", "maintenance", "inactive"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transport route assignments - assign vehicles to routes
export const transportRouteAssignments = pgTable("transport_route_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: uuid("route_id").notNull().references(() => transportRoutes.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull().references(() => transportVehicles.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assignedFrom: date("assigned_from").notNull(),
  assignedTo: date("assigned_to"),
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transport student assignments - assign students to routes and stops
export const transportStudentAssignments = pgTable("transport_student_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  routeId: uuid("route_id").notNull().references(() => transportRoutes.id, { onDelete: "cascade" }),
  stopId: uuid("stop_id").notNull().references(() => transportStops.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assignedFrom: date("assigned_from").notNull(),
  assignedTo: date("assigned_to"), // null means ongoing
  transportType: varchar("transport_type", { enum: ["pickup_only", "drop_only", "both"] }).notNull().default("both"),
  monthlyFee: integer("monthly_fee").notNull(), // fee in paise, can be overridden per student
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// CALENDAR EVENTS - School Calendar Module
// ============================================================================

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: varchar("event_type", { enum: ["holiday", "exam", "event", "meeting", "other"] }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePattern: varchar("recurrence_pattern", { length: 50 }),
  color: varchar("color", { length: 20 }).notNull().default("#3B82F6"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("calendar_events_school_idx").on(table.schoolId),
  startDateIdx: index("calendar_events_start_date_idx").on(table.startDate),
  eventTypeIdx: index("calendar_events_event_type_idx").on(table.eventType),
}));

// ============================================================================
// STUDENT ADMISSION MODULE
// ============================================================================

// Admission Applications table - store student admission applications
export const admissionApplications = pgTable("admission_applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  studentName: varchar("student_name", { length: 255 }).notNull(),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }).notNull(),
  gender: varchar("gender", { enum: ["male", "female", "other"] }).notNull(),
  parentName: varchar("parent_name", { length: 255 }).notNull(),
  parentEmail: varchar("parent_email", { length: 255 }).notNull(),
  parentPhone: varchar("parent_phone", { length: 15 }).notNull(),
  address: text("address").notNull(),
  previousSchool: varchar("previous_school", { length: 255 }),
  classAppliedFor: uuid("class_applied_for").notNull().references(() => classes.id, { onDelete: "restrict" }),
  applicationStatus: varchar("application_status", { 
    enum: ["submitted", "under_review", "approved", "rejected"] 
  }).notNull().default("submitted"),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("admission_applications_school_idx").on(table.schoolId),
  statusIdx: index("admission_applications_status_idx").on(table.applicationStatus),
  sessionIdx: index("admission_applications_session_idx").on(table.academicSessionId),
  classIdx: index("admission_applications_class_idx").on(table.classAppliedFor),
}));

// Admission Documents table - store documents uploaded for admission applications
export const admissionDocuments = pgTable("admission_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id").notNull().references(() => admissionApplications.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 100 }).notNull(), // e.g., 'birth_certificate', 'photo', 'previous_report_card'
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentUrl: varchar("document_url", { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("admission_documents_application_idx").on(table.applicationId),
}));

// ============================================================================
// EXAM MODULE
// ============================================================================

// Exams table - store exam information
export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  examType: varchar("exam_type", { enum: ["mid_term", "final", "quarterly", "unit_test", "other"] }).notNull(),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  totalMarks: integer("total_marks").notNull(),
  passingMarks: integer("passing_marks").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("exams_school_idx").on(table.schoolId),
  sessionIdx: index("exams_session_idx").on(table.academicSessionId),
  examTypeIdx: index("exams_type_idx").on(table.examType),
}));

// Exam Classes table - classes assigned to each exam
export const examClasses = pgTable("exam_classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  examIdx: index("exam_classes_exam_idx").on(table.examId),
  classIdx: index("exam_classes_class_idx").on(table.classId),
  uniqueExamClass: unique("exam_class_unique").on(table.examId, table.classId),
}));

// Exam Subjects table - subjects included in each exam
export const examSubjects = pgTable("exam_subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  maxMarks: integer("max_marks").notNull(),
  passingMarks: integer("passing_marks"),
  examDate: timestamp("exam_date", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  examIdx: index("exam_subjects_exam_idx").on(table.examId),
  subjectIdx: index("exam_subjects_subject_idx").on(table.subjectId),
  uniqueExamSubject: unique("exam_subject_unique").on(table.examId, table.subjectId),
}));

// Exam Marks table - marks obtained by students
export const examMarks = pgTable("exam_marks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  examSubjectId: uuid("exam_subject_id").notNull().references(() => examSubjects.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  marksObtained: numeric("marks_obtained", { precision: 5, scale: 2 }),
  isAbsent: boolean("is_absent").default(false),
  remarks: text("remarks"),
  enteredBy: varchar("entered_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  examIdx: index("exam_marks_exam_idx").on(table.examId),
  studentIdx: index("exam_marks_student_idx").on(table.studentId),
  examSubjectIdx: index("exam_marks_exam_subject_idx").on(table.examSubjectId),
  uniqueStudentExamSubject: unique("student_exam_subject_unique").on(table.studentId, table.examSubjectId),
}));

// Exam Results table - calculated results for students
export const examResults = pgTable("exam_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  totalMarksObtained: numeric("total_marks_obtained", { precision: 7, scale: 2 }).notNull(),
  totalMaxMarks: integer("total_max_marks").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  grade: varchar("grade", { length: 5 }).notNull(),
  result: varchar("result", { enum: ["pass", "fail"] }).notNull(),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  examIdx: index("exam_results_exam_idx").on(table.examId),
  studentIdx: index("exam_results_student_idx").on(table.studentId),
  uniqueStudentExam: unique("student_exam_unique").on(table.studentId, table.examId),
}));

// ============================================================================
// HOSTEL MANAGEMENT MODULE
// ============================================================================

// Hostels table - store hostel information
export const hostels = pgTable("hostels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("schoolId").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  hostelType: varchar("hostelType", { enum: ["boys", "girls", "mixed"] }).notNull(),
  totalRooms: integer("totalRooms").notNull().default(0),
  totalCapacity: integer("totalCapacity").notNull().default(0),
  warden: varchar("warden").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  schoolIdx: index("hostels_school_idx").on(table.schoolId),
  wardenIdx: index("hostels_warden_idx").on(table.warden),
}));

// Hostel Rooms table - store room information for each hostel
export const hostelRooms = pgTable("hostel_rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hostelId: uuid("hostel_id").notNull().references(() => hostels.id, { onDelete: "cascade" }),
  roomNumber: varchar("room_number", { length: 50 }).notNull(),
  floor: integer("floor").notNull(),
  capacity: integer("capacity").notNull(),
  roomType: varchar("room_type", { enum: ["single", "double", "triple", "shared"] }).notNull(),
  amenities: text("amenities"),
  status: varchar("status", { enum: ["available", "occupied", "maintenance"] }).notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  hostelIdx: index("hostel_rooms_hostel_idx").on(table.hostelId),
  statusIdx: index("hostel_rooms_status_idx").on(table.status),
  uniqueRoomNumber: unique("hostel_room_number_unique").on(table.hostelId, table.roomNumber),
}));

// Hostel Allocations table - track student room allocations
export const hostelAllocations = pgTable("hostel_allocations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: uuid("room_id").notNull().references(() => hostelRooms.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  allocationDate: timestamp("allocation_date", { withTimezone: true }).notNull().defaultNow(),
  checkOutDate: timestamp("check_out_date", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  roomIdx: index("hostel_allocations_room_idx").on(table.roomId),
  studentIdx: index("hostel_allocations_student_idx").on(table.studentId),
  sessionIdx: index("hostel_allocations_session_idx").on(table.academicSessionId),
  activeIdx: index("hostel_allocations_active_idx").on(table.isActive),
}));

// Hostel Fees table - track hostel fee payments
export const hostelFees = pgTable("hostel_fees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hostelId: uuid("hostel_id").notNull().references(() => hostels.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  feeAmount: numeric("fee_amount", { precision: 10, scale: 2 }).notNull(),
  feeType: varchar("fee_type", { enum: ["monthly", "quarterly", "yearly", "one_time"] }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  paymentStatus: varchar("payment_status", { enum: ["pending", "paid", "overdue"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  hostelIdx: index("hostel_fees_hostel_idx").on(table.hostelId),
  studentIdx: index("hostel_fees_student_idx").on(table.studentId),
  sessionIdx: index("hostel_fees_session_idx").on(table.academicSessionId),
  statusIdx: index("hostel_fees_status_idx").on(table.paymentStatus),
}));

// ============================================================================
// INVENTORY MANAGEMENT MODULE
// ============================================================================

// Inventory Categories table - categorize inventory items
export const inventoryCategories = pgTable("inventory_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("inventory_categories_school_idx").on(table.schoolId),
}));

// Inventory Items table - track all inventory items
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => inventoryCategories.id, { onDelete: "cascade" }),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  description: text("description"),
  itemCode: varchar("item_code", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(0),
  location: varchar("location", { length: 255 }),
  supplier: varchar("supplier", { length: 255 }),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("inventory_items_school_idx").on(table.schoolId),
  categoryIdx: index("inventory_items_category_idx").on(table.categoryId),
  itemCodeIdx: unique("inventory_items_item_code_unique").on(table.itemCode, table.schoolId),
  stockLevelIdx: index("inventory_items_stock_level_idx").on(table.currentStock, table.minStockLevel),
}));

// Inventory Transactions table - track all stock movements
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: uuid("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  transactionType: varchar("transaction_type", { enum: ["purchase", "issue", "return", "damaged", "adjustment"] }).notNull(),
  quantity: integer("quantity").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
  issuedTo: varchar("issued_to", { length: 255 }),
  remarks: text("remarks"),
  performedBy: varchar("performed_by").notNull().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  itemIdx: index("inventory_transactions_item_idx").on(table.itemId),
  typeIdx: index("inventory_transactions_type_idx").on(table.transactionType),
  dateIdx: index("inventory_transactions_date_idx").on(table.transactionDate),
  performedByIdx: index("inventory_transactions_performed_by_idx").on(table.performedBy),
}));

// Teacher Planner Settings - stores max periods per teacher for each school
export const teacherPlannerSettings = pgTable("teacher_planner_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }).unique(),
  maxPeriodsPerTeacher: integer("max_periods_per_teacher").notNull().default(40),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// SCHEMA DEFINITIONS FOR NEW MODULES
// ============================================================================

// Fee Types schemas
export const insertFeeTypeSchema = createInsertSchema(feeTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Structures schemas
export const insertFeeStructureSchema = createInsertSchema(feeStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Structure Items schemas
export const insertFeeStructureItemSchema = createInsertSchema(feeStructureItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Student Fee Assignments schemas
export const insertStudentFeeAssignmentSchema = createInsertSchema(studentFeeAssignments).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Invoices schemas
export const insertFeeInvoiceSchema = createInsertSchema(feeInvoices).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Invoice Items schemas
export const insertFeeInvoiceItemSchema = createInsertSchema(feeInvoiceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Payments schemas
export const insertFeePaymentSchema = createInsertSchema(feePayments).omit({
  id: true,
  collectedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Fee Notifications schemas
export const insertFeeNotificationSchema = createInsertSchema(feeNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Transport Routes schemas
export const insertTransportRouteSchema = createInsertSchema(transportRoutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Transport Stops schemas
export const insertTransportStopSchema = createInsertSchema(transportStops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Transport Vehicles schemas
export const insertTransportVehicleSchema = createInsertSchema(transportVehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Transport Route Assignments schemas
export const insertTransportRouteAssignmentSchema = createInsertSchema(transportRouteAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Transport Student Assignments schemas
export const insertTransportStudentAssignmentSchema = createInsertSchema(transportStudentAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Calendar Events schemas
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().datetime()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  endDate: z.union([z.date(), z.string().datetime(), z.null(), z.undefined()]).transform((val) => 
    val && typeof val === 'string' ? new Date(val) : val
  ).optional(),
});

// User Preferences schemas
export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;

export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;

export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type InsertTimetableEntry = z.infer<typeof insertTimetableEntrySchema>;

export type TimetableChange = typeof timetableChanges.$inferSelect;
export type InsertTimetableChange = z.infer<typeof insertTimetableChangeSchema>;

export type TimetableValidityPeriod = typeof timetableValidityPeriods.$inferSelect;
export type InsertTimetableValidityPeriod = z.infer<typeof insertTimetableValidityPeriodSchema>;

export type ClassSubjectAssignment = typeof classSubjectAssignments.$inferSelect;
export type InsertClassSubjectAssignment = z.infer<typeof insertClassSubjectAssignmentSchema>;

export type TimetableStructure = typeof timetableStructures.$inferSelect;
export type InsertTimetableStructure = z.infer<typeof insertTimetableStructureSchema>;

export type TeacherAttendance = typeof teacherAttendance.$inferSelect;
export type InsertTeacherAttendance = z.infer<typeof insertTeacherAttendanceSchema>;

export type StudentAttendance = typeof studentAttendance.$inferSelect;
export type InsertStudentAttendance = z.infer<typeof insertStudentAttendanceSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type UpdateTeacherDailyPeriods = z.infer<typeof updateTeacherDailyPeriodsSchema>;

export type ManualAssignmentAudit = typeof manualAssignmentAudits.$inferSelect;
export type InsertManualAssignmentAudit = z.infer<typeof insertManualAssignmentAuditSchema>;

export type TeacherReplacement = typeof teacherReplacements.$inferSelect;
export type InsertTeacherReplacement = z.infer<typeof insertTeacherReplacementSchema>;

export type WeeklyTimetable = typeof weeklyTimetables.$inferSelect;
export type InsertWeeklyTimetable = z.infer<typeof insertWeeklyTimetableSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Parent = typeof parents.$inferSelect;
export type InsertParent = z.infer<typeof insertParentSchema>;

export type StudentParent = typeof studentParents.$inferSelect;
export type InsertStudentParent = z.infer<typeof insertStudentParentSchema>;

export type SystemModule = typeof systemModules.$inferSelect;
export type InsertSystemModule = z.infer<typeof insertSystemModuleSchema>;

export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;

export type UserCustomRole = typeof userCustomRoles.$inferSelect;
export type InsertUserCustomRole = z.infer<typeof insertUserCustomRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type ClassTeacherAssignment = typeof classTeacherAssignments.$inferSelect;
export type InsertClassTeacherAssignment = z.infer<typeof insertClassTeacherAssignmentSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;

export type AcademicSession = typeof academicSessions.$inferSelect;
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;

// Fee Management Types
export type FeeType = typeof feeTypes.$inferSelect;
export type InsertFeeType = z.infer<typeof insertFeeTypeSchema>;

export type FeeStructure = typeof feeStructures.$inferSelect;
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;

export type FeeStructureItem = typeof feeStructureItems.$inferSelect;
export type InsertFeeStructureItem = z.infer<typeof insertFeeStructureItemSchema>;

export type StudentFeeAssignment = typeof studentFeeAssignments.$inferSelect;
export type InsertStudentFeeAssignment = z.infer<typeof insertStudentFeeAssignmentSchema>;

export type FeeInvoice = typeof feeInvoices.$inferSelect;
export type InsertFeeInvoice = z.infer<typeof insertFeeInvoiceSchema>;

export type FeeInvoiceItem = typeof feeInvoiceItems.$inferSelect;
export type InsertFeeInvoiceItem = z.infer<typeof insertFeeInvoiceItemSchema>;

export type FeePayment = typeof feePayments.$inferSelect;
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;

export type FeeNotification = typeof feeNotifications.$inferSelect;
export type InsertFeeNotification = z.infer<typeof insertFeeNotificationSchema>;

// Message Types
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Notification Types
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Transport Management Types
export type TransportRoute = typeof transportRoutes.$inferSelect;
export type InsertTransportRoute = z.infer<typeof insertTransportRouteSchema>;

export type TransportStop = typeof transportStops.$inferSelect;
export type InsertTransportStop = z.infer<typeof insertTransportStopSchema>;

export type TransportVehicle = typeof transportVehicles.$inferSelect;
export type InsertTransportVehicle = z.infer<typeof insertTransportVehicleSchema>;

export type TransportRouteAssignment = typeof transportRouteAssignments.$inferSelect;
export type InsertTransportRouteAssignment = z.infer<typeof insertTransportRouteAssignmentSchema>;

export type TransportStudentAssignment = typeof transportStudentAssignments.$inferSelect;
export type InsertTransportStudentAssignment = z.infer<typeof insertTransportStudentAssignmentSchema>;

// Calendar Events Types
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

// Admission Applications schemas
export const insertAdmissionApplicationSchema = createInsertSchema(admissionApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dateOfBirth: z.union([z.date(), z.string()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
});
export type AdmissionApplication = typeof admissionApplications.$inferSelect;
export type InsertAdmissionApplication = z.infer<typeof insertAdmissionApplicationSchema>;

// Admission Documents schemas
export const insertAdmissionDocumentSchema = createInsertSchema(admissionDocuments).omit({
  id: true,
  uploadedAt: true,
});
export type AdmissionDocument = typeof admissionDocuments.$inferSelect;
export type InsertAdmissionDocument = z.infer<typeof insertAdmissionDocumentSchema>;

// Exam Module schemas
export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.date(), z.string()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
  endDate: z.union([z.date(), z.string()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
});
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;

export const insertExamSubjectSchema = createInsertSchema(examSubjects).omit({
  id: true,
  createdAt: true,
});
export type ExamSubject = typeof examSubjects.$inferSelect;
export type InsertExamSubject = z.infer<typeof insertExamSubjectSchema>;

export const insertExamMarkSchema = createInsertSchema(examMarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  marksObtained: z.union([z.string(), z.number(), z.null()]).transform((val) => {
    if (val === null || val === undefined) return null;
    return typeof val === 'number' ? val.toString() : val;
  }),
});
export type ExamMark = typeof examMarks.$inferSelect;
export type InsertExamMark = z.infer<typeof insertExamMarkSchema>;

export const insertExamResultSchema = createInsertSchema(examResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ExamResult = typeof examResults.$inferSelect;
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;

// Hostel Management schemas
export const insertHostelSchema = createInsertSchema(hostels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Hostel = typeof hostels.$inferSelect;
export type InsertHostel = z.infer<typeof insertHostelSchema>;

export const insertHostelRoomSchema = createInsertSchema(hostelRooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type HostelRoom = typeof hostelRooms.$inferSelect;
export type InsertHostelRoom = z.infer<typeof insertHostelRoomSchema>;

export const insertHostelAllocationSchema = createInsertSchema(hostelAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type HostelAllocation = typeof hostelAllocations.$inferSelect;
export type InsertHostelAllocation = z.infer<typeof insertHostelAllocationSchema>;

export const insertHostelFeeSchema = createInsertSchema(hostelFees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type HostelFee = typeof hostelFees.$inferSelect;
export type InsertHostelFee = z.infer<typeof insertHostelFeeSchema>;

// Incremental Update Types
export type IncrementalChangeRequest = typeof incrementalChangeRequests.$inferSelect;
export type InsertIncrementalChangeRequest = z.infer<typeof insertIncrementalChangeRequestSchema>;

export type ConflictDetectionResult = typeof conflictDetectionResults.$inferSelect;
export type InsertConflictDetectionResult = z.infer<typeof insertConflictDetectionResultSchema>;

export type ChangeImpactAnalysis = typeof changeImpactAnalysis.$inferSelect;
export type InsertChangeImpactAnalysis = z.infer<typeof insertChangeImpactAnalysisSchema>;

// School Settings schemas  
export const insertSchoolSettingSchema = createInsertSchema(schoolSettings);
export type SchoolSetting = typeof schoolSettings.$inferSelect;
export type InsertSchoolSetting = z.infer<typeof insertSchoolSettingSchema>;

// Teacher Planner Settings schemas
export const insertTeacherPlannerSettingsSchema = createInsertSchema(teacherPlannerSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TeacherPlannerSettings = typeof teacherPlannerSettings.$inferSelect;
export type InsertTeacherPlannerSettings = z.infer<typeof insertTeacherPlannerSettingsSchema>;

// ============================================================================
// INVENTORY MANAGEMENT SCHEMAS
// ============================================================================

// Inventory Categories schemas
export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;

// Inventory Items schemas
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// Inventory Transactions schemas
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  createdAt: true,
});
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;

// ============================================================================
// PAYROLL MANAGEMENT MODULE
// ============================================================================

// Payroll Employees table
export const payrollEmployees = pgTable("payroll_employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").references(() => users.id, { onDelete: "cascade" }), // Optional - only for teachers with user accounts
  employeeType: varchar("employee_type", { enum: ["teacher", "staff"] }).notNull(),
  staffName: varchar("staff_name", { length: 255 }),
  designation: varchar("designation", { length: 255 }).notNull(),
  department: varchar("department", { length: 255 }),
  joiningDate: timestamp("joining_date").notNull(),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankName: varchar("bank_name", { length: 255 }),
  ifscCode: varchar("ifsc_code", { length: 20 }),
  panNumber: varchar("pan_number", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("payroll_employees_school_idx").on(table.schoolId),
}));

// Salary Components table
export const salaryComponents = pgTable("salary_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollEmployeeId: varchar("payroll_employee_id").notNull().references(() => payrollEmployees.id, { onDelete: "cascade" }),
  componentType: varchar("component_type", { enum: ["basic_salary", "allowance", "deduction"] }).notNull(),
  componentName: varchar("component_name", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  isRecurring: boolean("is_recurring").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeComponentIdx: index("salary_components_employee_idx").on(table.payrollEmployeeId),
}));

// Payroll Cycles table
export const payrollCycles = pgTable("payroll_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  cycleMonth: integer("cycle_month").notNull(),
  cycleYear: integer("cycle_year").notNull(),
  status: varchar("status", { enum: ["draft", "processing", "completed", "paid"] }).notNull().default("draft"),
  totalEmployees: integer("total_employees").notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  processedBy: varchar("processed_by").references(() => users.id, { onDelete: "set null" }),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolCycleIdx: index("payroll_cycles_school_idx").on(table.schoolId),
  uniqueMonthYear: unique("payroll_cycles_school_month_year_unique").on(table.schoolId, table.cycleMonth, table.cycleYear),
}));

// Payroll Payslips table
export const payrollPayslips = pgTable("payroll_payslips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => payrollCycles.id, { onDelete: "cascade" }),
  payrollEmployeeId: varchar("payroll_employee_id").notNull().references(() => payrollEmployees.id, { onDelete: "cascade" }),
  basicSalary: numeric("basic_salary", { precision: 10, scale: 2 }).notNull(),
  totalAllowances: numeric("total_allowances", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 10, scale: 2 }).notNull().default("0"),
  netSalary: numeric("net_salary", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date"),
  paymentStatus: varchar("payment_status", { enum: ["pending", "paid"] }).notNull().default("pending"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  cycleEmployeeIdx: index("payroll_payslips_cycle_employee_idx").on(table.cycleId, table.payrollEmployeeId),
}));

// Payroll Employees schemas
export const insertPayrollEmployeeSchema = createInsertSchema(payrollEmployees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PayrollEmployee = typeof payrollEmployees.$inferSelect;
export type InsertPayrollEmployee = z.infer<typeof insertPayrollEmployeeSchema>;

// Salary Components schemas
export const insertSalaryComponentSchema = createInsertSchema(salaryComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SalaryComponent = typeof salaryComponents.$inferSelect;
export type InsertSalaryComponent = z.infer<typeof insertSalaryComponentSchema>;

// Payroll Cycles schemas
export const insertPayrollCycleSchema = createInsertSchema(payrollCycles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PayrollCycle = typeof payrollCycles.$inferSelect;
export type InsertPayrollCycle = z.infer<typeof insertPayrollCycleSchema>;

// Payroll Payslips schemas
export const insertPayrollPayslipSchema = createInsertSchema(payrollPayslips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PayrollPayslip = typeof payrollPayslips.$inferSelect;
export type InsertPayrollPayslip = z.infer<typeof insertPayrollPayslipSchema>;

// ==================== EXPENSE MANAGEMENT MODULE ====================

// Expense Categories table
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  description: text("description"),
  budgetAllocated: numeric("budget_allocated", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolCategoryIdx: index("expense_categories_school_idx").on(table.schoolId),
  uniqueCategoryName: unique("expense_categories_school_name_unique").on(table.schoolId, table.categoryName),
}));

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => expenseCategories.id, { onDelete: "restrict" }),
  expenseTitle: varchar("expense_title", { length: 255 }).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: timestamp("expense_date").notNull(),
  paymentMethod: varchar("payment_method", { 
    enum: ["cash", "bank_transfer", "cheque", "online", "other"] 
  }).notNull(),
  paymentStatus: varchar("payment_status", { 
    enum: ["pending", "paid", "approved", "rejected"] 
  }).notNull().default("pending"),
  vendor: varchar("vendor", { length: 255 }),
  billNumber: varchar("bill_number", { length: 100 }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  recordedBy: varchar("recorded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("expenses_school_idx").on(table.schoolId),
  categoryIdx: index("expenses_category_idx").on(table.categoryId),
  sessionIdx: index("expenses_session_idx").on(table.academicSessionId),
  dateIdx: index("expenses_date_idx").on(table.expenseDate),
  statusIdx: index("expenses_status_idx").on(table.paymentStatus),
}));

// Budgets table
export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => expenseCategories.id, { onDelete: "cascade" }),
  academicSessionId: uuid("academic_session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  spentAmount: numeric("spent_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { 
    enum: ["active", "exceeded", "completed"] 
  }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("budgets_school_idx").on(table.schoolId),
  categorySessionIdx: index("budgets_category_session_idx").on(table.categoryId, table.academicSessionId),
  uniqueBudget: unique("budgets_category_session_unique").on(table.categoryId, table.academicSessionId),
}));

// ==================== TEACHER LOAD SIMULATION MODULE ====================

// Simulation Scenarios table - Main container for each simulation
export const simulationScenarios = pgTable("simulation_scenarios", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  teachingPeriodsPerDay: integer("teaching_periods_per_day"),
  workingDaysCount: integer("working_days_count"),
  defaultMaxPeriodsPerDay: integer("default_max_periods_per_day"),
  lastOptimizationAt: timestamp("last_optimization_at"),
  lastOptimizationSummary: jsonb("last_optimization_summary").$type<{
    periodsOptimized: number;
    assignmentsCreated: number;
    coverageBefore: number;
    coverageAfter: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolIdx: index("simulation_scenarios_school_idx").on(table.schoolId),
}));

// Simulation Classes table - Classes within a simulation (separate from production classes table)
export const simulationClasses = pgTable("simulation_classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: uuid("simulation_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  grade: varchar("grade", { length: 50 }).notNull(),
  section: varchar("section", { length: 10 }),
  studentCount: integer("student_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  simulationIdx: index("simulation_classes_simulation_idx").on(table.simulationId),
}));

// Simulation Subjects table - Subjects within a simulation (separate from production subjects table)
export const simulationSubjects = pgTable("simulation_subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: uuid("simulation_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => simulationClasses.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  simulationIdx: index("simulation_subjects_simulation_idx").on(table.simulationId),
  classIdx: index("simulation_subjects_class_idx").on(table.classId),
}));

// Simulation Teachers table - Teachers within a simulation (separate from production teachers table)
export const simulationTeachers = pgTable("simulation_teachers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: uuid("simulation_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  employeeId: varchar("employee_id", { length: 50 }).notNull(),
  maxPeriodsPerDay: integer("max_periods_per_day").notNull().default(7),
  subjectIds: jsonb("subject_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`), // Subjects this teacher can teach
  availability: jsonb("availability").$type<{
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }>().notNull().default(sql`'{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":true,"sunday":false}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  simulationIdx: index("simulation_teachers_simulation_idx").on(table.simulationId),
}));

// Simulation Class Subject Requirements table - Defines required periods for each subject in each class
export const simulationClassSubjects = pgTable("simulation_class_subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: uuid("simulation_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => simulationClasses.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => simulationSubjects.id, { onDelete: "cascade" }),
  weeklyPeriods: integer("weekly_periods").notNull(), // Required periods per week for this subject in this class
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  simulationIdx: index("simulation_class_subjects_simulation_idx").on(table.simulationId),
  classSubjectIdx: unique("simulation_class_subject_unique").on(table.classId, table.subjectId),
}));

// Simulation Assignments table - Teacher assignments to class-subjects
export const simulationAssignments = pgTable("simulation_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: uuid("simulation_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  classSubjectId: uuid("class_subject_id").notNull().references(() => simulationClassSubjects.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => simulationTeachers.id, { onDelete: "cascade" }), // CASCADE: Delete assignment when teacher is deleted
  isAiSuggested: boolean("is_ai_suggested").notNull().default(false), // Whether this assignment was AI-suggested
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  simulationIdx: index("simulation_assignments_simulation_idx").on(table.simulationId),
  classSubjectIdx: unique("simulation_assignment_class_subject_unique").on(table.classSubjectId),
}));

// Simulation Scenarios schemas
export const insertSimulationScenarioSchema = createInsertSchema(simulationScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type InsertSimulationScenario = z.infer<typeof insertSimulationScenarioSchema>;

// Simulation Classes schemas
export const insertSimulationClassSchema = createInsertSchema(simulationClasses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationClass = typeof simulationClasses.$inferSelect;
export type InsertSimulationClass = z.infer<typeof insertSimulationClassSchema>;

// Simulation Subjects schemas
export const insertSimulationSubjectSchema = createInsertSchema(simulationSubjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationSubject = typeof simulationSubjects.$inferSelect;
export type InsertSimulationSubject = z.infer<typeof insertSimulationSubjectSchema>;

// Simulation Teachers schemas
export const insertSimulationTeacherSchema = createInsertSchema(simulationTeachers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationTeacher = typeof simulationTeachers.$inferSelect;
export type InsertSimulationTeacher = z.infer<typeof insertSimulationTeacherSchema>;

// Simulation Class Subjects schemas
export const insertSimulationClassSubjectSchema = createInsertSchema(simulationClassSubjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationClassSubject = typeof simulationClassSubjects.$inferSelect;
export type InsertSimulationClassSubject = z.infer<typeof insertSimulationClassSubjectSchema>;

// Simulation Assignments schemas
export const insertSimulationAssignmentSchema = createInsertSchema(simulationAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SimulationAssignment = typeof simulationAssignments.$inferSelect;
export type InsertSimulationAssignment = z.infer<typeof insertSimulationAssignmentSchema>;

// Expense Categories schemas
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;

// Expenses schemas
export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expenseDate: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
});
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Budgets schemas
export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;

// ID Card Templates table
export const idCardTemplates = pgTable("id_card_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { enum: ["student", "teacher"] }).notNull(),
  templateUrl: text("template_url").notNull(), // Path to uploaded template image
  isDefault: boolean("is_default").notNull().default(false),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolTypeIdx: index("id_card_templates_school_type_idx").on(table.schoolId, table.type),
}));

// Generated ID Cards table
export const idCards = pgTable("id_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").notNull().references(() => idCardTemplates.id, { onDelete: "cascade" }),
  personType: varchar("person_type", { enum: ["student", "teacher"] }).notNull(),
  personId: uuid("person_id").notNull(), // References either students.id or teachers.id
  personName: varchar("person_name", { length: 255 }).notNull(),
  personDetails: jsonb("person_details").$type<{
    admissionNumber?: string;
    employeeId?: string;
    class?: string;
    designation?: string;
    bloodGroup?: string;
    contactNumber?: string;
    address?: string;
    [key: string]: any;
  }>(),
  cardImageUrl: text("card_image_url").notNull(), // Path to generated ID card image/PDF
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolPersonIdx: index("id_cards_school_person_idx").on(table.schoolId, table.personType, table.personId),
  templateIdx: index("id_cards_template_idx").on(table.templateId),
}));

// Certificate Templates table
export const certificateTemplates = pgTable("certificate_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // e.g., "Achievement", "Participation", "Excellence"
  templateUrl: text("template_url").notNull(), // Path to uploaded template image
  isDefault: boolean("is_default").notNull().default(false),
  placeholders: jsonb("placeholders").$type<{
    recipientName?: { x: number; y: number; fontSize: number };
    eventName?: { x: number; y: number; fontSize: number };
    date?: { x: number; y: number; fontSize: number };
    [key: string]: any;
  }>(), // Placeholder positions for text overlay
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolCategoryIdx: index("certificate_templates_school_category_idx").on(table.schoolId, table.category),
}));

// Generated Certificates table
export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").notNull().references(() => certificateTemplates.id, { onDelete: "cascade" }),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  recipientType: varchar("recipient_type", { enum: ["student", "teacher", "other"] }),
  recipientId: uuid("recipient_id"), // Optional reference to students.id or teachers.id
  eventName: varchar("event_name", { length: 255 }).notNull(),
  eventDate: date("event_date"),
  issueDate: date("issue_date").notNull(),
  additionalDetails: jsonb("additional_details").$type<{
    position?: string;
    achievement?: string;
    grade?: string;
    [key: string]: any;
  }>(),
  certificateUrl: text("certificate_url").notNull(), // Path to generated certificate PDF/image
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolEventIdx: index("certificates_school_event_idx").on(table.schoolId, table.eventName),
  recipientIdx: index("certificates_recipient_idx").on(table.recipientType, table.recipientId),
  templateIdx: index("certificates_template_idx").on(table.templateId),
}));

// ID Card Templates schemas
export const insertIdCardTemplateSchema = createInsertSchema(idCardTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type IdCardTemplate = typeof idCardTemplates.$inferSelect;
export type InsertIdCardTemplate = z.infer<typeof insertIdCardTemplateSchema>;

// ID Cards schemas
export const insertIdCardSchema = createInsertSchema(idCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type IdCard = typeof idCards.$inferSelect;
export type InsertIdCard = z.infer<typeof insertIdCardSchema>;

// Certificate Templates schemas
export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>;

// Certificates schemas
export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

// ========================================
// E-LEARNING MODULE
// ========================================

// Course Categories
export const courseCategories = pgTable("course_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 50 }).default("#6366F1"),
  icon: varchar("icon", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolCategoryIdx: index("course_categories_school_idx").on(table.schoolId),
}));

// Courses
export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => courseCategories.id, { onDelete: "set null" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "cascade" }), // Nullable: for admin-created courses, this is null
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  status: varchar("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  level: varchar("level", { enum: ["beginner", "intermediate", "advanced"] }),
  duration: integer("duration"),
  publishedAt: timestamp("published_at"),
  createdBy: uuid("created_by").notNull(), // ID of creator (admin ID or teacher ID)
  createdByRole: varchar("created_by_role", { enum: ["admin", "teacher"] }).notNull(), // Role of creator
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schoolCourseIdx: index("courses_school_idx").on(table.schoolId),
  teacherCourseIdx: index("courses_teacher_idx").on(table.teacherId),
  statusIdx: index("courses_status_idx").on(table.status),
  createdByIdx: index("courses_created_by_idx").on(table.createdBy),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  school: one(schools, {
    fields: [courses.schoolId],
    references: [schools.id],
  }),
  teacher: one(teachers, {
    fields: [courses.teacherId],
    references: [teachers.id],
  }),
  category: one(courseCategories, {
    fields: [courses.categoryId],
    references: [courseCategories.id],
  }),
  memberships: many(courseMemberships),
  lessons: many(lessons),
  quizzes: many(quizzes),
  assignments: many(assignments),
  announcements: many(courseAnnouncements),
  discussions: many(discussionThreads),
  prerequisites: many(coursePrerequisites, { relationName: "courseToPrerequisites" }),
  prerequisiteFor: many(coursePrerequisites, { relationName: "prerequisiteToCourses" }),
}));

// Course Memberships (Student Enrollments)
export const courseMemberships = pgTable("course_memberships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => ({
  courseStudentIdx: uniqueIndex("course_memberships_course_student_idx").on(table.courseId, table.studentId),
  studentIdx: index("course_memberships_student_idx").on(table.studentId),
}));

// Lessons
export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  duration: integer("duration"),
  status: varchar("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseLessonIdx: index("lessons_course_idx").on(table.courseId),
  orderIdx: index("lessons_order_idx").on(table.courseId, table.orderIndex),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  blocks: many(lessonBlocks),
  resources: many(lessonResources),
}));

// Lesson Blocks (Content Segments)
export const lessonBlocks = pgTable("lesson_blocks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { enum: ["text", "video", "image", "document", "quiz"] }).notNull(),
  content: jsonb("content").$type<{
    text?: string;
    videoUrl?: string;
    videoProvider?: "youtube" | "vimeo" | "upload";
    imageUrl?: string;
    documentUrl?: string;
    quizId?: string;
    [key: string]: any;
  }>().notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  lessonBlockIdx: index("lesson_blocks_lesson_idx").on(table.lessonId),
  orderIdx: index("lesson_blocks_order_idx").on(table.lessonId, table.orderIndex),
}));

export const lessonBlocksRelations = relations(lessonBlocks, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonBlocks.lessonId],
    references: [lessons.id],
  }),
}));

// Lesson Resources (Downloadable Files)
export const lessonResources = pgTable("lesson_resources", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  lessonResourceIdx: index("lesson_resources_lesson_idx").on(table.lessonId),
}));

export const lessonResourcesRelations = relations(lessonResources, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonResources.lessonId],
    references: [lessons.id],
  }),
}));

// Quizzes
export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  passingScore: integer("passing_score").notNull().default(60),
  timeLimit: integer("time_limit"),
  maxAttempts: integer("max_attempts"),
  showCorrectAnswers: boolean("show_correct_answers").notNull().default(true),
  status: varchar("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseQuizIdx: index("quizzes_course_idx").on(table.courseId),
  lessonQuizIdx: index("quizzes_lesson_idx").on(table.lessonId),
}));

// Quiz Questions
export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type", { enum: ["single_choice", "multiple_choice", "true_false", "short_answer"] }).notNull(),
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  quizQuestionIdx: index("quiz_questions_quiz_idx").on(table.quizId),
  orderIdx: index("quiz_questions_order_idx").on(table.quizId, table.orderIndex),
}));

// Quiz Question Options
export const quizQuestionOptions = pgTable("quiz_question_options", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
}, (table) => ({
  questionOptionIdx: index("quiz_question_options_question_idx").on(table.questionId),
}));

// Quiz Attempts
export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2 }),
  maxScore: integer("max_score"),
  passed: boolean("passed"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
  timeSpent: integer("time_spent"),
}, (table) => ({
  quizStudentIdx: index("quiz_attempts_quiz_student_idx").on(table.quizId, table.studentId),
  studentIdx: index("quiz_attempts_student_idx").on(table.studentId),
}));

// Quiz Answers
export const quizAnswers = pgTable("quiz_answers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: uuid("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedOptions: jsonb("selected_options").$type<string[]>(),
  textAnswer: text("text_answer"),
  isCorrect: boolean("is_correct"),
  pointsEarned: numeric("points_earned", { precision: 5, scale: 2 }),
}, (table) => ({
  attemptQuestionIdx: uniqueIndex("quiz_answers_attempt_question_idx").on(table.attemptId, table.questionId),
}));

// Assignments
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  dueDate: timestamp("due_date"),
  maxScore: integer("max_score").notNull().default(100),
  allowLateSubmissions: boolean("allow_late_submissions").notNull().default(true),
  status: varchar("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseAssignmentIdx: index("assignments_course_idx").on(table.courseId),
  lessonAssignmentIdx: index("assignments_lesson_idx").on(table.lessonId),
  dueDateIdx: index("assignments_due_date_idx").on(table.dueDate),
}));

// Assignment Submissions
export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  submissionText: text("submission_text"),
  submissionFileUrl: text("submission_file_url"),
  status: varchar("status", { enum: ["draft", "submitted", "graded", "returned"] }).notNull().default("draft"),
  score: numeric("score", { precision: 5, scale: 2 }),
  feedback: text("feedback"),
  gradedBy: uuid("graded_by").references(() => teachers.id),
  submittedAt: timestamp("submitted_at"),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  assignmentStudentIdx: uniqueIndex("assignment_submissions_assignment_student_idx").on(table.assignmentId, table.studentId),
  studentIdx: index("assignment_submissions_student_idx").on(table.studentId),
  statusIdx: index("assignment_submissions_status_idx").on(table.status),
}));

// Student Progress (Overall Course Progress)
export const studentProgress = pgTable("student_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  lessonsCompleted: integer("lessons_completed").notNull().default(0),
  totalLessons: integer("total_lessons").notNull().default(0),
  quizzesCompleted: integer("quizzes_completed").notNull().default(0),
  averageQuizScore: numeric("average_quiz_score", { precision: 5, scale: 2 }),
  assignmentsCompleted: integer("assignments_completed").notNull().default(0),
  timeSpent: integer("time_spent").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseStudentProgressIdx: uniqueIndex("student_progress_course_student_idx").on(table.courseId, table.studentId),
  studentIdx: index("student_progress_student_idx").on(table.studentId),
}));

// Progress Events (Granular Activity Tracking)
export const progressEvents = pgTable("progress_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { enum: ["lesson_start", "lesson_complete", "quiz_attempt", "assignment_submit", "resource_download"] }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  courseStudentIdx: index("progress_events_course_student_idx").on(table.courseId, table.studentId),
  studentIdx: index("progress_events_student_idx").on(table.studentId),
  eventTypeIdx: index("progress_events_type_idx").on(table.eventType),
}));

// Course Announcements
export const courseAnnouncements = pgTable("course_announcements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseAnnouncementIdx: index("course_announcements_course_idx").on(table.courseId),
  pinnedIdx: index("course_announcements_pinned_idx").on(table.isPinned),
}));

// Discussion Forums
export const discussionThreads = pgTable("discussion_threads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseThreadIdx: index("discussion_threads_course_idx").on(table.courseId),
  lessonThreadIdx: index("discussion_threads_lesson_idx").on(table.lessonId),
  pinnedIdx: index("discussion_threads_pinned_idx").on(table.isPinned),
}));

// Discussion Replies
export const discussionReplies = pgTable("discussion_replies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: uuid("thread_id").notNull().references(() => discussionThreads.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isAnswer: boolean("is_answer").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadReplyIdx: index("discussion_replies_thread_idx").on(table.threadId),
}));

// Course Prerequisites
export const coursePrerequisites = pgTable("course_prerequisites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  prerequisiteCourseId: uuid("prerequisite_course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  coursePrereqIdx: uniqueIndex("course_prerequisites_course_prereq_idx").on(table.courseId, table.prerequisiteCourseId),
  prerequisiteIdx: index("course_prerequisites_prerequisite_idx").on(table.prerequisiteCourseId),
}));

// Relations for new tables
export const courseAnnouncementsRelations = relations(courseAnnouncements, ({ one }) => ({
  course: one(courses, {
    fields: [courseAnnouncements.courseId],
    references: [courses.id],
  }),
  author: one(users, {
    fields: [courseAnnouncements.authorId],
    references: [users.id],
  }),
}));

export const discussionThreadsRelations = relations(discussionThreads, ({ one, many }) => ({
  course: one(courses, {
    fields: [discussionThreads.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [discussionThreads.lessonId],
    references: [lessons.id],
  }),
  author: one(users, {
    fields: [discussionThreads.authorId],
    references: [users.id],
  }),
  replies: many(discussionReplies),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one }) => ({
  thread: one(discussionThreads, {
    fields: [discussionReplies.threadId],
    references: [discussionThreads.id],
  }),
  author: one(users, {
    fields: [discussionReplies.authorId],
    references: [users.id],
  }),
}));

export const coursePrerequisitesRelations = relations(coursePrerequisites, ({ one }) => ({
  course: one(courses, {
    fields: [coursePrerequisites.courseId],
    references: [courses.id],
    relationName: "courseToPrerequisites",
  }),
  prerequisiteCourse: one(courses, {
    fields: [coursePrerequisites.prerequisiteCourseId],
    references: [courses.id],
    relationName: "prerequisiteToCourses",
  }),
}));

// E-Learning Schemas and Types
export const insertCourseCategorySchema = createInsertSchema(courseCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CourseCategory = typeof courseCategories.$inferSelect;
export type InsertCourseCategory = z.infer<typeof insertCourseCategorySchema>;

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;

export const insertCourseMembershipSchema = createInsertSchema(courseMemberships).omit({
  id: true,
  enrolledAt: true,
});
export type CourseMembership = typeof courseMemberships.$inferSelect;
export type InsertCourseMembership = z.infer<typeof insertCourseMembershipSchema>;

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;

export const insertLessonBlockSchema = createInsertSchema(lessonBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type LessonBlock = typeof lessonBlocks.$inferSelect;
export type InsertLessonBlock = z.infer<typeof insertLessonBlockSchema>;

export const insertLessonResourceSchema = createInsertSchema(lessonResources).omit({
  id: true,
  createdAt: true,
});
export type LessonResource = typeof lessonResources.$inferSelect;
export type InsertLessonResource = z.infer<typeof insertLessonResourceSchema>;

export const insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({
  id: true,
  createdAt: true,
});
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;

export const insertQuizQuestionOptionSchema = createInsertSchema(quizQuestionOptions).omit({
  id: true,
});
export type QuizQuestionOption = typeof quizQuestionOptions.$inferSelect;
export type InsertQuizQuestionOption = z.infer<typeof insertQuizQuestionOptionSchema>;

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  startedAt: true,
});
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;

export const insertQuizAnswerSchema = createInsertSchema(quizAnswers).omit({
  id: true,
});
export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type InsertQuizAnswer = z.infer<typeof insertQuizAnswerSchema>;

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

export const insertAssignmentSubmissionSchema = createInsertSchema(assignmentSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type InsertAssignmentSubmission = z.infer<typeof insertAssignmentSubmissionSchema>;

export const insertStudentProgressSchema = createInsertSchema(studentProgress).omit({
  id: true,
  updatedAt: true,
});
export type StudentProgress = typeof studentProgress.$inferSelect;
export type InsertStudentProgress = z.infer<typeof insertStudentProgressSchema>;

export const insertProgressEventSchema = createInsertSchema(progressEvents).omit({
  id: true,
  createdAt: true,
});
export type ProgressEvent = typeof progressEvents.$inferSelect;
export type InsertProgressEvent = z.infer<typeof insertProgressEventSchema>;

export const insertCourseAnnouncementSchema = createInsertSchema(courseAnnouncements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CourseAnnouncement = typeof courseAnnouncements.$inferSelect;
export type InsertCourseAnnouncement = z.infer<typeof insertCourseAnnouncementSchema>;

export const insertDiscussionThreadSchema = createInsertSchema(discussionThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DiscussionThread = typeof discussionThreads.$inferSelect;
export type InsertDiscussionThread = z.infer<typeof insertDiscussionThreadSchema>;

export const insertDiscussionReplySchema = createInsertSchema(discussionReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type InsertDiscussionReply = z.infer<typeof insertDiscussionReplySchema>;

export const insertCoursePrerequisiteSchema = createInsertSchema(coursePrerequisites).omit({
  id: true,
  createdAt: true,
});
export type CoursePrerequisite = typeof coursePrerequisites.$inferSelect;
export type InsertCoursePrerequisite = z.infer<typeof insertCoursePrerequisiteSchema>;

// Custom Reports table - for saving custom report configurations
export const customReports = pgTable("custom_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Report Configuration
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  
  // Data Source
  dataSource: varchar("data_source", { length: 100 }).notNull(),
  
  // Selected Fields/Columns (JSON array)
  selectedFields: jsonb("selected_fields").$type<string[]>().notNull(),
  
  // Filters (JSON object)
  filters: jsonb("filters").$type<{
    field: string;
    operator: string;
    value: any;
  }[]>().default(sql`'[]'::jsonb`),
  
  // Sorting
  sortBy: varchar("sort_by", { length: 100 }),
  sortOrder: varchar("sort_order", { length: 10 }).default("asc"),
  
  // Grouping
  groupBy: varchar("group_by", { length: 100 }),
  
  // Display Options
  includeHeaders: boolean("include_headers").default(true),
  includeStatistics: boolean("include_statistics").default(false),
  
  // Metadata
  isPublic: boolean("is_public").default(false),
  isFavorite: boolean("is_favorite").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolIdx: index("custom_reports_school_idx").on(table.schoolId),
  createdByIdx: index("custom_reports_created_by_idx").on(table.createdBy),
  categoryIdx: index("custom_reports_category_idx").on(table.category),
}));

// Report Execution History table - track when reports are run
export const reportExecutionHistory = pgTable("report_execution_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: uuid("report_id").references(() => customReports.id, { onDelete: 'cascade' }),
  executedBy: varchar("executed_by").references(() => users.id),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  recordCount: integer("record_count"),
  exportFormat: varchar("export_format", { length: 20 }),
}, (table) => ({
  reportIdx: index("report_execution_report_idx").on(table.reportId),
  executedByIdx: index("report_execution_executed_by_idx").on(table.executedBy),
  executedAtIdx: index("report_execution_executed_at_idx").on(table.executedAt),
}));

// Schema and type exports for custom reports
export const insertCustomReportSchema = createInsertSchema(customReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CustomReport = typeof customReports.$inferSelect;
export type InsertCustomReport = z.infer<typeof insertCustomReportSchema>;

export const insertReportExecutionHistorySchema = createInsertSchema(reportExecutionHistory).omit({
  id: true,
  executedAt: true,
});
export type ReportExecutionHistory = typeof reportExecutionHistory.$inferSelect;
export type InsertReportExecutionHistory = z.infer<typeof insertReportExecutionHistorySchema>;
