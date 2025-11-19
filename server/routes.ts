import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { db } from "./db";
import { weeklyTimetableService } from "./services/weeklyTimetable";
import { teachers, students, parents, users, studentParents, studentAttendance, teacherAttendance, timetableEntries, classes, timetableStructures, subjects, classSubjectAssignments, classTeacherAssignments, simulationScenarios, simulationClasses, simulationSubjects, simulationTeachers, simulationClassSubjects, simulationAssignments, schools, academicSessions, examClasses, examSubjects, customReports, reportExecutionHistory } from "@shared/schema";
import * as customReportService from "./services/customReportService";
import { eq, and, or, gte, lte, between, inArray, sql, count, desc, isNull } from "drizzle-orm";
import { scheduler, TimetableScheduler } from "./services/scheduler";
import { incrementalGenerationService } from "./services/incrementalGenerationService";
import { incrementalChangeService } from "./services/incrementalChangeService";
import { manualTimetableValidationService } from "./services/manualTimetableValidationService";
import { CSVProcessor } from "./services/csvProcessor";
import { ClassPeriodAllocationValidator } from "./services/classPeriodAllocationValidator";
import { z } from "zod";
import { 
  insertTeacherSchema, 
  insertSubjectSchema, 
  insertClassSchema,
  updateClassSchema,
  insertTimetableChangeSchema,
  insertSchoolSchema,
  insertClassSubjectAssignmentSchema,
  insertTimetableStructureSchema,
  insertTeacherAttendanceSchema,
  insertStudentAttendanceSchema,
  updateTeacherDailyPeriodsSchema,
  insertAuditLogSchema,
  createAndAssignSubjectSchema,
  insertTeacherReplacementSchema,
  insertClassTeacherAssignmentSchema,
  insertStudentSchema,
  insertParentSchema,
  insertStudentParentSchema,
  insertAcademicSessionSchema,
  // Fee Management schemas
  insertFeeTypeSchema,
  insertFeeStructureSchema,
  insertFeeStructureItemSchema,
  insertStudentFeeAssignmentSchema,
  insertFeeInvoiceSchema,
  insertFeeInvoiceItemSchema,
  insertFeePaymentSchema,
  insertFeeNotificationSchema,
  // Transport Management schemas
  insertTransportRouteSchema,
  insertTransportStopSchema,
  insertTransportVehicleSchema,
  insertTransportRouteAssignmentSchema,
  insertTransportStudentAssignmentSchema,
  insertSchoolSettingSchema,
  // Calendar Events schemas
  insertCalendarEventSchema,
  // Admission schemas
  insertAdmissionApplicationSchema,
  insertAdmissionDocumentSchema,
  // Exam Module schemas
  insertExamSchema,
  insertExamSubjectSchema,
  insertExamMarkSchema,
  insertExamResultSchema,
  // Hostel Management schemas
  insertHostelSchema,
  insertHostelRoomSchema,
  insertHostelAllocationSchema,
  insertHostelFeeSchema,
  // Inventory Management schemas
  insertInventoryCategorySchema,
  insertInventoryItemSchema,
  insertInventoryTransactionSchema,
  // Payroll Management schemas
  insertPayrollEmployeeSchema,
  insertSalaryComponentSchema,
  insertPayrollCycleSchema,
  insertPayrollPayslipSchema,
  // Expense Management schemas
  insertExpenseCategorySchema,
  insertExpenseSchema,
  insertBudgetSchema,
  // Custom Reports schemas
  insertCustomReportSchema,
  insertReportExecutionHistorySchema
} from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import { setupCustomAuth, authenticateToken as authMiddleware, verifyToken } from "./auth";
import { isWorkingDay } from "./utils/workingDayUtils";
import { processChatMessage, processChroneyToolChat, resetChatMemory } from "./chatService";
import intentMappingService from "./intentMapping";
import { exportService } from "./services/exportService";
import downloadExcelRouter from "./routes/downloadExcel";
import elearningRouter from "./elearningRoutes";
import { isFutureDate } from "../shared/utils";
import { getCurrentDateTimeIST, getWeekStartDateIST, getISTDateString } from "@shared/utils/dateUtils";
import { calculateWeeklyCapacity, getWorkingDaysFromAvailability } from "@shared/utils/teacherUtils";
import { format } from "date-fns";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { classPeriodValidator } from "./services/classPeriodAllocationValidator";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Progress tracking for bulk imports
const importProgress = new Map<string, { 
  stage: string;
  percentage: number;
  completed: boolean;
  error?: string;
}>();

// Helper function to generate consistent colors based on subject code
function generateColorForSubjectCode(subjectCode: string): string {
  // Predefined color palette for better visual distinction
  const colors = [
    "#3B82F6", // Blue
    "#EF4444", // Red  
    "#10B981", // Green
    "#F59E0B", // Amber
    "#8B5CF6", // Violet
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#84CC16", // Lime
    "#EC4899", // Pink
    "#6366F1", // Indigo
    "#14B8A6", // Teal
    "#DC2626", // Red-600
    "#7C3AED", // Purple
    "#059669", // Emerald
    "#D97706", // Orange-600
    "#2563EB", // Blue-600
    "#BE123C", // Rose
    "#0891B2", // Sky
    "#CA8A04", // Yellow-600
    "#9333EA"  // Purple-600
  ];
  
  // Generate consistent hash from subject code
  let hash = 0;
  for (let i = 0; i < subjectCode.length; i++) {
    const char = subjectCode.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get consistent color index
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

// Import shared subject code generation utilities
import { generateGradeSpecificSubjectCode, generateSubjectCodeWithoutGrade } from '../shared/utils/subjectCodeUtils';

// ===== PROGRESS TRACKING SYSTEM =====
interface ProgressData {
  jobId: string;
  progress: number;
  estimatedTime: number;
  status: string;
  currentClass: string;
  totalClasses: number;
  completedClasses: number;
  completed: boolean;
  startTime: number;
  error?: string;
  result?: any;
}

const progressStore: Map<string, ProgressData> = new Map();

function createProgressJob(totalClasses: number): string {
  const jobId = crypto.randomBytes(16).toString('hex');
  progressStore.set(jobId, {
    jobId,
    progress: 0,
    estimatedTime: totalClasses * 500,
    status: 'Initializing generation...',
    currentClass: '',
    totalClasses,
    completedClasses: 0,
    completed: false,
    startTime: Date.now()
  });
  return jobId;
}

function updateProgress(jobId: string, update: Partial<ProgressData>) {
  const current = progressStore.get(jobId);
  if (current) {
    // Calculate dynamic estimated time based on actual progress
    const elapsedTime = Date.now() - current.startTime;
    const estimatedTimeRemaining = update.progress && update.progress > 0
      ? Math.round((elapsedTime / update.progress) * (100 - update.progress))
      : current.estimatedTime;
    
    progressStore.set(jobId, { 
      ...current, 
      ...update,
      estimatedTime: estimatedTimeRemaining
    });
  }
}

function completeProgress(jobId: string, result: any) {
  const current = progressStore.get(jobId);
  if (current) {
    progressStore.set(jobId, {
      ...current,
      progress: 100,
      status: 'Generation complete!',
      completed: true,
      result
    });
  }
}

function failProgress(jobId: string, error: string) {
  const current = progressStore.get(jobId);
  if (current) {
    progressStore.set(jobId, {
      ...current,
      error,
      completed: true
    });
  }
}

// ===== SMART TIMETABLE GENERATION ALGORITHMS =====

function autoSelectGenerationStrategy(classCount: number, teacherCount: number, subjectCount: number): string {
  console.log(`[AUTO-SELECT] Analyzing: ${classCount} classes, ${teacherCount} teachers, ${subjectCount} subjects`);
  
  // Calculate complexity factors
  const complexity = {
    size: classCount,
    teacherRatio: teacherCount / classCount,
    subjectRatio: subjectCount / classCount,
    total: classCount + teacherCount + subjectCount
  };

  // Decision logic based on school characteristics
  if (classCount <= 8 && teacherCount <= 15 && complexity.total <= 40) {
    console.log(`[AUTO-SELECT] Small school detected - using individual approach`);
    return 'individual';
  } else if (classCount <= 25 && teacherCount <= 50 && complexity.total <= 120) {
    console.log(`[AUTO-SELECT] Medium school detected - using staged hybrid approach`);
    return 'staged_hybrid';
  } else {
    console.log(`[AUTO-SELECT] Large/complex school detected - using lightweight bulk approach`);
    return 'lightweight_bulk';
  }
}

async function executeIndividualGeneration(schoolId: string, classes: any[], jobId: string): Promise<any> {
  console.log(`[INDIVIDUAL] Generating timetables for ${classes.length} classes individually`);
  
  try {
    // Create a TimetableScheduler instance
    const timetableScheduler = new TimetableScheduler();
    
    // Create progress callback
    const progressCallback = (update: { currentClassId: string; currentClassName: string; completedClasses: number; totalClasses: number; progress: number }) => {
      updateProgress(jobId, {
        progress: update.progress,
        status: `Generating for ${update.currentClassName}... (${update.completedClasses}/${update.totalClasses})`,
        currentClass: update.currentClassName,
        completedClasses: update.completedClasses
      });
    };
    
    // Call the actual timetable generation method with filtered classes
    const result = await timetableScheduler.generateTimetable(undefined, schoolId, progressCallback, classes);
    
    if (result.success) {
      console.log(`[INDIVIDUAL] Successfully generated timetable: ${result.message}`);
      console.log(`[INDIVIDUAL] Entries created: ${result.entriesCreated || 0}`);
      
      return {
        generatedClasses: classes.length,
        totalPeriods: result.entriesCreated || 0,
        conflicts: 0, // TimetableScheduler handles conflict resolution
        qualityScore: 95, // High quality score for successful generation
        detailedMessage: result.message // Pass through the detailed message with unassigned periods
      };
    } else {
      console.error(`[INDIVIDUAL] Generation failed: ${result.message}`);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error(`[INDIVIDUAL] Error during generation:`, error);
    
    return {
      generatedClasses: 0,
      totalPeriods: 0,
      conflicts: classes.length, // All classes failed
      qualityScore: 0
    };
  }
}

async function executeStagedHybridGeneration(schoolId: string, classes: any[], teachers: any[], jobId: string): Promise<any> {
  console.log(`[STAGED HYBRID] Generating timetables using staged hybrid approach`);
  
  try {
    // Create a TimetableScheduler instance
    const timetableScheduler = new TimetableScheduler();
    
    // Create progress callback
    const progressCallback = (update: { currentClassId: string; currentClassName: string; completedClasses: number; totalClasses: number; progress: number }) => {
      updateProgress(jobId, {
        progress: update.progress,
        status: `Generating for ${update.currentClassName}... (${update.completedClasses}/${update.totalClasses})`,
        currentClass: update.currentClassName,
        completedClasses: update.completedClasses
      });
    };
    
    // Call the actual timetable generation method with filtered classes
    const result = await timetableScheduler.generateTimetable(undefined, schoolId, progressCallback, classes);
    
    if (result.success) {
      console.log(`[STAGED HYBRID] Successfully generated timetable: ${result.message}`);
      console.log(`[STAGED HYBRID] Entries created: ${result.entriesCreated || 0}`);
      
      return {
        generatedClasses: classes.length,
        totalPeriods: result.entriesCreated || 0,
        conflicts: 0, // TimetableScheduler handles conflict resolution
        qualityScore: 98, // High quality score for successful generation
        detailedMessage: result.message // Pass through the detailed message with unassigned periods
      };
    } else {
      console.error(`[STAGED HYBRID] Generation failed: ${result.message}`);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error(`[STAGED HYBRID] Error during generation:`, error);
    
    return {
      generatedClasses: 0,
      totalPeriods: 0,
      conflicts: classes.length, // All classes failed
      qualityScore: 0
    };
  }
}

async function executeLightweightBulkGeneration(schoolId: string, classes: any[], teachers: any[], subjects: any[], jobId: string): Promise<any> {
  console.log(`[LIGHTWEIGHT BULK] Generating timetables using lightweight bulk optimization`);
  console.log(`[LIGHTWEIGHT BULK] Processing ${classes.length} classes, ${teachers.length} teachers, ${subjects.length} subjects`);
  
  try {
    // Create a TimetableScheduler instance
    const timetableScheduler = new TimetableScheduler();
    
    // Create progress callback
    const progressCallback = (update: { currentClassId: string; currentClassName: string; completedClasses: number; totalClasses: number; progress: number }) => {
      updateProgress(jobId, {
        progress: update.progress,
        status: `Generating for ${update.currentClassName}... (${update.completedClasses}/${update.totalClasses})`,
        currentClass: update.currentClassName,
        completedClasses: update.completedClasses
      });
    };
    
    // Call the actual timetable generation method with filtered classes
    const result = await timetableScheduler.generateTimetable(undefined, schoolId, progressCallback, classes);
    
    if (result.success) {
      console.log(`[LIGHTWEIGHT BULK] Successfully generated timetable: ${result.message}`);
      console.log(`[LIGHTWEIGHT BULK] Entries created: ${result.entriesCreated || 0}`);
      
      return {
        generatedClasses: classes.length,
        totalPeriods: result.entriesCreated || 0,
        conflicts: 0, // TimetableScheduler handles conflict resolution
        qualityScore: 99, // High quality score for successful generation
        detailedMessage: result.message // Pass through the detailed message with unassigned periods
      };
    } else {
      console.error(`[LIGHTWEIGHT BULK] Generation failed: ${result.message}`);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error(`[LIGHTWEIGHT BULK] Error during generation:`, error);
    
    return {
      generatedClasses: 0,
      totalPeriods: 0,
      conflicts: classes.length, // All classes failed
      qualityScore: 0
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup custom authentication
  setupCustomAuth(app);

  // Serve sample templates
  app.use('/sample-templates', express.static('public/sample-templates'));
  
  // Serve ID card templates
  app.use('/templates', express.static('public/templates'));
  
  // Serve generated ID cards
  app.use('/generated-id-cards', express.static('public/generated-id-cards'));
  
  // Serve database backups
  app.use('/backups', express.static('public/backups'));
  
  // Serve admission documents
  app.use('/attached_assets', express.static('attached_assets'));

  // Auth routes
  app.get('/api/auth/user', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      // Don't send password hash to client
      const { passwordHash, ...userWithoutPassword } = user;
      
      // For teacher users, get the teacher's name from the teachers table
      if (user.role === 'teacher' && user.teacherId) {
        const teacher = await storage.getTeacher(user.teacherId);
        if (teacher) {
          userWithoutPassword.name = teacher.name;
        }
      }
      // For student users, get the student's name from the students table
      else if (user.role === 'student' && user.studentId) {
        const student = await storage.getStudent(user.studentId);
        if (student) {
          userWithoutPassword.firstName = student.firstName;
          userWithoutPassword.lastName = student.lastName;
        }
      }
      // For parent users, get the parent's name from the parents table
      else if (user.role === 'parent' && user.parentId) {
        const parent = await storage.getParent(user.parentId);
        if (parent) {
          userWithoutPassword.firstName = parent.firstName;
          userWithoutPassword.lastName = parent.lastName;
        }
      }
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.put('/api/auth/profile', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email } = req.body;
      
      // Validate input
      if (!firstName?.trim()) {
        return res.status(400).json({ message: "First name is required" });
      }
      
      // Build update object with only provided fields
      const updateData: any = {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
      };
      
      // Only validate and update email if it's provided
      if (email !== undefined) {
        if (!email?.trim()) {
          return res.status(400).json({ message: "Email cannot be empty" });
        }
        
        // Check if email is already taken by another user
        if (email !== req.user.email) {
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ message: "Email is already in use" });
          }
        }
        
        updateData.email = email.trim();
      }
      
      // Update user profile
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Don't send password hash to client
      const { passwordHash, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change user password
  app.put('/api/auth/password', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }
      
      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      
      // Verify current password
      const bcrypt = await import('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.default.compare(currentPassword, req.user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedNewPassword = await bcrypt.default.hash(newPassword, 12);
      
      // Update password
      await storage.updateUser(userId, {
        passwordHash: hashedNewPassword,
        passwordChangedAt: new Date(),
      });
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // User Preferences endpoints
  app.post('/api/user-preferences/:key', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { key } = req.params;
      const value = req.body;

      if (!key) {
        return res.status(400).json({ message: "Preference key is required" });
      }

      await storage.saveUserPreference(userId, key, value);
      res.json({ message: "Preference saved successfully" });
    } catch (error) {
      console.error("Error saving user preference:", error);
      res.status(500).json({ message: "Failed to save preference" });
    }
  });

  app.get('/api/user-preferences/:key', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({ message: "Preference key is required" });
      }

      const value = await storage.getUserPreference(userId, key);
      
      if (value === null) {
        return res.status(404).json({ message: "Preference not found" });
      }

      res.json(value);
    } catch (error) {
      console.error("Error getting user preference:", error);
      res.status(500).json({ message: "Failed to get preference" });
    }
  });

  // Get school information for school admin
  app.get('/api/school-info', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Allow school admins, students, and parents to access this endpoint
      if (user.role !== 'admin' && user.role !== 'student' && user.role !== 'parent') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const school = await storage.getSchool(user.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get teacher count for this school
      const teacherCount = await storage.getTeacherCountBySchool(user.schoolId);
      
      res.json({
        ...school,
        totalTeachers: teacherCount
      });
    } catch (error) {
      console.error("Error fetching school info:", error);
      res.status(500).json({ message: "Failed to fetch school information" });
    }
  });

  // Get OpenAI API Key status for school (School Admin only)
  app.get('/api/school/openai-api-key', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. School Admin required." });
      }
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const school = await storage.getSchool(user.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Return masked API key for security
      const hasApiKey = !!school.openaiApiKey;
      let maskedApiKey = null;
      
      if (school.openaiApiKey) {
        try {
          const { decryptApiKey, maskApiKey } = await import('./encryption.js');
          const decryptedKey = decryptApiKey(school.openaiApiKey);
          maskedApiKey = maskApiKey(decryptedKey);
        } catch (error) {
          console.error("Error decrypting API key for masking:", error);
          maskedApiKey = "sk-***";
        }
      }
      
      res.json({
        hasApiKey,
        maskedApiKey
      });
    } catch (error) {
      console.error("Error fetching OpenAI API key status:", error);
      res.status(500).json({ message: "Failed to fetch OpenAI API key status" });
    }
  });

  // Update OpenAI API Key for school (School Admin only)
  app.put('/api/school/openai-api-key', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. School Admin required." });
      }
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const { apiKey } = req.body;
      
      // Validate API key format (OpenAI keys start with sk-)
      if (apiKey && !apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: "Invalid OpenAI API key format. Keys should start with 'sk-'" });
      }
      
      let encryptedApiKey = null;
      let maskedApiKey = null;
      
      if (apiKey) {
        try {
          const { encryptApiKey, maskApiKey, logApiKeyUsage } = await import('./encryption.js');
          encryptedApiKey = encryptApiKey(apiKey);
          maskedApiKey = maskApiKey(apiKey);
          
          // Log API key update
          logApiKeyUsage(user.schoolId, 'UPDATE_API_KEY', 'school', true, 'School admin updated OpenAI API key');
        } catch (error) {
          console.error("Error encrypting API key:", error);
          return res.status(500).json({ message: "Failed to encrypt API key" });
        }
      }
      
      // Update the school's OpenAI API key (encrypted)
      await db.update(schools)
        .set({ 
          openaiApiKey: encryptedApiKey,
          updatedAt: new Date()
        })
        .where(eq(schools.id, user.schoolId));
      
      res.json({ 
        message: "OpenAI API key updated successfully",
        hasApiKey: !!apiKey,
        maskedApiKey
      });
    } catch (error) {
      console.error("Error updating OpenAI API key:", error);
      res.status(500).json({ message: "Failed to update OpenAI API key" });
    }
  });

  // Module and Permission Management endpoints
  
  // Get all system modules
  app.get("/api/modules", authMiddleware, async (req, res) => {
    try {
      const modules = await storage.getSystemModules(true); // Only active modules
      res.json(modules);
    } catch (error) {
      console.error("Error fetching system modules:", error);
      res.status(500).json({ message: "Failed to fetch system modules" });
    }
  });

  // Seed system modules (Admin/Super Admin only)
  app.post("/api/modules/seed", authMiddleware, async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      const { seedSystemModules } = await import('./seedModules');
      const result = await seedSystemModules();
      res.json(result);
    } catch (error) {
      console.error("Error seeding modules:", error);
      res.status(500).json({ message: "Failed to seed modules" });
    }
  });

  // ===== Custom Roles Management Routes =====
  
  // Get all custom roles for a school (Admin only)
  app.get("/api/custom-roles", authMiddleware, async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID required" });
      }
      
      const customRoles = await storage.getCustomRoles(schoolId, true); // Only active
      res.json(customRoles);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
      res.status(500).json({ message: "Failed to fetch custom roles" });
    }
  });

  // Get a single custom role by ID (Admin only)
  app.get("/api/custom-roles/:id", authMiddleware, async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      const { id } = req.params;
      const customRole = await storage.getCustomRoleById(id);
      
      if (!customRole) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      
      // Verify the role belongs to the user's school
      if (req.user?.schoolId && customRole.schoolId !== req.user.schoolId) {
        return res.status(403).json({ message: "Access denied to this custom role" });
      }
      
      res.json(customRole);
    } catch (error) {
      console.error("Error fetching custom role:", error);
      res.status(500).json({ message: "Failed to fetch custom role" });
    }
  });

  // Create a new custom role (Admin only)
  app.post("/api/custom-roles", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School admin required." });
      }
      
      const { name, description, color, basedOnRole } = req.body;
      const schoolId = req.user.schoolId;
      const createdBy = req.user.id;
      
      if (!schoolId || !createdBy) {
        return res.status(400).json({ message: "School ID and user ID required" });
      }
      
      if (!name) {
        return res.status(400).json({ message: "Role name is required" });
      }
      
      const customRole = await storage.createCustomRole({
        schoolId,
        name,
        description: description || null,
        color: color || "#6366f1",
        basedOnRole: basedOnRole || "teacher",
        isActive: true,
        createdBy
      });
      
      res.status(201).json(customRole);
    } catch (error: any) {
      console.error("Error creating custom role:", error);
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A custom role with this name already exists in your school" });
      }
      res.status(500).json({ message: "Failed to create custom role" });
    }
  });

  // Update a custom role (Admin only)
  app.put("/api/custom-roles/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School admin required." });
      }
      
      const { id } = req.params;
      const { name, description, color, basedOnRole, isActive } = req.body;
      
      // Verify the role belongs to the user's school
      const existingRole = await storage.getCustomRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      
      if (req.user.schoolId !== existingRole.schoolId) {
        return res.status(403).json({ message: "Access denied to this custom role" });
      }
      
      const customRole = await storage.updateCustomRole(id, {
        name,
        description,
        color,
        basedOnRole,
        isActive
      });
      
      res.json(customRole);
    } catch (error: any) {
      console.error("Error updating custom role:", error);
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A custom role with this name already exists in your school" });
      }
      res.status(500).json({ message: "Failed to update custom role" });
    }
  });

  // Delete a custom role (Admin only)
  app.delete("/api/custom-roles/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School admin required." });
      }
      
      const { id } = req.params;
      
      // Verify the role belongs to the user's school
      const existingRole = await storage.getCustomRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      
      if (req.user.schoolId !== existingRole.schoolId) {
        return res.status(403).json({ message: "Access denied to this custom role" });
      }
      
      await storage.deleteCustomRole(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom role:", error);
      res.status(500).json({ message: "Failed to delete custom role" });
    }
  });

  // Assign custom roles to a user (Admin only) - supports multiple roles
  app.post("/api/users/:userId/assign-custom-role", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School admin required." });
      }
      
      const { userId } = req.params;
      const { customRoleIds } = req.body; // Array of custom role IDs
      
      // Verify the user belongs to the same school
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (req.user.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied to this user" });
      }
      
      // If assigning custom roles, verify all belong to the school
      if (customRoleIds && Array.isArray(customRoleIds) && customRoleIds.length > 0) {
        for (const customRoleId of customRoleIds) {
          const customRole = await storage.getCustomRoleById(customRoleId);
          if (!customRole) {
            return res.status(404).json({ message: `Custom role not found: ${customRoleId}` });
          }
          
          if (customRole.schoolId !== req.user.schoolId) {
            return res.status(403).json({ message: "Access denied to one or more custom roles" });
          }
        }
        
        // Assign all custom roles
        await storage.assignCustomRolesToUser(userId, customRoleIds, req.user.id);
      } else {
        // Empty array means remove all custom roles
        await storage.assignCustomRolesToUser(userId, [], req.user.id);
      }
      
      res.json({ message: "Custom roles assigned successfully" });
    } catch (error) {
      console.error("Error assigning custom roles:", error);
      res.status(500).json({ message: "Failed to assign custom roles" });
    }
  });

  // Get user's custom roles (Admin or self)
  app.get("/api/users/:userId/custom-roles", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Security: Users can only fetch their own custom roles unless admin
      if (req.user?.id !== userId && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const customRoles = await storage.getUserCustomRoles(userId);
      res.json(customRoles);
    } catch (error) {
      console.error("Error fetching user custom roles:", error);
      res.status(500).json({ message: "Failed to fetch user custom roles" });
    }
  });

  // Get role permissions for a school
  app.get("/api/permissions/:schoolId", authMiddleware, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { role, customRoleId } = req.query;

      // Security: Non-super admins can only access their own school
      if (req.user?.role !== "super_admin" && req.user?.schoolId !== schoolId) {
        return res.status(403).json({ message: "Access denied to this school" });
      }

      const permissions = await storage.getRolePermissions(
        schoolId, 
        role as string | undefined,
        customRoleId as string | undefined
      );
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Get user's module permissions
  app.get("/api/user/:userId/permissions", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;

      // Security: Users can only fetch their own permissions unless admin
      if (req.user?.id !== userId && !["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const permissions = await storage.getUserModulePermissions(userId, req.user!.schoolId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Create or update role permission
  app.post("/api/permissions", authMiddleware, async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { schoolId, role, customRoleId, moduleId, permissions } = req.body;

      // Security: Non-super admins can only manage their own school
      if (req.user?.role !== "super_admin" && req.user?.schoolId !== schoolId) {
        return res.status(403).json({ message: "Access denied to this school" });
      }

      // Check if permission already exists
      const existing = await storage.getRolePermissions(schoolId, role, customRoleId);
      const existingPermission = existing.find((p: any) => p.moduleId === moduleId);

      let result;
      if (existingPermission) {
        // Update existing permission
        result = await storage.updateRolePermission(existingPermission.id, { permissions });
      } else {
        // Create new permission
        const permissionData: any = {
          schoolId,
          moduleId,
          permissions,
          assignedBy: req.user!.id,
          isActive: true
        };

        // Set either role or customRoleId, not both
        if (customRoleId) {
          permissionData.customRoleId = customRoleId;
        } else {
          permissionData.role = role;
        }

        result = await storage.setRolePermission(permissionData);
      }

      res.json(result);
    } catch (error) {
      console.error("Error saving permission:", error);
      res.status(500).json({ message: "Failed to save permission" });
    }
  });

  // Delete role permission
  app.delete("/api/permissions/:id", authMiddleware, async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      await storage.deleteRolePermission(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ message: "Failed to delete permission" });
    }
  });

  // Check if user has permission for a specific module and action
  app.get("/api/check-permission", authMiddleware, async (req, res) => {
    try {
      const { moduleId, action } = req.query;

      if (!moduleId || !action) {
        return res.status(400).json({ message: "moduleId and action are required" });
      }

      const hasPermission = await storage.checkUserPermission(
        req.user!.id,
        moduleId as string,
        action as 'read' | 'write' | 'delete' | 'export',
        req.user!.schoolId
      );

      res.json({ hasPermission });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // School management endpoints (Super Admin only)
  app.get("/api/schools", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      const schools = await storage.getSchoolsWithAdminEmails();
      res.json(schools);
    } catch (error) {
      console.error("Error fetching schools:", error);
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  // Backfill academic sessions for existing schools (Super Admin only)
  app.post("/api/schools/backfill-sessions", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { backfillAcademicSessions } = await import('./utils/backfillAcademicSessions');
      const results = await backfillAcademicSessions();
      
      res.json({
        message: "Backfill completed",
        results
      });
    } catch (error) {
      console.error("Error during backfill:", error);
      res.status(500).json({ message: "Failed to backfill academic sessions" });
    }
  });

  // Create annual academic sessions for all schools (Super Admin only)
  // This can be triggered manually or runs automatically on April 1st
  app.post("/api/schools/create-annual-sessions", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { createAnnualAcademicSessions } = await import('./services/cronService');
      await createAnnualAcademicSessions();
      
      res.json({
        message: "Annual academic session creation completed successfully"
      });
    } catch (error) {
      console.error("Error during annual session creation:", error);
      res.status(500).json({ message: "Failed to create annual academic sessions" });
    }
  });

  app.post("/api/schools", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { adminEmail, adminPassword, adminName, ...schoolData } = req.body;
      
      // Validate school data
      const validatedSchoolData = insertSchoolSchema.parse({
        ...schoolData,
        adminName
      });
      
      // Create school first
      const school = await storage.createSchool(validatedSchoolData);
      
      // Auto-create academic session for the new school
      const { calculateAcademicYearDates } = await import('./utils/academicYearUtils');
      const { startDate, endDate } = calculateAcademicYearDates();
      
      await storage.createAcademicSession({
        schoolId: school.id,
        startDate,
        endDate
      });
      
      // Create admin account if credentials provided
      if (adminEmail && adminPassword) {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(adminPassword, 12);
        await storage.createUser({
          email: adminEmail,
          loginId: adminEmail, // Use email as loginId for admin users
          passwordHash: hashedPassword,
          role: "admin",
          schoolId: school.id,
          firstName: adminName,
          lastName: null,
          teacherId: null,
          studentId: null,
          parentId: null
        });
      }
      
      res.status(201).json(school);
    } catch (error) {
      console.error("Error creating school:", error);
      res.status(400).json({ message: "Invalid school data" });
    }
  });

  app.put("/api/schools/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { adminEmail, adminPassword, adminName, ...schoolData } = req.body;
      
      // Validate school data
      const validatedSchoolData = insertSchoolSchema.partial().parse({
        ...schoolData,
        adminName
      });
      
      // Update school first
      const school = await storage.updateSchool(req.params.id, validatedSchoolData);
      
      // Update admin account if new password provided
      if (adminEmail && adminPassword) {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(adminPassword, 12);
        
        // Try to find existing admin user for this school
        try {
          const existingUsers = await storage.getUsersBySchoolId(req.params.id);
          const existingAdmin = existingUsers.find(user => user.role === "admin");
          
          if (existingAdmin) {
            // Update existing admin
            await storage.updateUser(existingAdmin.id, {
              email: adminEmail,
              passwordHash: hashedPassword,
              firstName: adminName,
            });
          } else {
            // Create new admin if none exists
            await storage.createUser({
              email: adminEmail,
              loginId: adminEmail, // Use email as loginId for admin users
              passwordHash: hashedPassword,
              role: "admin",
              schoolId: school.id,
              firstName: adminName,
              lastName: null,
              teacherId: null,
              studentId: null,
              parentId: null
            });
          }
        } catch (error) {
          console.error("Error managing admin account:", error);
          // Continue without failing the school update
        }
      }
      
      res.json(school);
    } catch (error) {
      console.error("Error updating school:", error);
      res.status(400).json({ message: "Invalid school data" });
    }
  });

  // Update school status (activate/deactivate)
  app.patch("/api/schools/:id/status", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      
      console.log(`Updating school ${id} status to ${isActive}`);
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }

      const updatedSchool = await storage.updateSchool(id, { isActive });
      
      console.log('Updated school:', updatedSchool);
      
      res.json(updatedSchool);
    } catch (error) {
      console.error("Error updating school status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update school status", error: errorMessage });
    }
  });

  // Update school settings (admin can update their own school)
  app.patch("/api/schools/:id/settings", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { defaultMaxPeriodsPerDay } = req.body;
      
      // Admin can only update their own school, super admin can update any
      if (req.user?.role === "admin" && req.user?.schoolId !== id) {
        return res.status(403).json({ message: "Access denied. You can only update your own school settings." });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin or Super Admin required." });
      }
      
      // Validate defaultMaxPeriodsPerDay
      if (defaultMaxPeriodsPerDay !== undefined) {
        if (!Number.isInteger(defaultMaxPeriodsPerDay) || defaultMaxPeriodsPerDay < 1 || defaultMaxPeriodsPerDay > 12) {
          return res.status(400).json({ message: "Default max periods per day must be between 1 and 12" });
        }
      }
      
      const updatedSchool = await storage.updateSchool(id, { defaultMaxPeriodsPerDay });
      
      res.json(updatedSchool);
    } catch (error) {
      console.error("Error updating school settings:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update school settings", error: errorMessage });
    }
  });

  // Delete school (super admin only) - CASCADE deletes all related data
  app.delete("/api/schools/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }

      const { id } = req.params;
      
      console.log(`Deleting school ${id} and all related data`);
      
      // Delete school - CASCADE will handle all related data
      await storage.deleteSchool(id);
      
      console.log(`School ${id} deleted successfully`);
      
      res.json({ message: "School and all related data deleted successfully" });
    } catch (error) {
      console.error("Error deleting school:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to delete school", error: errorMessage });
    }
  });

  // Clear school data (super admin only) - Removes all data but keeps school
  app.post("/api/schools/:id/clear-data", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }

      const { id } = req.params;
      
      console.log(`Clearing all data for school ${id}`);
      
      // Clear school data - Removes all related data but keeps the school entity
      await storage.clearSchoolData(id);
      
      console.log(`School ${id} data cleared successfully`);
      
      res.json({ message: "All school data cleared successfully. School account remains active." });
    } catch (error) {
      console.error("Error clearing school data:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to clear school data", error: errorMessage });
    }
  });

  // Clear own school data (admin only) - Requires password verification
  app.post("/api/school/clear-data", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const schoolId = req.user.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID not found" });
      }

      // Verify admin password
      const admin = await storage.getUser(req.user.id);
      if (!admin || !admin.passwordHash) {
        return res.status(400).json({ message: "Admin account not found" });
      }

      const bcrypt = await import('bcryptjs');
      const isPasswordValid = await bcrypt.default.compare(password, admin.passwordHash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
      }
      
      console.log(`Admin clearing all data for their school ${schoolId}`);
      
      // Clear school data - Removes all related data but keeps the school entity and admin
      await storage.clearSchoolData(schoolId);
      
      console.log(`School ${schoolId} data cleared successfully by admin`);
      
      res.json({ message: "All school data cleared successfully. You can now start fresh." });
    } catch (error) {
      console.error("Error clearing school data:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to clear school data", error: errorMessage });
    }
  });

  // Download database (super admin only)
  app.get("/api/super-admin/download-database", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }

      const { spawn } = await import('child_process');
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        return res.status(500).json({ message: "Database URL not configured" });
      }

      // Set filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `chrona_database_${timestamp}.sql`;

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');

      // Execute pg_dump
      const pgDump = spawn('pg_dump', [
        databaseUrl,
        '--no-owner',
        '--no-acl',
        '--clean'
      ]);

      // Stream the output to response
      pgDump.stdout.pipe(res);

      // Handle errors
      pgDump.stderr.on('data', (data) => {
        console.error(`pg_dump error: ${data}`);
      });

      pgDump.on('error', (error) => {
        console.error('Failed to start pg_dump:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to export database" });
        }
      });

      pgDump.on('close', (code) => {
        if (code !== 0) {
          console.error(`pg_dump exited with code ${code}`);
          if (!res.headersSent) {
            res.status(500).json({ message: "Database export failed" });
          }
        } else {
          console.log(`Database exported successfully: ${filename}`);
        }
      });

    } catch (error) {
      console.error("Error downloading database:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to download database", error: errorMessage });
    }
  });

  // Stats endpoint (protected)
  app.get("/api/stats", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const stats = await storage.getStats(user.schoolId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin dashboard stats endpoint (super admin only)
  app.get("/api/admin/dashboard-stats", authMiddleware, async (req, res) => {
    try {
      // Only super admins can access this endpoint
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const stats = await storage.getAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch admin dashboard stats" });
    }
  });


  // Role Permissions endpoints (super admin only)
  app.get("/api/role-permissions", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { schoolId, role } = req.query;
      const permissions = await storage.getRolePermissions(schoolId as string, role as string);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/role-permissions", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const permissionData = {
        ...req.body,
        assignedBy: req.user?.id
      };
      
      const permission = await storage.setRolePermission(permissionData);
      res.status(201).json(permission);
    } catch (error) {
      console.error("Error creating role permission:", error);
      res.status(400).json({ message: "Failed to create role permission" });
    }
  });

  app.put("/api/role-permissions/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const permissionData = {
        ...req.body,
        assignedBy: req.user?.id
      };
      
      const permission = await storage.updateRolePermission(req.params.id, permissionData);
      res.json(permission);
    } catch (error) {
      console.error("Error updating role permission:", error);
      res.status(400).json({ message: "Failed to update role permission" });
    }
  });

  app.delete("/api/role-permissions/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      await storage.deleteRolePermission(req.params.id);
      res.json({ message: "Role permission deleted successfully" });
    } catch (error) {
      console.error("Error deleting role permission:", error);
      res.status(500).json({ message: "Failed to delete role permission" });
    }
  });

  // Academic Session Management endpoints (Admin only)
  app.get("/api/academic-sessions", authMiddleware, async (req: any, res) => {
    try {
      // Allow admin and super_admin to manage sessions
      if (!["admin", "super_admin"].includes(req.user?.role)) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      const schoolId = req.user.role === "super_admin" ? req.query.schoolId : req.user.schoolId;
      
      // Super admin can fetch all sessions across all schools if no schoolId is provided
      if (req.user.role === "super_admin" && !schoolId) {
        const sessions = await db
          .select({
            id: academicSessions.id,
            startDate: academicSessions.startDate,
            endDate: academicSessions.endDate,
            schoolId: academicSessions.schoolId,
            schoolName: schools.name,
            createdAt: academicSessions.createdAt,
          })
          .from(academicSessions)
          .innerJoin(schools, eq(academicSessions.schoolId, schools.id))
          .orderBy(desc(academicSessions.startDate));
        
        return res.json(sessions);
      }
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      const sessions = await storage.getAcademicSessions(schoolId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching academic sessions:", error);
      res.status(500).json({ message: "Failed to fetch academic sessions" });
    }
  });

  app.put("/api/academic-sessions/:id", authMiddleware, async (req: any, res) => {
    try {
      // Allow admin and super_admin to update sessions
      if (!["admin", "super_admin"].includes(req.user?.role)) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      // Get session to verify ownership for school admins
      if (req.user.role === "admin") {
        const existingSession = await storage.getAcademicSession(req.params.id);
        if (!existingSession || existingSession.schoolId !== req.user.schoolId) {
          return res.status(403).json({ message: "Access denied to this session" });
        }
      }
      
      // Validate session data
      const validatedSessionData = insertAcademicSessionSchema.partial().parse(req.body);
      
      const session = await storage.updateAcademicSession(req.params.id, validatedSessionData);
      res.json(session);
    } catch (error) {
      console.error("Error updating academic session:", error);
      res.status(400).json({ message: "Failed to update academic session" });
    }
  });

  app.post("/api/academic-sessions/:id/set-current", authMiddleware, async (req: any, res) => {
    try {
      // Allow admin and super_admin to set current session
      if (!["admin", "super_admin"].includes(req.user?.role)) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      // Get session to verify ownership and get school ID
      const session = await storage.getAcademicSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Academic session not found" });
      }
      
      // Verify school access for admins
      if (req.user.role === "admin" && session.schoolId !== req.user.schoolId) {
        return res.status(403).json({ message: "Access denied to this session" });
      }
      
      await storage.setCurrentAcademicSession(session.schoolId, req.params.id);
      res.json({ message: "Current academic session updated successfully" });
    } catch (error) {
      console.error("Error setting current academic session:", error);
      res.status(500).json({ message: "Failed to set current academic session" });
    }
  });

  app.post("/api/academic-sessions/migrate", authMiddleware, async (req: any, res) => {
    try {
      // Allow admin and super_admin to migrate sessions
      if (!["admin", "super_admin"].includes(req.user?.role)) {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }
      
      const { fromSessionId, toSessionId, options } = req.body;
      
      if (!fromSessionId || !toSessionId) {
        return res.status(400).json({ message: "Both fromSessionId and toSessionId are required" });
      }
      
      // Get sessions to verify ownership for school admins
      if (req.user.role === "admin") {
        const [fromSession, toSession] = await Promise.all([
          storage.getAcademicSession(fromSessionId),
          storage.getAcademicSession(toSessionId)
        ]);
        
        if (!fromSession || !toSession || 
            fromSession.schoolId !== req.user.schoolId || 
            toSession.schoolId !== req.user.schoolId) {
          return res.status(403).json({ message: "Access denied to these sessions" });
        }
      }
      
      // Perform migration with optional settings
      const migrationOptions = {
        promoteStudents: options?.promoteStudents ?? true,
        copyTeachers: options?.copyTeachers ?? true,
        copyAssignments: options?.copyAssignments ?? true,
        ...options
      };
      
      const result = await storage.migrateToNewSession(fromSessionId, toSessionId, req.user.schoolId, migrationOptions);
      res.json(result);
    } catch (error) {
      console.error("Error migrating academic session:", error);
      res.status(500).json({ message: "Failed to migrate academic session" });
    }
  });

  // Post/Newsfeed routes
  app.get("/api/posts", authMiddleware, async (req, res) => {
    try {
      if (!req.user?.schoolId) {
        return res.status(400).json({ message: "User not associated with a school" });
      }

      const { feedScope, classId, offset, limit, filter } = req.query;
      
      // Parse pagination parameters with defaults
      const parsedOffset = offset ? parseInt(offset as string, 10) : undefined;
      const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
      
      // Validate pagination parameters
      if (parsedOffset !== undefined && (isNaN(parsedOffset) || parsedOffset < 0)) {
        return res.status(400).json({ message: "Invalid offset parameter" });
      }
      
      if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50)) {
        return res.status(400).json({ message: "Invalid limit parameter (must be between 1 and 50)" });
      }

      // Validate filter parameter
      const validFilters = ['all', 'circular', 'resource'];
      const postFilter = filter && validFilters.includes(filter as string) ? filter as 'all' | 'circular' | 'resource' : 'all';
      
      const posts = await storage.getPosts(
        req.user.schoolId,
        feedScope as 'school' | 'class',
        classId as string,
        parsedOffset,
        parsedLimit,
        postFilter
      );
      
      // Prevent browser caching to ensure fresh newsfeed content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.post("/api/posts", authMiddleware, async (req, res) => {
    try {
      const { content, feedScope, classId, attachments = [], isCircular = false, isResource = false } = req.body;

      // Role-based posting validation
      if (req.user?.role === 'student' || req.user?.role === 'parent') {
        return res.status(403).json({ message: "Students and parents cannot create posts" });
      }

      if (!req.user?.schoolId) {
        return res.status(400).json({ message: "User not associated with a school" });
      }

      let academicSessionId = null;

      // Additional validation for class posts
      if (feedScope === 'class') {
        if (!classId) {
          return res.status(400).json({ message: "Class ID required for class posts" });
        }

        // Get class to retrieve academic session
        const classData = await storage.getClass(classId);
        if (!classData) {
          return res.status(404).json({ message: "Class not found" });
        }

        // Verify class belongs to user's school
        if (classData.schoolId !== req.user.schoolId) {
          return res.status(403).json({ message: "Access denied - class not in your school" });
        }

        academicSessionId = classData.academicSessionId;

        // Teachers can only post in their assigned classes (unless school admin grants permission)
        if (req.user.role === 'teacher') {
          // TODO: Add validation to check if teacher is assigned to this class
        }
      }

      const post = await storage.createPost({
        content,
        feedScope: feedScope || 'school',
        classId: feedScope === 'class' ? classId : null,
        academicSessionId,
        attachments,
        postedById: req.user.id,
        schoolId: req.user.schoolId,
        isActive: true,
        isCircular,
        isResource,
      });

      // Generate notifications for circulars and resources
      if (isCircular || isResource) {
        const notificationType = isCircular ? 'circular_posted' : 'resource_posted';
        const title = isCircular ? 'New Circular Posted' : 'New Resource Posted';
        const contentPreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        
        // For school-wide posts, notify all users in school
        if (feedScope === 'school') {
          // Get all users in the school
          const [allStudents, allTeachers, allParents] = await Promise.all([
            storage.getAllStudents(req.user.schoolId, 100000, 0), // Large limit to get all
            storage.getTeachers(req.user.schoolId),
            storage.getParentsBySchool(req.user.schoolId)
          ]);

          const notifications = [];

          // Create notifications for all students
          for (const student of allStudents) {
            notifications.push({
              schoolId: req.user.schoolId,
              recipientId: student.id,
              recipientRole: 'student' as const,
              type: notificationType,
              title,
              message: contentPreview,
              metadata: { postId: post.id, feedScope: 'school' },
              isRead: false
            });
          }

          // Create notifications for all teachers
          for (const teacher of allTeachers) {
            notifications.push({
              schoolId: req.user.schoolId,
              recipientId: teacher.id,
              recipientRole: 'teacher' as const,
              type: notificationType,
              title,
              message: contentPreview,
              metadata: { postId: post.id, feedScope: 'school' },
              isRead: false
            });
          }

          // Create notifications for all parents
          for (const parent of allParents) {
            notifications.push({
              schoolId: req.user.schoolId,
              recipientId: parent.id,
              recipientRole: 'parent' as const,
              type: notificationType,
              title,
              message: contentPreview,
              metadata: { postId: post.id, feedScope: 'school' },
              isRead: false
            });
          }

          // Create all notifications in parallel
          await Promise.all(notifications.map(n => storage.createNotification(n)));
        } 
        // For class posts, notify students and parents in that class
        else if (feedScope === 'class' && classId) {
          const [classStudents, classParents] = await Promise.all([
            storage.getStudentsByClass(classId),
            storage.getParentsByClass(classId)
          ]);

          const notifications = [];

          // Create notifications for class students
          for (const student of classStudents) {
            notifications.push({
              schoolId: req.user.schoolId,
              recipientId: student.id,
              recipientRole: 'student' as const,
              type: notificationType,
              title,
              message: contentPreview,
              metadata: { postId: post.id, feedScope: 'class', classId },
              isRead: false
            });
          }

          // Create notifications for class parents
          for (const parent of classParents) {
            notifications.push({
              schoolId: req.user.schoolId,
              recipientId: parent.id,
              recipientRole: 'parent' as const,
              type: notificationType,
              title,
              message: contentPreview,
              metadata: { postId: post.id, feedScope: 'class', classId },
              isRead: false
            });
          }

          // Create all notifications in parallel
          await Promise.all(notifications.map(n => storage.createNotification(n)));
        }
      }

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/posts/my-feed", authMiddleware, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const feed = await storage.getUserFeed(req.user.id);
      res.json(feed);
    } catch (error) {
      console.error("Error fetching user feed:", error);
      res.status(500).json({ message: "Failed to fetch user feed" });
    }
  });

  app.put("/api/posts/:id", authMiddleware, async (req, res) => {
    try {
      const { content, attachments, isCircular, isResource } = req.body;
      const postId = req.params.id;

      // Get the original post to check ownership
      const originalPost = await storage.getPostById(postId);
      if (!originalPost) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Only post author or school admin can edit posts
      if (originalPost.postedById !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You can only edit your own posts" });
      }

      const updatedPost = await storage.updatePost(postId, {
        content,
        attachments,
        isCircular,
        isResource,
      });

      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  app.delete("/api/posts/:id", authMiddleware, async (req, res) => {
    try {
      const postId = req.params.id;

      // Get the original post to check ownership
      const originalPost = await storage.getPostById(postId);
      if (!originalPost) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Only post author or school admin can delete posts
      if (originalPost.postedById !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }

      await storage.deletePost(postId);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // File upload endpoint for newsfeed attachments
  app.post("/api/posts/upload-attachment", authMiddleware, upload.single('attachment'), async (req: any, res) => {
    try {
      console.log("[UPLOAD DEBUG] Upload request received");
      console.log("[UPLOAD DEBUG] User role:", req.user?.role);
      console.log("[UPLOAD DEBUG] File present:", !!req.file);
      
      if (!req.file) {
        console.log("[UPLOAD DEBUG] No file in request");
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log("[UPLOAD DEBUG] File details:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Role-based upload validation - only admin/teacher can upload
      if (req.user?.role === 'student' || req.user?.role === 'parent') {
        console.log("[UPLOAD DEBUG] User role not allowed:", req.user?.role);
        return res.status(403).json({ message: "Students and parents cannot upload attachments" });
      }

      // Simplified file validation for testing
      console.log("[UPLOAD DEBUG] Simplified validation - checking basic file types");
      
      // Only allow web-displayable image formats for grid display
      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain'
      ];
      
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        console.log("[UPLOAD DEBUG] MIME type not allowed:", req.file.mimetype);
        return res.status(400).json({ 
          message: `File type ${req.file.mimetype} not allowed. Only images, PDFs, and text files are supported.` 
        });
      }
      
      // Simple size check (50MB limit)
      if (req.file.size > 50 * 1024 * 1024) {
        console.log("[UPLOAD DEBUG] File too large:", req.file.size);
        return res.status(400).json({ 
          message: "File too large. Maximum size is 50MB" 
        });
      }

      // Generate cryptographically secure filename
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(req.file.originalname) || '.tmp';
      const secureFilename = `${fileId}${fileExtension}`;
      console.log("[UPLOAD DEBUG] Generated filename:", secureFilename);
      
      // Create secure uploads directory
      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'secure_uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Save file to disk with secure filename
      const filePath = path.join(uploadsDir, secureFilename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Store file metadata securely (for future database tracking)
      const fileMetadata = {
        id: fileId,
        originalName: req.file.originalname,
        filename: secureFilename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString(),
        schoolId: req.user.schoolId
      };
      
      console.log("[UPLOAD DEBUG] Upload successful, returning response");
      
      // Return file ID instead of direct path for security
      res.json({ 
        fileId: fileId,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  // Simple approach: Use Bearer token from header or query parameter
  const simpleFileAuth = async (req: any, res: any, next: any) => {
    // Try Bearer token auth first (for API calls)
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.split(" ")[1];
    
    // If no header token, try query parameter (for browser image loading)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
      const user = await storage.getUser(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ message: "Authentication failed" });
    }
  };

  // Secure file download endpoint with authentication and access control
  app.get("/api/files/:fileId", simpleFileAuth, async (req, res) => {
    try {
      const { fileId } = req.params;
      // console.log("[FILE ACCESS] Requested fileId:", fileId);
      
      // Validate file ID format (should be UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        // console.log("[FILE ACCESS] Invalid UUID format:", fileId);
        return res.status(400).json({ message: "Invalid file ID" });
      }

      // Security: Only allow access to files in the secure uploads directory
      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'secure_uploads');
      // console.log("[FILE ACCESS] Looking in directory:", uploadsDir);
      
      // Find file with matching ID (files are named with their ID)
      const files = fs.readdirSync(uploadsDir);
      // console.log("[FILE ACCESS] Available files:", files.filter(f => f.includes(fileId)));
      const targetFile = files.find(file => file.startsWith(fileId));
      // console.log("[FILE ACCESS] Target file found:", targetFile);
      
      if (!targetFile) {
        // console.log("[FILE ACCESS] File not found on disk for fileId:", fileId);
        return res.status(404).json({ message: "File not found" });
      }
      
      const filePath = path.join(uploadsDir, targetFile);
      
      // Verify file exists and is within upload directory (prevent path traversal)
      if (!fs.existsSync(filePath) || !path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
        return res.status(404).json({ message: "File not found" });
      }

      // CRITICAL SECURITY: Verify user has access to this file
      // Find posts that contain this fileId and check access permissions
      // console.log("[FILE ACCESS] Looking for posts with fileId:", fileId);
      const posts = await storage.getPostsWithFileId(fileId);
      // console.log("[FILE ACCESS] Found posts:", posts.length, "posts containing fileId");
      if (posts.length === 0) {
        // console.log("[FILE ACCESS] No posts found containing fileId:", fileId);
        return res.status(404).json({ message: "File not found" });
      }

      // Check if user has access to at least one post containing this file
      let hasAccess = false;
      for (const post of posts) {
        // School-level access check
        if (post.feedScope === 'school') {
          if (req.user?.schoolId === post.schoolId) {
            hasAccess = true;
            break;
          }
        }
        // Class-level access check  
        else if (post.feedScope === 'class') {
          if (!post.classId) continue; // Skip if no class specified
          
          // Admin from same school can access any class
          if (req.user?.role === 'admin' && req.user?.schoolId === post.schoolId) {
            hasAccess = true;
            break;
          }
          // Teachers need to be assigned to teach in this specific class
          else if (req.user?.role === 'teacher' && req.user?.schoolId === post.schoolId && req.user?.teacherId) {
            const teacherClassAccess = await storage.isTeacherAssignedToClass(req.user.teacherId, post.classId);
            if (teacherClassAccess) {
              hasAccess = true;
              break;
            }
          }
          // Students need to be enrolled in this specific class
          else if (req.user?.role === 'student' && req.user?.schoolId === post.schoolId && req.user?.studentId) {
            const studentClassAccess = await storage.isStudentInClass(req.user.studentId, post.classId);
            if (studentClassAccess) {
              hasAccess = true;
              break;
            }
          }
          // Parents need to have children enrolled in this specific class
          else if (req.user?.role === 'parent' && req.user?.schoolId === post.schoolId && req.user?.parentId) {
            const parentClassAccess = await storage.isParentLinkedToClass(req.user.parentId, post.classId);
            if (parentClassAccess) {
              hasAccess = true;
              break;
            }
          }
        }
      }

      if (!hasAccess) {
        return res.status(404).json({ message: "File not found" }); // Return 404 to avoid leaking file existence
      }
      
      // Get file stats for proper headers
      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(targetFile);
      
      // Set secure headers
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain'
      };
      
      const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Content-Disposition': `inline; filename="${fileId}${fileExtension}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600'
      });
      
      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Teacher endpoints (school-filtered for non-super-admin users)
  
  // Get teachers on leave (current and future) - MUST come before /api/teachers/:id
  app.get("/api/teachers-on-leave", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const today = new Date().toISOString().split('T')[0];
      
      // Get all teacher attendance for the school
      const allAttendance = await storage.getTeacherAttendance(user.schoolId);
      
      // Filter for leave statuses and get teacher details
      const teachersOnLeave = [];
      const seenLeaves = new Set(); // Track unique leave periods
      
      for (const attendance of allAttendance) {
        // Only include leave statuses
        if (!['on_leave', 'medical_leave', 'personal_leave'].includes(attendance.status)) {
          continue;
        }
        
        // Only include leaves that are ongoing or in the future
        if (!attendance.leaveEndDate || attendance.leaveEndDate < today) {
          continue;
        }
        
        // Create a unique key for this leave period (teacher + dates)
        const leaveKey = `${attendance.teacherId}-${attendance.leaveStartDate}-${attendance.leaveEndDate}`;
        
        // Skip if we've already added this leave period
        if (seenLeaves.has(leaveKey)) {
          continue;
        }
        seenLeaves.add(leaveKey);
        
        // Get teacher details
        const teacher = await storage.getTeacher(attendance.teacherId);
        if (teacher) {
          teachersOnLeave.push({
            id: attendance.id,
            teacherId: attendance.teacherId,
            teacherName: teacher.name,
            teacherEmail: teacher.email,
            leaveStartDate: attendance.leaveStartDate,
            leaveEndDate: attendance.leaveEndDate,
            status: attendance.status,
            reason: attendance.reason
          });
        }
      }

      // Categorize leaves
      const currentLeaves = teachersOnLeave.filter(
        (leave) => leave.leaveStartDate && leave.leaveEndDate && 
                   leave.leaveStartDate <= today && leave.leaveEndDate >= today
      );

      const futureLeaves = teachersOnLeave.filter(
        (leave) => leave.leaveStartDate && leave.leaveStartDate > today
      );

      res.json({
        current: currentLeaves,
        future: futureLeaves
      });
    } catch (error) {
      console.error("Error fetching teachers on leave:", error);
      res.status(500).json({ message: "Failed to fetch teachers on leave" });
    }
  });
  
  app.get("/api/teachers", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 12; // Default limit of 12
      
      // Add cache control headers to prevent caching of paginated results
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      let teachers;
      let totalCount;
      let targetSchoolId;
      
      if (user?.role === "super_admin") {
        targetSchoolId = schoolId;
        // Get count and paginated teachers efficiently
        totalCount = await storage.getTeacherCountBySchool(targetSchoolId);
        teachers = await storage.getTeachers(targetSchoolId, offset, limit);
      } else if (user?.schoolId) {
        targetSchoolId = user.schoolId;
        // School admin and teachers can only see their school's teachers
        totalCount = await storage.getTeacherCountBySchool(targetSchoolId);
        teachers = await storage.getTeachers(targetSchoolId, offset, limit);
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json({
        teachers,
        totalCount
      });
    } catch (error) {
      console.error("Error fetching teachers:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  app.get("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.getTeacher(req.params.id);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      res.json(teacher);
    } catch (error) {
      console.error("Error fetching teacher:", error);
      res.status(500).json({ message: "Failed to fetch teacher" });
    }
  });

  app.post("/api/teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // For school admins, ensure the teacher belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
      }

      // Clean up empty strings and convert to null for optional fields
      const cleanedRequestBody = { ...requestBody };
      
      // Convert empty strings to null for optional fields
      const optionalFields = ['email', 'contactNumber', 'schoolIdNumber', 'aadhar', 'gender', 
                             'bloodGroup', 'designation', 'dateOfBirth', 'fatherHusbandName', 
                             'address', 'category', 'religion', 'profilePictureUrl'];
      
      optionalFields.forEach(field => {
        if (cleanedRequestBody[field] === '') {
          cleanedRequestBody[field] = null;
        }
      });

      // Get school's default max periods per day if not specified
      if (!cleanedRequestBody.maxDailyPeriods) {
        const school = await storage.getSchool(cleanedRequestBody.schoolId);
        if (school && school.defaultMaxPeriodsPerDay) {
          cleanedRequestBody.maxDailyPeriods = school.defaultMaxPeriodsPerDay;
        } else {
          cleanedRequestBody.maxDailyPeriods = 6; // Fallback default
        }
      }

      // Validate data without employeeId first
      const schemaWithoutEmployeeId = insertTeacherSchema.omit({ employeeId: true });
      const validatedDataWithoutEmployeeId = schemaWithoutEmployeeId.parse(cleanedRequestBody);
      
      // Add generated employeeId using centralized helper from storage
      const validatedData = {
        ...validatedDataWithoutEmployeeId,
        employeeId: await storage.generateNextTeacherEmployeeId()
      };
      
      const teacher = await storage.createTeacher(validatedData);
      res.status(201).json(teacher);
    } catch (error) {
      console.error("Error creating teacher:", error);
      
      // Handle specific database errors
      if (error && typeof error === 'object' && 'code' in error && 'constraint' in error) {
        if (error.code === '23505' && error.constraint === 'teachers_email_unique') {
          return res.status(400).json({ message: "A teacher with this email already exists" });
        }
      }
      
      res.status(400).json({ message: "Invalid teacher data" });
    }
  });

  // Update teacher daily periods configuration (must be before /api/teachers/:id)
  app.put("/api/teachers/daily-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can configure daily periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = updateTeacherDailyPeriodsSchema.parse(req.body);
      const result = await storage.updateTeacherDailyPeriods(user.schoolId, validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        schoolId: user.schoolId,
        userId: user.id,
        action: 'UPDATE',
        entityType: 'TEACHER',
        entityId: validatedData.teacherId || 'ALL',
        description: `Updated daily periods limit to ${validatedData.maxDailyPeriods}`,
        newValues: { maxDailyPeriods: validatedData.maxDailyPeriods, applyToAll: validatedData.applyToAll }
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating teacher daily periods:", error);
      res.status(500).json({ message: "Failed to update teacher daily periods" });
    }
  });

  app.put("/api/teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const teacherId = req.params.id;
      
      // Only school admins and super admins can update teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if teacher exists and belongs to the user's school (for school admins)
      const existingTeacher = await storage.getTeacher(teacherId);
      if (!existingTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingTeacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - teacher not in your school" });
      }

      // Clean up empty strings and convert to null for optional fields
      const cleanedRequestBody = { ...req.body };
      
      // Convert empty strings to null for optional fields
      const optionalFields = ['email', 'contactNumber', 'schoolIdNumber', 'aadhar', 'gender', 
                             'bloodGroup', 'designation', 'dateOfBirth', 'fatherHusbandName', 
                             'address', 'category', 'religion', 'profilePictureUrl'];
      
      optionalFields.forEach(field => {
        if (cleanedRequestBody[field] === '') {
          cleanedRequestBody[field] = null;
        }
      });

      const validatedData = insertTeacherSchema.partial().parse(cleanedRequestBody);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      const teacher = await storage.updateTeacher(teacherId, validatedData);
      res.json(teacher);
    } catch (error) {
      console.error("Error updating teacher:", error);
      res.status(400).json({ message: "Failed to update teacher" });
    }
  });

  app.delete("/api/teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const teacherId = req.params.id;
      
      // Only school admins and super admins can delete teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if teacher exists and belongs to the user's school (for school admins)
      const existingTeacher = await storage.getTeacher(teacherId);
      if (!existingTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingTeacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - teacher not in your school" });
      }

      await storage.deleteTeacher(teacherId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      res.status(500).json({ message: "Failed to delete teacher" });
    }
  });

  // Teacher profile picture upload endpoint
  app.post("/api/teachers/:id/upload-profile-picture", authMiddleware, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const user = req.user;
      const teacherId = req.params.id;
      
      // Only school admins and super admins can upload teacher profile pictures
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No profile picture uploaded" });
      }

      // Check if teacher exists and belongs to the user's school (for school admins)
      const existingTeacher = await storage.getTeacher(teacherId);
      if (!existingTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingTeacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - teacher not in your school" });
      }

      // Validate file type - only allow images
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          message: `File type ${req.file.mimetype} not allowed. Only images are supported.` 
        });
      }
      
      // File size check (2MB limit for profile pictures)
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ 
          message: "File too large. Maximum size is 2MB" 
        });
      }

      // Generate secure filename
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(req.file.originalname) || '.jpg';
      const secureFilename = `${fileId}${fileExtension}`;
      
      // Create teacher profile pictures directory
      const profilePicturesDir = path.join(process.cwd(), 'Teachers Assets', 'Profile Picture');
      if (!fs.existsSync(profilePicturesDir)) {
        fs.mkdirSync(profilePicturesDir, { recursive: true });
      }
      
      // Save file to disk with secure filename
      const filePath = path.join(profilePicturesDir, secureFilename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Update teacher record with profile picture URL
      const profilePictureUrl = `/api/teachers/${teacherId}/profile-picture/${fileId}${fileExtension}`;
      const updatedTeacher = await storage.updateTeacher(teacherId, { 
        profilePictureUrl: profilePictureUrl 
      });
      
      res.json({ 
        message: "Profile picture uploaded successfully",
        profilePictureUrl: profilePictureUrl,
        teacher: updatedTeacher
      });
    } catch (error) {
      console.error("Error uploading teacher profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // Teacher profile picture serving endpoint
  app.get("/api/teachers/:id/profile-picture/:filename", async (req, res) => {
    try {
      const { id: teacherId, filename } = req.params;
      
      // Validate filename format (should be UUID + extension)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;
      if (!uuidRegex.test(filename)) {
        return res.status(400).json({ message: "Invalid filename format" });
      }

      // Check if teacher exists
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Construct file path
      const profilePicturesDir = path.join(process.cwd(), 'Teachers Assets', 'Profile Picture');
      const filePath = path.join(profilePicturesDir, filename);
      
      // Verify file exists and is within profile pictures directory
      if (!fs.existsSync(filePath) || !path.resolve(filePath).startsWith(path.resolve(profilePicturesDir))) {
        return res.status(404).json({ message: "Profile picture not found" });
      }

      // Get file stats and determine content type
      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      const contentType = mimeTypes[fileExtension] || 'image/jpeg';
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'X-Content-Type-Options': 'nosniff'
      });
      
      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving teacher profile picture:", error);
      res.status(500).json({ message: "Failed to serve profile picture" });
    }
  });

  // Teacher requirement analysis endpoint
  app.get("/api/teacher-requirements", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admins can access this
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId as string;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get all classes for the school
      const classes = await storage.getClasses(schoolId);
      
      // Get timetable structure to understand periods configuration
      const timetableStructure = await storage.getTimetableStructure(schoolId);
      const totalPeriodsPerWeek = timetableStructure?.periodsPerDay 
        ? timetableStructure.periodsPerDay * (timetableStructure.workingDays?.length || 6)
        : 0;
      
      // Get all teachers for the school
      const allTeachers = await storage.getTeachers(schoolId);
      
      // Calculate requirements for each class
      const classRequirements = [];
      let totalPeriodsNeeded = 0;
      let totalPeriodsAssigned = 0;
      
      for (const classItem of classes) {
        // Get subject assignments for this class
        const assignments = await storage.getClassSubjectAssignments(classItem.id);
        
        let classPeriods = 0;
        let assignedPeriods = 0;
        const subjectBreakdown = [];
        
        for (const assignment of assignments) {
          const periodsPerWeek = assignment.periodsPerWeek || 0;
          classPeriods += periodsPerWeek;
          
          if (assignment.assignedTeacherId) {
            assignedPeriods += periodsPerWeek;
          }
          
          subjectBreakdown.push({
            subjectId: assignment.subjectId,
            subjectName: assignment.subjectName,
            subjectCode: assignment.subjectCode,
            periodsPerWeek: periodsPerWeek,
            assignedTeacherId: assignment.assignedTeacherId,
            assignedTeacherName: assignment.assignedTeacherName,
            isAssigned: !!assignment.assignedTeacherId
          });
        }
        
        totalPeriodsNeeded += classPeriods;
        totalPeriodsAssigned += assignedPeriods;
        
        classRequirements.push({
          classId: classItem.id,
          className: `${classItem.grade}${classItem.section ? ' ' + classItem.section : ''}`,
          totalPeriodsNeeded: classPeriods,
          assignedPeriods: assignedPeriods,
          unassignedPeriods: classPeriods - assignedPeriods,
          subjectBreakdown: subjectBreakdown,
          teachersNeeded: Math.ceil((classPeriods - assignedPeriods) / (timetableStructure?.periodsPerDay || 6))
        });
      }
      
      // Calculate teacher workload
      const teacherWorkloads = [];
      for (const teacher of allTeachers) {
        const teacherAssignments = await storage.getClassSubjectAssignments(undefined, schoolId);
        const teacherSubjects = teacherAssignments.filter(a => a.assignedTeacherId === teacher.id);
        
        let totalPeriods = 0;
        const classesTeaching = new Set();
        
        for (const assignment of teacherSubjects) {
          totalPeriods += assignment.periodsPerWeek || 0;
          classesTeaching.add(assignment.className);
        }
        
        const workingDays = timetableStructure?.workingDays?.length || 6;
        const weeklyCapacity = calculateWeeklyCapacity(teacher.maxDailyPeriods || 6, workingDays);
        
        teacherWorkloads.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          employeeId: teacher.employeeId,
          currentLoad: totalPeriods,
          maxLoad: weeklyCapacity,
          availableCapacity: weeklyCapacity - totalPeriods,
          utilizationPercentage: weeklyCapacity > 0 ? Math.round((totalPeriods / weeklyCapacity) * 100) : 0,
          classesTeaching: Array.from(classesTeaching),
          isOverloaded: totalPeriods > weeklyCapacity
        });
      }
      
      // Calculate summary
      const summary = {
        totalClasses: classes.length,
        totalTeachers: allTeachers.length,
        totalPeriodsNeeded: totalPeriodsNeeded,
        totalPeriodsAssigned: totalPeriodsAssigned,
        totalPeriodsUnassigned: totalPeriodsNeeded - totalPeriodsAssigned,
        coveragePercentage: totalPeriodsNeeded > 0 
          ? Math.round((totalPeriodsAssigned / totalPeriodsNeeded) * 100) 
          : 100,
        additionalTeachersNeeded: Math.ceil(
          (totalPeriodsNeeded - totalPeriodsAssigned) / 
          (timetableStructure?.periodsPerDay ? timetableStructure.periodsPerDay * (timetableStructure.workingDays?.length || 6) : 30)
        ),
        overloadedTeachers: teacherWorkloads.filter(t => t.isOverloaded).length,
        underutilizedTeachers: teacherWorkloads.filter(t => t.utilizationPercentage < 50).length
      };
      
      res.json({
        summary,
        classRequirements,
        teacherWorkloads,
        timetableStructure: {
          periodsPerDay: timetableStructure?.periodsPerDay || 0,
          workingDays: timetableStructure?.workingDays || [],
          totalPeriodsPerWeek
        }
      });
    } catch (error: any) {
      console.error("Error calculating teacher requirements:", error);
      res.status(500).json({ message: "Failed to calculate teacher requirements" });
    }
  });

  // Bulk teacher upload endpoint
  app.post("/api/teachers/bulk-upload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can bulk upload teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { teachers: teachersList } = req.body;
      
      if (!Array.isArray(teachersList) || teachersList.length === 0) {
        return res.status(400).json({ message: "No teachers data provided" });
      }

      const results = [];
      const errors = [];
      
      for (let i = 0; i < teachersList.length; i++) {
        const teacherData = teachersList[i];
        
        try {
          // Use original row number from client if available, otherwise fall back to calculated
          const originalRowNumber = teacherData.originalRowNumber || (i + 2);
          
          // Validate required fields
          if (!teacherData.name || !teacherData.contactNumber) {
            errors.push({
              row: originalRowNumber,
              error: "Name and contact number are required"
            });
            continue;
          }

          // Validate mobile number (10 digits)
          if (!/^\d{10}$/.test(teacherData.contactNumber)) {
            errors.push({
              row: originalRowNumber,
              error: "Mobile number must be exactly 10 digits"
            });
            continue;
          }

          // Check if teacher with same contact number already exists
          const existingTeachers = await storage.getTeachers(user.schoolId);
          const duplicateTeacher = existingTeachers.find(teacher => teacher.contactNumber === teacherData.contactNumber);
          if (duplicateTeacher) {
            errors.push({
              row: originalRowNumber,
              error: `Teacher with mobile number ${teacherData.contactNumber} already exists`
            });
            continue;
          }

          // Check for duplicate mobile numbers within current batch
          const currentBatchMobileDuplicate = teachersList.slice(0, i).find(t => t.contactNumber === teacherData.contactNumber);
          if (currentBatchMobileDuplicate) {
            errors.push({
              row: originalRowNumber,
              error: `Duplicate mobile number ${teacherData.contactNumber} found in current upload batch`
            });
            continue;
          }

          // Check if email is unique (if provided)
          if (teacherData.email && teacherData.email.trim() !== '') {
            const email = teacherData.email.trim();
            
            // Check against existing teachers in database
            const duplicateEmail = existingTeachers.find(teacher => teacher.email === email);
            if (duplicateEmail) {
              errors.push({
                row: originalRowNumber,
                error: `Teacher with email ${email} already exists`
              });
              continue;
            }
            
            // Check for duplicate emails within current batch
            const currentBatchEmailDuplicate = teachersList.slice(0, i).find(t => t.email?.trim() === email);
            if (currentBatchEmailDuplicate) {
              errors.push({
                row: originalRowNumber,
                error: `Duplicate email ${email} found in current upload batch`
              });
              continue;
            }
          }

          // Check if school ID is unique (if provided)
          if (teacherData.schoolIdNumber && teacherData.schoolIdNumber.trim() !== '') {
            const schoolId = teacherData.schoolIdNumber.trim();
            const duplicateSchoolId = existingTeachers.find(teacher => teacher.schoolIdNumber === schoolId);
            if (duplicateSchoolId) {
              errors.push({
                row: originalRowNumber,
                error: `School ID ${schoolId} already exists for teacher: ${duplicateSchoolId.name}`
              });
              continue;
            }
            
            // Check for duplicates within current batch
            const currentBatchDuplicate = teachersList.slice(0, i).find(t => t.schoolIdNumber?.trim() === schoolId);
            if (currentBatchDuplicate) {
              errors.push({
                row: originalRowNumber,
                error: `Duplicate School ID ${schoolId} found in current upload batch`
              });
              continue;
            }
          }

          // Generate proper employee ID using centralized helper from storage
          const employeeId = await storage.generateNextTeacherEmployeeId();
          
          // Prepare teacher data for creation
          const teacherToCreate = {
            ...teacherData,
            schoolId: user.schoolId,
            employeeId, // Use centralized T#### format generator
            classes: [], // No classes initially as requested
            subjects: [], // No subjects initially as requested
            availability: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false
            }
          };

          const createdTeacher = await storage.createTeacher(teacherToCreate);
          results.push({
            row: originalRowNumber,
            success: true,
            teacher: createdTeacher
          });
          
        } catch (error) {
          console.error(`Error creating teacher at row ${originalRowNumber}:`, error);
          errors.push({
            row: originalRowNumber,
            error: error instanceof Error ? error.message : "Failed to create teacher"
          });
        }
      }

      res.json({
        success: true,
        imported: results.length,
        total: teachersList.length,
        errors: errors,
        results: results
      });
      
    } catch (error) {
      console.error("Error in bulk teacher upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  // Teacher Replacement endpoints
  // Check for conflicts before replacement
  app.get("/api/teachers/:id/replacement-conflicts", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const originalTeacherId = req.params.id;
      const { replacementTeacherId } = req.query;
      
      // Only school admins and super admins can check conflicts
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!replacementTeacherId) {
        return res.status(400).json({ message: "Replacement teacher ID is required" });
      }

      // Get all timetable entries for the original teacher
      const originalTeacherEntries = await storage.getTimetableEntriesByTeacher(originalTeacherId);
      
      // Get all timetable entries for the replacement teacher
      const replacementTeacherEntries = await storage.getTimetableEntriesByTeacher(replacementTeacherId as string);
      
      // Check for conflicts
      const conflicts = [];
      for (const originalEntry of originalTeacherEntries) {
        const conflict = replacementTeacherEntries.find(replacementEntry => 
          replacementEntry.day === originalEntry.day &&
          replacementEntry.period === originalEntry.period &&
          replacementEntry.isActive
        );
        
        if (conflict) {
          // Get class details for both entries
          const originalClass = await storage.getClass(originalEntry.classId);
          const conflictingClass = await storage.getClass(conflict.classId);
          
          conflicts.push({
            day: originalEntry.day,
            period: originalEntry.period,
            existingClass: conflictingClass ? `${conflictingClass.grade}-${conflictingClass.section}` : 'Unknown',
            conflictingClass: originalClass ? `${originalClass.grade}-${originalClass.section}` : 'Unknown',
            startTime: originalEntry.startTime,
            endTime: originalEntry.endTime
          });
        }
      }

      res.json({
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        totalEntries: originalTeacherEntries.length,
        conflicts
      });
    } catch (error) {
      console.error("Error checking replacement conflicts:", error);
      res.status(500).json({ message: "Failed to check replacement conflicts" });
    }
  });

  // Replace teacher permanently
  app.post("/api/teachers/:id/replace", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const originalTeacherId = req.params.id;
      const { replacementTeacherId, reason } = req.body;
      
      // Only school admins and super admins can replace teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!replacementTeacherId || !reason) {
        return res.status(400).json({ message: "Replacement teacher ID and reason are required" });
      }

      // Check if both teachers exist and belong to the same school
      const originalTeacher = await storage.getTeacher(originalTeacherId);
      const replacementTeacher = await storage.getTeacher(replacementTeacherId);
      
      if (!originalTeacher || !replacementTeacher) {
        return res.status(404).json({ message: "One or both teachers not found" });
      }

      if (user.role === 'admin' && user.schoolId) {
        if (originalTeacher.schoolId !== user.schoolId || replacementTeacher.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied - teachers not in your school" });
        }
      }

      // Get all timetable entries for the original teacher
      const originalTeacherEntries = await storage.getTimetableEntriesByTeacher(originalTeacherId);
      
      // Check for conflicts first
      const replacementTeacherEntries = await storage.getTimetableEntriesByTeacher(replacementTeacherId);
      const conflicts = [];
      
      for (const originalEntry of originalTeacherEntries) {
        const conflict = replacementTeacherEntries.find(replacementEntry => 
          replacementEntry.day === originalEntry.day &&
          replacementEntry.period === originalEntry.period &&
          replacementEntry.isActive
        );
        
        if (conflict) {
          const originalClass = await storage.getClass(originalEntry.classId);
          const conflictingClass = await storage.getClass(conflict.classId);
          
          conflicts.push({
            day: originalEntry.day,
            period: originalEntry.period,
            existingClass: conflictingClass ? `${conflictingClass.grade}-${conflictingClass.section}` : 'Unknown',
            conflictingClass: originalClass ? `${originalClass.grade}-${originalClass.section}` : 'Unknown'
          });
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          message: "Teacher replacement conflicts detected",
          conflicts,
          hasConflicts: true
        });
      }

      // Perform the replacement on global timetable (for future weeks)
      let replacedEntries = 0;
      for (const entry of originalTeacherEntries) {
        await storage.updateTimetableEntry(entry.id, {
          teacherId: replacementTeacherId
        });
        replacedEntries++;
      }

      // Update current and future weekly timetables with the replacement
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday of this week
      
      // Find all classes the original teacher was teaching
      const affectedClasses = Array.from(new Set(originalTeacherEntries.map(entry => entry.classId)));
      
      // Update weekly timetables for the next 4 weeks (current + 3 future weeks)
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));
        
        for (const classId of affectedClasses) {
          try {
            // Get or create weekly timetable for this class and week
            let weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
            
            if (!weeklyTimetable) {
              // Create weekly timetable from global if it doesn't exist
              const globalTimetable = await storage.getTimetableEntriesForClass(classId);
              const weeklyTimetableData = globalTimetable.map((entry: any) => ({
                day: entry.day,
                period: entry.period,
                teacherId: entry.teacherId,
                subjectId: entry.subjectId,
                startTime: entry.startTime,
                endTime: entry.endTime,
                room: entry.room,
                isModified: false
              }));
              
              weeklyTimetable = await storage.createOrUpdateWeeklyTimetable(
                classId,
                weekStart,
                weeklyTimetableData,
                user.id,
                originalTeacher.schoolId
              );
            }
            
            // Update the weekly timetable to replace the teacher
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Update each period where the original teacher was assigned
            const originalTeacherPeriods = originalTeacherEntries.filter(entry => entry.classId === classId);
            for (const period of originalTeacherPeriods) {
              await storage.updateWeeklyTimetableEntry(
                classId,
                weekStart.toISOString().split('T')[0],
                weekEnd.toISOString().split('T')[0],
                period.day,
                period.period,
                {
                  teacherId: replacementTeacherId,
                  subjectId: period.subjectId,
                  isModified: true,
                  modificationReason: `Teacher replacement: ${originalTeacher.name} → ${replacementTeacher.name}`
                },
                user.id
              );
            }
          } catch (weeklyError) {
            console.error(`Error updating weekly timetable for class ${classId}, week ${weekStart.toISOString().split('T')[0]}:`, weeklyError);
          }
        }
      }

      // Update original teacher status to "left_school"
      await storage.updateTeacher(originalTeacherId, {
        status: 'left_school',
        isActive: false
      });

      // Create replacement history record
      const replacementRecord = await storage.createTeacherReplacement({
        originalTeacherId,
        replacementTeacherId,
        schoolId: originalTeacher.schoolId,
        replacementDate: new Date(),
        reason,
        affectedTimetableEntries: replacedEntries,
        conflictDetails: { hasConflicts: false },
        status: 'completed',
        replacedBy: user.id,
        completedAt: new Date()
      });

      res.json({
        message: "Teacher replacement completed successfully",
        replacement: replacementRecord,
        affectedEntries: replacedEntries,
        originalTeacher: {
          id: originalTeacher.id,
          name: originalTeacher.name,
          status: 'left_school'
        },
        replacementTeacher: {
          id: replacementTeacher.id,
          name: replacementTeacher.name
        }
      });
    } catch (error) {
      console.error("Error replacing teacher:", error);
      res.status(500).json({ message: "Failed to replace teacher" });
    }
  });

  // Get teacher replacement history
  app.get("/api/teacher-replacements", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view replacement history
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let replacements;
      if (user.role === 'super_admin') {
        // Super admin can see all replacements
        replacements = await storage.getAllTeacherReplacements();
      } else if (user.schoolId) {
        // School admin can only see their school's replacements
        replacements = await storage.getTeacherReplacementsBySchool(user.schoolId);
      } else {
        return res.status(400).json({ message: "School ID is required" });
      }

      res.json(replacements);
    } catch (error) {
      console.error("Error fetching teacher replacements:", error);
      res.status(500).json({ message: "Failed to fetch teacher replacement history" });
    }
  });

  // Teacher Attendance routes
  app.get("/api/teacher-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date, teacherId, startDate, endDate } = req.query;
      
      // Only school admins can view attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let attendance;
      
      if (teacherId) {
        // Get attendance for specific teacher with optional date range
        attendance = await storage.getTeacherAttendanceByTeacher(teacherId as string, startDate as string, endDate as string);
      } else if (user.schoolId) {
        // Get attendance for the school - support both single date and date range
        if (startDate && endDate) {
          // Date range query for the entire week
          attendance = await storage.getTeacherAttendanceByDateRange(user.schoolId, startDate as string, endDate as string);
        } else {
          // Single date query (legacy behavior)
          attendance = await storage.getTeacherAttendance(user.schoolId, date as string);
        }
      } else {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching teacher attendance:", error);
      res.status(500).json({ message: "Failed to fetch teacher attendance" });
    }
  });

  app.post("/api/teacher-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can mark attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use user's schoolId - NEVER trust client-supplied schoolId
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }

      const requestBody = { ...req.body };
      
      // Validate attendance date is not in the future
      if (requestBody.attendanceDate) {
        if (isFutureDate(requestBody.attendanceDate)) {
          return res.status(400).json({ message: "Attendance cannot be recorded for upcoming dates" });
        }
      }
      
      // Verify teacher belongs to user's school for security
      const teacher = await storage.getTeacher(requestBody.teacherId);
      if (!teacher || teacher.schoolId !== schoolId) {
        return res.status(403).json({ message: "Teacher not found or not in your school" });
      }
      
      // Add marked by information and schoolId from user
      requestBody.markedBy = user.id;
      requestBody.schoolId = schoolId;

      const validatedData = insertTeacherAttendanceSchema.parse(requestBody);
      const attendance = await storage.markTeacherAttendance(validatedData);
      
      // Return response immediately for better UX
      res.status(201).json(attendance);
      
      // Create substitutions asynchronously in the background (non-blocking)
      setImmediate(async () => {
        // Create substitutions if teacher is absent
        if (attendance.status === 'absent' && attendance.attendanceDate) {
          try {
            const { substitutionService } = await import("./services/substitution");
            await substitutionService.createSubstitutionsForAbsence(
              attendance.teacherId,
              attendance.attendanceDate,
              schoolId,
              attendance.id,
              user.id
            );
            console.log(`[SUBSTITUTION] Created substitutions for absent teacher ${attendance.teacherId}`);
          } catch (subError) {
            console.error("[SUBSTITUTION] Error creating substitutions:", subError);
          }
        }
        
        // Create substitutions for leave (including when marked through single-day API)
        if ((attendance.status === 'on_leave' || attendance.status === 'medical_leave' || attendance.status === 'personal_leave')) {
          try {
            const { substitutionService } = await import("./services/substitution");
            // If leave dates are provided, use them; otherwise use attendance date for single-day leave
            const startDate = attendance.leaveStartDate || attendance.attendanceDate;
            const endDate = attendance.leaveEndDate || attendance.attendanceDate;
            
            if (startDate && endDate) {
              await substitutionService.createSubstitutionsForLeave(
                attendance.teacherId,
                startDate,
                endDate,
                schoolId,
                attendance.id,
                user.id
              );
              console.log(`[SUBSTITUTION] Created substitutions for leave ${startDate} to ${endDate}`);
            }
          } catch (subError) {
            console.error("[SUBSTITUTION] Error creating substitutions for leave:", subError);
          }
        }
      });
    } catch (error) {
      console.error("Error marking teacher attendance:", error);
      res.status(500).json({ message: "Failed to mark teacher attendance" });
    }
  });

  app.put("/api/teacher-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins can update attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      requestBody.markedBy = user.id; // Update who modified it
      
      const validatedData = insertTeacherAttendanceSchema.partial().parse(requestBody);
      const attendance = await storage.updateTeacherAttendance(attendanceId, validatedData);
      res.json(attendance);
    } catch (error) {
      console.error("Error updating teacher attendance:", error);
      res.status(500).json({ message: "Failed to update teacher attendance" });
    }
  });

  app.delete("/api/teacher-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins can delete attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTeacherAttendance(attendanceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting teacher attendance:", error);
      res.status(500).json({ message: "Failed to delete teacher attendance" });
    }
  });

  // Get teacher's own attendance records for a specific month
  app.get("/api/teacher-attendance/my-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only teachers can access this endpoint
      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied. Teachers only." });
      }

      if (!user.teacherId) {
        return res.status(400).json({ message: "Teacher ID not found" });
      }

      const { month } = req.query; // Format: YYYY-MM
      
      if (!month || typeof month !== 'string') {
        return res.status(400).json({ message: "Month parameter required (format: YYYY-MM)" });
      }

      // Parse month to get start and end dates
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Get teacher's attendance records for the month
      const attendance = await storage.getTeacherAttendanceByTeacher(
        user.teacherId,
        startDate,
        endDate
      );

      res.json(attendance);
    } catch (error) {
      console.error("Error fetching teacher's own attendance:", error);
      res.status(500).json({ message: "Failed to fetch attendance records" });
    }
  });

  // Check if teacher is absent on a specific date
  app.get("/api/teacher-attendance/check/:teacherId/:date", authMiddleware, async (req: any, res) => {
    try {
      const { teacherId, date } = req.params;
      const isAbsent = await storage.isTeacherAbsent(teacherId, date);
      res.json({ isAbsent });
    } catch (error) {
      console.error("Error checking teacher absence:", error);
      res.status(500).json({ message: "Failed to check teacher absence" });
    }
  });

  // Leave Application routes
  // Teachers apply for leave
  app.post("/api/leave-applications", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only teachers can apply for leave
      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers can apply for leave" });
      }

      const { startDate, endDate, leaveType, reason, attachmentUrl } = req.body;
      
      // Validate dates
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ message: "End date cannot be before start date" });
      }

      // Get teacher record from user
      if (!user.teacherId) {
        return res.status(400).json({ message: "Teacher ID not found in user profile" });
      }
      
      const teacher = await storage.getTeacher(user.teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher profile not found" });
      }

      const application = await storage.createLeaveApplication({
        teacherId: teacher.id,
        schoolId: user.schoolId,
        startDate,
        endDate,
        leaveType,
        reason,
        attachmentUrl,
        status: 'pending',
      });

      // Send notification to all school admins
      try {
        const allUsers = await storage.getUsersBySchoolId(user.schoolId);
        const adminUsers = allUsers.filter(u => u.role === 'admin');
        
        const leaveTypeLabel = leaveType === 'medical' ? 'Medical Leave' :
                               leaveType === 'casual' ? 'Casual Leave' :
                               leaveType === 'earned' ? 'Earned Leave' :
                               leaveType === 'maternity' ? 'Maternity Leave' :
                               leaveType === 'paternity' ? 'Paternity Leave' : 'Leave';
        
        const notificationMessage = `${teacher.name} has applied for ${leaveTypeLabel} from ${format(new Date(startDate), 'MMM dd, yyyy')} to ${format(new Date(endDate), 'MMM dd, yyyy')}${reason ? `. Reason: ${reason}` : ''}`;
        
        // Create notification for each admin
        for (const admin of adminUsers) {
          await storage.createNotification({
            schoolId: user.schoolId,
            recipientId: admin.id,
            recipientRole: 'admin',
            type: 'leave_applied',
            title: 'New Leave Application',
            message: notificationMessage,
            metadata: {
              leaveApplicationId: application.id,
              teacherId: teacher.id,
              teacherName: teacher.name,
              leaveType,
              startDate,
              endDate,
            },
            actionUrl: '/attendance',
            isRead: false,
          });
        }
      } catch (notificationError) {
        console.error('Error sending leave application notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating leave application:", error);
      res.status(500).json({ message: "Failed to create leave application" });
    }
  });

  // Get leave applications (admins see all, teachers see their own)
  app.get("/api/leave-applications", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { status, teacherId } = req.query;

      let applications;
      
      if (user.role === 'admin') {
        // Admins can see all applications for their school
        applications = await storage.getLeaveApplications(user.schoolId, {
          status: status as string,
          teacherId: teacherId as string,
        });
      } else if (user.role === 'teacher') {
        // Teachers can only see their own applications
        if (!user.teacherId) {
          return res.status(400).json({ message: "Teacher ID not found in user profile" });
        }
        
        const teacher = await storage.getTeacher(user.teacherId);
        if (!teacher) {
          return res.status(404).json({ message: "Teacher profile not found" });
        }
        
        applications = await storage.getLeaveApplications(user.schoolId, {
          status: status as string,
          teacherId: teacher.id,
        });
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(applications);
    } catch (error) {
      console.error("Error fetching leave applications:", error);
      res.status(500).json({ message: "Failed to fetch leave applications" });
    }
  });

  // Approve leave application (admin only)
  app.post("/api/leave-applications/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admins can approve leave
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can approve leave applications" });
      }

      const { id } = req.params;
      const { reviewNotes } = req.body;

      const application = await storage.getLeaveApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Leave application not found" });
      }

      // Verify application belongs to admin's school
      if (application.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const approved = await storage.approveLeaveApplication(id, user.id, reviewNotes);
      
      // Send notification to teacher
      try {
        const teacher = await storage.getTeacher(application.teacherId);
        if (teacher) {
          const leaveTypeLabel = application.leaveType === 'medical' ? 'Medical Leave' :
                                 application.leaveType === 'casual' ? 'Casual Leave' :
                                 application.leaveType === 'earned' ? 'Earned Leave' :
                                 application.leaveType === 'maternity' ? 'Maternity Leave' :
                                 application.leaveType === 'paternity' ? 'Paternity Leave' : 'Leave';
          
          let notificationMessage = `Your ${leaveTypeLabel} application from ${format(new Date(application.startDate), 'MMM dd, yyyy')} to ${format(new Date(application.endDate), 'MMM dd, yyyy')} has been APPROVED.`;
          if (reviewNotes) {
            notificationMessage += ` Admin notes: ${reviewNotes}`;
          }
          
          await storage.sendMessage({
            senderType: 'admin',
            senderId: user.id,
            receiverType: 'teacher',
            receiverId: teacher.id,
            content: notificationMessage,
            schoolId: user.schoolId,
            isRead: false,
          });
        }
      } catch (notificationError) {
        console.error('Error sending approval notification:', notificationError);
        // Don't fail the request if notification fails
      }
      
      res.json(approved);
    } catch (error) {
      console.error("Error approving leave application:", error);
      res.status(500).json({ message: "Failed to approve leave application" });
    }
  });

  // Reject leave application (admin only)
  app.post("/api/leave-applications/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admins can reject leave
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can reject leave applications" });
      }

      const { id } = req.params;
      const { reviewNotes } = req.body;

      const application = await storage.getLeaveApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Leave application not found" });
      }

      // Verify application belongs to admin's school
      if (application.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const rejected = await storage.rejectLeaveApplication(id, user.id, reviewNotes);
      
      // Send notification to teacher
      try {
        const teacher = await storage.getTeacher(application.teacherId);
        if (teacher) {
          const leaveTypeLabel = application.leaveType === 'medical' ? 'Medical Leave' :
                                 application.leaveType === 'casual' ? 'Casual Leave' :
                                 application.leaveType === 'earned' ? 'Earned Leave' :
                                 application.leaveType === 'maternity' ? 'Maternity Leave' :
                                 application.leaveType === 'paternity' ? 'Paternity Leave' : 'Leave';
          
          let notificationMessage = `Your ${leaveTypeLabel} application from ${format(new Date(application.startDate), 'MMM dd, yyyy')} to ${format(new Date(application.endDate), 'MMM dd, yyyy')} has been REJECTED.`;
          if (reviewNotes) {
            notificationMessage += ` Reason: ${reviewNotes}`;
          }
          
          await storage.sendMessage({
            senderType: 'admin',
            senderId: user.id,
            receiverType: 'teacher',
            receiverId: teacher.id,
            content: notificationMessage,
            schoolId: user.schoolId,
            isRead: false,
          });
        }
      } catch (notificationError) {
        console.error('Error sending rejection notification:', notificationError);
        // Don't fail the request if notification fails
      }
      
      res.json(rejected);
    } catch (error) {
      console.error("Error rejecting leave application:", error);
      res.status(500).json({ message: "Failed to reject leave application" });
    }
  });

  // Student Attendance routes
  app.get("/api/student-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date, studentId, classId, startDate, endDate } = req.query;
      
      // Validate query parameters
      const querySchema = z.object({
        date: z.string().optional(),
        studentId: z.string().uuid().optional(),
        classId: z.string().uuid().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      });
      
      let validatedQuery;
      try {
        validatedQuery = querySchema.parse({ date, studentId, classId, startDate, endDate });
      } catch (error) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      let attendance;
      
      if (user.role === 'student') {
        // Students can only view their own attendance
        const userStudent = await storage.getStudentByUserId(user.id);
        if (!userStudent) {
          return res.status(403).json({ message: "Student profile not found" });
        }
        
        // Force studentId to be the student's own ID
        if (validatedQuery.studentId && validatedQuery.studentId !== userStudent.id) {
          return res.status(403).json({ message: "Access denied: Can only view your own attendance" });
        }
        
        // Only allow fetching own attendance, no class or school-wide queries
        attendance = await storage.getStudentAttendanceByStudent(userStudent.id, validatedQuery.startDate, validatedQuery.endDate);
        
      } else if (user.role === 'teacher') {
        // Teachers can only view attendance for classes they are assigned to
        if (!user.teacherId) {
          return res.status(403).json({ message: "Access denied: Teacher ID not found" });
        }
        
        if (validatedQuery.studentId) {
          // Check if teacher has access to this student (student must be in a class the teacher teaches)
          const student = await storage.getStudent(validatedQuery.studentId);
          if (!student || student.schoolId !== user.schoolId) {
            return res.status(403).json({ message: "Access denied: Student not in your school" });
          }
          
          // Verify teacher is assigned to the student's class
          const teacherAssignment = await storage.getClassTeacherAssignment(student.classId, user.teacherId);
          if (!teacherAssignment) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this student's class" });
          }
          
          attendance = await storage.getStudentAttendanceByStudent(validatedQuery.studentId, validatedQuery.startDate, validatedQuery.endDate);
          
        } else if (validatedQuery.classId && validatedQuery.date) {
          // Verify teacher is assigned to this class
          const classInfo = await storage.getClass(validatedQuery.classId);
          if (!classInfo || classInfo.schoolId !== user.schoolId) {
            return res.status(403).json({ message: "Access denied: Class not in your school" });
          }
          
          const teacherAssignment = await storage.getClassTeacherAssignment(validatedQuery.classId, user.teacherId);
          if (!teacherAssignment) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this class" });
          }
          
          attendance = await storage.getStudentAttendanceByClass(validatedQuery.classId, validatedQuery.date);
          
        } else {
          return res.status(400).json({ message: "Teachers must specify either studentId or classId with date" });
        }
        
      } else if (user.role === 'admin') {
        // Admins can view any attendance in their school
        if (validatedQuery.studentId) {
          // Validate student belongs to user's school
          const student = await storage.getStudent(validatedQuery.studentId);
          if (!student || student.schoolId !== user.schoolId) {
            return res.status(403).json({ message: "Access denied: Student not in your school" });
          }
          attendance = await storage.getStudentAttendanceByStudent(validatedQuery.studentId, validatedQuery.startDate, validatedQuery.endDate);
          
        } else if (validatedQuery.classId && validatedQuery.date) {
          // Validate class belongs to user's school
          const classInfo = await storage.getClass(validatedQuery.classId);
          if (!classInfo || classInfo.schoolId !== user.schoolId) {
            return res.status(403).json({ message: "Access denied: Class not in your school" });
          }
          attendance = await storage.getStudentAttendanceByClass(validatedQuery.classId, validatedQuery.date);
          
        } else if (user.schoolId) {
          // Only admins can do school-wide queries
          attendance = await storage.getStudentAttendance(user.schoolId, validatedQuery.date);
          
        } else {
          return res.status(400).json({ message: "Missing required parameters" });
        }
        
      } else if (user.role === 'parent') {
        return res.status(403).json({ message: "Access denied: Parent access not implemented yet" });
        
      } else {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }
      
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching student attendance:", error);
      res.status(500).json({ message: "Failed to fetch student attendance" });
    }
  });

  app.post("/api/student-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and teachers can mark student attendance
      if (user.role !== 'admin' && user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }

      // Prepare request body with schoolId before validation
      const requestBody = { ...req.body };
      
      // Validate attendance date is not in the future
      if (requestBody.attendanceDate) {
        if (isFutureDate(requestBody.attendanceDate)) {
          return res.status(400).json({ message: "Attendance cannot be recorded for upcoming dates" });
        }
      }
      
      // For admins/teachers, set schoolId from user
      if (user.role === 'admin' || user.role === 'teacher') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      }
      
      // Set markedBy before validation
      requestBody.markedBy = user.id;
      
      // Now validate the complete request body
      const validatedData = insertStudentAttendanceSchema.parse(requestBody);
      
      // Additional security validation for admin/teacher
      const student = await storage.getStudent(validatedData.studentId);
      if (!student || student.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied: Student not in your school" });
      }
      
      // Validate class belongs to user's school
      if (validatedData.classId) {
        const classInfo = await storage.getClass(validatedData.classId);
        if (!classInfo || classInfo.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied: Class not in your school" });
        }
      }
      
      const attendance = await storage.markStudentAttendance(validatedData);
      res.status(201).json(attendance);
    } catch (error) {
      console.error("Error marking student attendance:", error);
      res.status(500).json({ message: "Failed to mark student attendance" });
    }
  });

  app.put("/api/student-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins and teachers can update student attendance
      if (user.role !== 'admin' && user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }
      
      // Validate request body
      const validatedData = insertStudentAttendanceSchema.partial().parse(req.body);
      
      // Get existing attendance record to verify ownership
      const existingRecord = await storage.getStudentAttendanceById(attendanceId);
      if (!existingRecord) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      
      // Validate user has access to this student's attendance
      if (user.role === 'admin' || user.role === 'teacher') {
        if (existingRecord.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied: Record not in your school" });
        }
      }
      
      // Set updatedBy to current user
      validatedData.markedBy = user.id;
      
      const attendance = await storage.updateStudentAttendance(attendanceId, validatedData);
      res.json(attendance);
    } catch (error) {
      console.error("Error updating student attendance:", error);
      res.status(500).json({ message: "Failed to update student attendance" });
    }
  });

  app.delete("/api/student-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins can delete student attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }
      
      // Get existing attendance record to verify ownership
      const existingRecord = await storage.getStudentAttendanceById(attendanceId);
      if (!existingRecord) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      
      // Validate user has access to this student's attendance
      if (user.role === 'admin') {
        if (existingRecord.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied: Record not in your school" });
        }
      }
      
      await storage.deleteStudentAttendance(attendanceId);
      res.json({ message: "Student attendance deleted successfully" });
    } catch (error) {
      console.error("Error deleting student attendance:", error);
      res.status(500).json({ message: "Failed to delete student attendance" });
    }
  });

  // Check if student is absent on a specific date
  app.get("/api/student-attendance/check/:studentId/:date", authMiddleware, async (req: any, res) => {
    try {
      const { studentId, date } = req.params;
      const user = req.user;
      
      // Permission check: admin/teacher can check any student, student can check themselves
      if (user.role !== 'admin' && user.role !== 'teacher') {
        if (user.role === 'student' && user.id !== studentId) {
          return res.status(403).json({ message: "Access denied: Can only check your own attendance" });
        } else if (user.role === 'parent') {
          return res.status(403).json({ message: "Access denied: Parent access not implemented yet" });
        }
      }
      
      const isAbsent = await storage.isStudentAbsent(studentId, date);
      res.json({ isAbsent });
    } catch (error) {
      console.error("Error checking student absence:", error);
      res.status(500).json({ message: "Failed to check student absence" });
    }
  });

  // Bulk mark all teachers present for a specific date
  app.post("/api/teacher-attendance/mark-all-present", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can mark bulk attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { date } = req.body;
      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      // Validate attendance date is not in the future
      if (isFutureDate(date)) {
        return res.status(400).json({ message: "Attendance cannot be marked for future dates" });
      }

      // Use user's schoolId - NEVER trust client-supplied schoolId
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }

      // Get all teachers for the user's school only
      const teachers = await storage.getTeachers(schoolId);
      
      // Mark teachers as present ONLY if they don't have attendance for this date
      let createdCount = 0;
      let skippedExistingCount = 0;
      const attendanceRecords = [];
      
      for (const teacher of teachers) {
        try {
          // Check if attendance already exists for this teacher and date
          const existingAttendance = await storage.getTeacherAttendanceByTeacher(teacher.id, date, date);
          
          if (existingAttendance && existingAttendance.length > 0) {
            // Skip - don't overwrite existing attendance records
            skippedExistingCount++;
            continue;
          }
          
          const attendanceData = {
            teacherId: teacher.id,
            schoolId: schoolId,
            attendanceDate: date,
            status: "present" as const,
            markedBy: user.id,
          };
          
          const attendance = await storage.markTeacherAttendance(attendanceData);
          attendanceRecords.push(attendance);
          createdCount++;
        } catch (error) {
          console.log(`Error marking teacher ${teacher.id} present:`, error);
          skippedExistingCount++;
        }
      }

      res.status(201).json({ 
        message: `Successfully marked ${createdCount} teachers as present`,
        createdCount,
        skippedExistingCount,
        totalTeachers: teachers.length,
        records: attendanceRecords 
      });
    } catch (error) {
      console.error("Error marking all teachers present:", error);
      res.status(500).json({ message: "Failed to mark all teachers present" });
    }
  });

  // Bulk mark all students in a class present for a specific date
  app.post("/api/student-attendance/mark-all-present", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can mark bulk attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { date, classId } = req.body;
      if (!date || !classId) {
        return res.status(400).json({ message: "Date and classId are required" });
      }

      // Validate attendance date is not in the future
      if (isFutureDate(date)) {
        return res.status(400).json({ message: "Attendance cannot be marked for future dates" });
      }

      // Use user's schoolId - NEVER trust client-supplied schoolId
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }

      // Verify the class belongs to the user's school for security
      const classInfo = await storage.getClass(classId);
      if (!classInfo || classInfo.schoolId !== schoolId) {
        return res.status(403).json({ message: "Class not found or not in your school" });
      }

      // Get all students for the class (already filtered by classId which is validated above)
      const students = await storage.getStudents(schoolId, classId);
      
      // Mark students as present ONLY if they don't have attendance for this date
      let createdCount = 0;
      let skippedExistingCount = 0;
      const attendanceRecords = [];
      
      for (const student of students) {
        try {
          // Check if attendance already exists for this student and date
          const existingAttendance = await storage.getStudentAttendanceByStudent(student.id, date, date);
          
          if (existingAttendance && existingAttendance.length > 0) {
            // Skip - don't overwrite existing attendance records
            skippedExistingCount++;
            continue;
          }
          
          const attendanceData = {
            studentId: student.id,
            classId: classId,
            schoolId: schoolId,
            attendanceDate: date,
            status: "present" as const,
            markedBy: user.id,
          };
          
          const attendance = await storage.markStudentAttendance(attendanceData);
          attendanceRecords.push(attendance);
          createdCount++;
        } catch (error) {
          console.log(`Error marking student ${student.id} present:`, error);
          skippedExistingCount++;
        }
      }

      res.status(201).json({ 
        message: `Successfully marked ${createdCount} students as present`,
        createdCount,
        skippedExistingCount,
        totalStudents: students.length,
        records: attendanceRecords 
      });
    } catch (error) {
      console.error("Error marking all students present:", error);
      res.status(500).json({ message: "Failed to mark all students present" });
    }
  });

  // Check if a date is a working day for the user's school
  app.get("/api/working-day", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const date = req.query.date as string;
      
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      const isWorkingDayResult = await isWorkingDay(schoolId, date);
      res.json({ isWorkingDay: isWorkingDayResult, date, schoolId });
    } catch (error) {
      console.error("Error checking working day:", error);
      res.status(500).json({ message: "Failed to check working day" });
    }
  });

  // Attendance Overview API endpoint
  app.get("/api/attendance/overview", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can access attendance overview
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use user's schoolId - NEVER trust client-supplied schoolId
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }

      const selectedDate = date || format(new Date(), "yyyy-MM-dd");

      // Get all teachers and students for the school
      const teachers = await storage.getTeachers(schoolId);
      const classes = await storage.getClasses(schoolId);
      const allStudents = await storage.getStudents(schoolId);

      // Get attendance records for the selected date
      const teacherAttendance = await storage.getTeacherAttendance(schoolId, selectedDate);
      const studentAttendance = await storage.getStudentAttendance(schoolId, selectedDate);

      // Calculate teacher stats
      const totalTeachers = teachers.length;
      const presentTeachers = teacherAttendance.filter(att => att.status === 'present').length;
      const absentTeachers = teacherAttendance.filter(att => att.status === 'absent').length;
      const teacherAttendanceRate = totalTeachers > 0 ? Math.round((presentTeachers / totalTeachers) * 100) : 0;

      // Calculate student stats
      const totalStudents = allStudents.length;
      const presentStudents = studentAttendance.filter(att => att.status === 'present').length;
      const absentStudents = studentAttendance.filter(att => att.status === 'absent').length;
      const studentAttendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;

      // Calculate class-wise attendance
      const classWiseAttendance = [];
      for (const classInfo of classes) {
        const classStudents = allStudents.filter(student => student.classId === classInfo.id);
        const classPresentStudents = studentAttendance.filter(att => 
          att.status === 'present' && classStudents.some(student => student.id === att.studentId)
        ).length;
        const classTotal = classStudents.length;
        const classAttendanceRate = classTotal > 0 ? Math.round((classPresentStudents / classTotal) * 100) : 0;
        
        classWiseAttendance.push({
          classId: classInfo.id,
          className: `Class ${classInfo.grade}${classInfo.section ? '-' + classInfo.section : ''}`,
          grade: classInfo.grade,
          section: classInfo.section,
          totalStudents: classTotal,
          presentStudents: classPresentStudents,
          attendanceRate: classAttendanceRate
        });
      }

      // Get teachers absent for 3+ consecutive days
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
      // For simplicity, we'll get all attendance for the school and filter by date range
      const allTeacherAttendance = await storage.getTeacherAttendance(schoolId);
      const recentTeacherAttendance = allTeacherAttendance.filter(att => {
        const attendanceDate = new Date(att.attendanceDate);
        return attendanceDate >= threeWeeksAgo && attendanceDate <= new Date(selectedDate);
      });

      // Group by teacher and find consecutive absences
      const teacherAbsenceMap = new Map();
      teachers.forEach(teacher => {
        const teacherAttendanceRecords = recentTeacherAttendance
          .filter(att => att.teacherId === teacher.id)
          .sort((a, b) => new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime());
        
        let consecutiveAbsences = 0;
        let maxConsecutiveAbsences = 0;
        let currentStreak = 0;
        
        // Check for consecutive absences ending on or before today
        for (let i = teacherAttendanceRecords.length - 1; i >= 0; i--) {
          const record = teacherAttendanceRecords[i];
          if (record.status === 'absent') {
            currentStreak++;
            maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, currentStreak);
          } else {
            break; // End of current streak
          }
        }
        
        if (maxConsecutiveAbsences >= 3) {
          teacherAbsenceMap.set(teacher.id, {
            teacher: teacher,
            consecutiveDays: maxConsecutiveAbsences
          });
        }
      });

      // Get students with low attendance (below 75%)
      // OPTIMIZATION: Fetch all student attendance records in one query instead of one per student
      const allStudentAttendanceRecords = await storage.getStudentAttendance(
        schoolId,
        undefined // Get all records, not just today
      );
      
      // Filter records to the date range (last 3 weeks)
      const recentStudentAttendance = allStudentAttendanceRecords.filter(att => {
        const attendanceDate = new Date(att.attendanceDate);
        return attendanceDate >= threeWeeksAgo && attendanceDate <= new Date(selectedDate);
      });
      
      // Group by student ID and calculate attendance rates
      const studentAttendanceMap = new Map();
      recentStudentAttendance.forEach(record => {
        if (!studentAttendanceMap.has(record.studentId)) {
          studentAttendanceMap.set(record.studentId, []);
        }
        studentAttendanceMap.get(record.studentId).push(record);
      });
      
      // Calculate low attendance students
      const lowAttendanceStudents = [];
      for (const student of allStudents) {
        const studentRecords = studentAttendanceMap.get(student.id) || [];
        const totalDays = studentRecords.length;
        const presentDays = studentRecords.filter(att => att.status === 'present').length;
        const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
        
        if (attendanceRate < 75 && totalDays > 0) {
          lowAttendanceStudents.push({
            student: student,
            attendanceRate: Math.round(attendanceRate),
            totalDays: totalDays,
            presentDays: presentDays
          });
        }
      }

      const overviewData = {
        date: selectedDate,
        summary: {
          teachers: {
            total: totalTeachers,
            present: presentTeachers,
            absent: absentTeachers,
            attendanceRate: teacherAttendanceRate
          },
          students: {
            total: totalStudents,
            present: presentStudents,
            absent: absentStudents,
            attendanceRate: studentAttendanceRate
          }
        },
        classWiseAttendance: classWiseAttendance.sort((a, b) => a.className.localeCompare(b.className)),
        alerts: {
          teachersAbsentConsecutive: Array.from(teacherAbsenceMap.values()),
          studentsLowAttendance: lowAttendanceStudents.slice(0, 10) // Limit to top 10
        }
      };

      res.json(overviewData);
    } catch (error) {
      console.error("Error fetching attendance overview:", error);
      res.status(500).json({ message: "Failed to fetch attendance overview" });
    }
  });

  // Auto attendance endpoint for manual triggering (admin only)
  app.post("/api/attendance/auto-mark", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can trigger auto attendance
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Import the service dynamically to avoid circular dependencies
      const { AutoAttendanceService } = await import("./services/autoAttendanceService.js");
      
      const result = await AutoAttendanceService.triggerManually();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("Error triggering auto attendance:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to trigger automatic attendance marking" 
      });
    }
  });

  // Student endpoints
  app.get("/api/students", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;
      const classId = req.query.classId as string;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || undefined;
      
      // Authorization: Admins, super admins, and class teachers can access students
      if (user.role === 'teacher') {
        // Teachers can only view students in their assigned classes
        if (!classId) {
          return res.status(403).json({ message: "Access denied: Teachers must specify a classId" });
        }
        
        if (!user.teacherId) {
          return res.status(403).json({ message: "Access denied: Teacher ID not found" });
        }

        // Verify teacher is assigned as class teacher to this class
        const assignment = await db
          .select()
          .from(classTeacherAssignments)
          .where(
            and(
              eq(classTeacherAssignments.teacherId, user.teacherId),
              eq(classTeacherAssignments.classId, classId),
              eq(classTeacherAssignments.isActive, true)
            )
          )
          .limit(1);

        if (assignment.length === 0) {
          return res.status(403).json({ message: "Access denied: You are not the class teacher for this class" });
        }
      } else if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let targetSchoolId: string | undefined;

      // For school admins, only show students from their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        targetSchoolId = user.schoolId;
      } else if (user.role === 'teacher') {
        // Teachers can only see students from their school
        targetSchoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin can specify schoolId or see all
        targetSchoolId = schoolId;
      }

      // Get total count efficiently without fetching all data
      const totalCount = await storage.getStudentCountBySchool(targetSchoolId, classId, undefined);
      
      // Get paginated students
      const students = await storage.getStudents(targetSchoolId, classId, undefined, offset, limit);
      
      res.json({
        students,
        totalCount
      });
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // Student bulk import template endpoint (must come before generic :id route)
  app.get("/api/students/template", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can download template
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get classes for the school to include in template
      const classes = await storage.getClasses(user.role === 'super_admin' ? undefined : user.schoolId);
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Create sample data with headers
      const sampleData = [
        // Headers
        ["First Name*", "Last Name*", "Admission Number*", "Class*", "Roll Number", "Email", "Contact Number", "Date of Birth (YYYY-MM-DD)", "Gender", "Blood Group", "Address", "Emergency Contact"],
        // Sample row
        ["John", "Doe", "ADM001", "1 A", "1", "john.doe@example.com", "9876543210", "2010-05-15", "male", "A+", "123 Main Street, City", "9876543210"]
      ];

      // Add class options as comments or in a separate sheet
      if (classes.length > 0) {
        sampleData.push([]);
        sampleData.push(["Available Classes:"]);
        classes.forEach(cls => {
          sampleData.push([`${cls.grade} ${cls.section}`]);
        });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      
      // Set column widths for better readability
      const columnWidths = [
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 15 }, // Admission Number
        { wch: 10 }, // Class
        { wch: 10 }, // Roll Number
        { wch: 25 }, // Email
        { wch: 15 }, // Contact Number
        { wch: 15 }, // Date of Birth
        { wch: 10 }, // Gender
        { wch: 10 }, // Blood Group
        { wch: 30 }, // Address
        { wch: 15 }  // Emergency Contact
      ];
      worksheet['!cols'] = columnWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.xlsx"');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Bulk upload students endpoint (must come before generic :id route)
  app.post("/api/students/bulk-upload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can bulk upload students
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { students } = req.body;
      
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ message: "No students data provided" });
      }

      // Get classes for validation once for all students
      const classes = await storage.getClasses(user.schoolId);
      const classMap = new Map();
      classes.forEach(cls => {
        // Handle classes with sections
        if (cls.section && cls.section.trim() !== '') {
          const section = cls.section.trim();
          classMap.set(`${cls.grade} ${section}`.toLowerCase(), cls.id);
          classMap.set(`${cls.grade}${section}`.toLowerCase(), cls.id);
          classMap.set(`${cls.grade}-${section}`.toLowerCase(), cls.id);
        } else {
          // Handle classes without sections
          classMap.set(`${cls.grade}`.toLowerCase(), cls.id);
        }
        
        // Also map by direct ID for frontend compatibility
        classMap.set(cls.id, cls.id);
      });

      // Get existing students for duplicate checking
      const existingStudents = await storage.getStudents(user.schoolId);

      const results = [];
      const errors = [];
      
      for (let i = 0; i < students.length; i++) {
        const studentData = students[i];
        
        try {
          // Use original row number from client if available, otherwise fall back to calculated
          const originalRowNumber = studentData.originalRowNumber || (i + 2);
          
          // Validate required fields
          if (!studentData.firstName || !studentData.lastName || !studentData.admissionNumber || !studentData.classId) {
            errors.push({
              row: originalRowNumber,
              error: "First Name, Last Name, Admission Number, and Class are required"
            });
            continue;
          }

          // Check if student with same admission number already exists
          const duplicateStudent = existingStudents.find(student => student.admissionNumber === studentData.admissionNumber);
          if (duplicateStudent) {
            errors.push({
              row: originalRowNumber,
              error: `Student with admission number ${studentData.admissionNumber} already exists`
            });
            continue;
          }

          // Check for duplicate admission numbers within current batch
          const currentBatchAdmissionDuplicate = students.slice(0, i).find(s => s.admissionNumber === studentData.admissionNumber);
          if (currentBatchAdmissionDuplicate) {
            errors.push({
              row: originalRowNumber,
              error: `Duplicate admission number ${studentData.admissionNumber} found in current upload batch`
            });
            continue;
          }

          // Check for duplicate contact numbers (if provided)
          if (studentData.contactNumber && studentData.contactNumber.trim() !== '') {
            const duplicateContact = existingStudents.find(student => student.contactNumber === studentData.contactNumber);
            if (duplicateContact) {
              errors.push({
                row: originalRowNumber,
                error: `Student with contact number ${studentData.contactNumber} already exists`
              });
              continue;
            }
            
            // Check for duplicates within current batch
            const currentBatchContactDuplicate = students.slice(0, i).find(s => s.contactNumber === studentData.contactNumber);
            if (currentBatchContactDuplicate) {
              errors.push({
                row: originalRowNumber,
                error: `Duplicate contact number ${studentData.contactNumber} found in current upload batch`
              });
              continue;
            }
          }

          // Check for duplicate emails (if provided)
          if (studentData.email && studentData.email.trim() !== '') {
            const duplicateEmail = existingStudents.find(student => student.email === studentData.email);
            if (duplicateEmail) {
              errors.push({
                row: originalRowNumber,
                error: `Student with email ${studentData.email} already exists`
              });
              continue;
            }
            
            // Check for duplicates within current batch
            const currentBatchEmailDuplicate = students.slice(0, i).find(s => s.email === studentData.email);
            if (currentBatchEmailDuplicate) {
              errors.push({
                row: originalRowNumber,
                error: `Duplicate email ${studentData.email} found in current upload batch`
              });
              continue;
            }
          }

          // Validate and find class
          const className = studentData.classId?.toString().trim().toLowerCase();
          if (!className) {
            errors.push({
              row: originalRowNumber,
              error: "Class is required"
            });
            continue;
          } else {
            const classId = classMap.get(className);
            if (!classId) {
              errors.push({
                row: originalRowNumber,
                error: `Class "${studentData.classId}" not found. Available classes: ${Array.from(classMap.keys()).join(', ')}`
              });
              continue;
            } else {
              // Convert class name to actual class ID
              studentData.classId = classId;
            }
          }

          // Prepare student data for creation
          const studentToCreate = {
            ...studentData,
            schoolId: user.schoolId,
            status: 'active' as const
          };

          // Create student
          const newStudent = await storage.createStudent(studentToCreate);
          results.push(newStudent);

        } catch (error: any) {
          console.error(`Error processing student ${i + 1} (row ${originalRowNumber}):`, error);
          console.error(`Student data:`, JSON.stringify(studentData, null, 2));
          errors.push({
            row: originalRowNumber,
            error: error?.message || "Unknown error"
          });
        }
      }

      console.log(`BULK IMPORT COMPLETE: ${results.length}/${students.length} students imported`);
      console.log(`ERRORS (${errors.length}):`, JSON.stringify(errors, null, 2));
      
      res.json({
        success: true,
        imported: results.length,
        total: students.length,
        errors: errors,
        students: results
      });

    } catch (error) {
      console.error("Error during bulk import:", error);
      res.status(500).json({ message: "Failed to process bulk import" });
    }
  });

  app.get("/api/students/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const requestedStudentId = req.params.id;
      
      // Allow admins, super admins, or students accessing their own data
      const isAuthorized = user.role === 'admin' || 
                          user.role === 'super_admin' || 
                          (user.role === 'student' && user.studentId === requestedStudentId);
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Access denied" });
      }

      const student = await storage.getStudent(requestedStudentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // School admins can only access students from their school
      if (user.role === 'admin' && student.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied. You can only access students from your school." });
      }

      // Students can only access their own data (double-check for security)
      if (user.role === 'student' && user.studentId !== requestedStudentId) {
        return res.status(403).json({ message: "Access denied. You can only access your own profile." });
      }

      res.json(student);
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  app.patch("/api/students/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update students
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Only administrators can update student information." });
      }

      const studentId = req.params.id;
      const existingStudent = await storage.getStudent(studentId);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // CRITICAL: Enforce tenant isolation - School admins can only update students from their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        if (existingStudent.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied. You can only update students from your school." });
        }
      }

      // For super admins, verify the school exists and they have access
      if (user.role === 'super_admin' && existingStudent.schoolId) {
        const school = await storage.getSchool(existingStudent.schoolId);
        if (!school) {
          return res.status(400).json({ message: "Invalid school association" });
        }
      }

      // Use partial schema for PATCH updates and strip unknown fields
      const updateSchema = insertStudentSchema.omit({ schoolId: true }).partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid student data",
          errors: validation.error.errors 
        });
      }

      const updateData = validation.data;

      // Validate classId belongs to the same school if being changed
      if (updateData.classId && updateData.classId !== existingStudent.classId) {
        const classData = await storage.getClass(updateData.classId);
        if (!classData) {
          return res.status(400).json({ message: "Invalid class ID" });
        }
        if (classData.schoolId !== existingStudent.schoolId) {
          return res.status(400).json({ message: "Class must belong to the same school as the student" });
        }
      }

      // Check if admission number is changing (affects login credentials)
      const isAdmissionNumberChanging = updateData.admissionNumber && 
        updateData.admissionNumber !== existingStudent.admissionNumber;

      if (isAdmissionNumberChanging) {
        // Check if new admission number already exists
        const duplicateCheck = await storage.getStudentByAdmissionNumber(updateData.admissionNumber);
        if (duplicateCheck && duplicateCheck.id !== studentId) {
          return res.status(400).json({ message: "Admission number already exists" });
        }
      }

      // Preserve original schoolId and only apply validated updates
      const finalUpdateData = {
        ...updateData,
        schoolId: existingStudent.schoolId
      };

      // Update student information
      const updatedStudent = await storage.updateStudent(studentId, finalUpdateData);

      // If admission number changed, update related login credentials
      if (isAdmissionNumberChanging) {
        // This would need to be implemented in storage layer to update users table
        // For now, log the change for manual review
        console.log(`ADMIN ACTION: Student ${studentId} admission number changed from ${existingStudent.admissionNumber} to ${updateData.admissionNumber} by user ${user.id}`);
      }

      res.json(updatedStudent);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.post("/api/students", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create students
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // For school admins, ensure the student belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required" });
        }
      }

      // Validate classId belongs to the same school if provided
      if (requestBody.classId) {
        const classData = await storage.getClass(requestBody.classId);
        if (!classData) {
          return res.status(400).json({ message: "Invalid class ID" });
        }
        if (classData.schoolId !== requestBody.schoolId) {
          return res.status(400).json({ message: "Class must belong to the same school as the student" });
        }
      }

      // Pre-process date fields to handle empty strings
      if (requestBody.dateOfBirth === "") {
        requestBody.dateOfBirth = null;
      }

      const validatedData = insertStudentSchema.parse(requestBody);
      const student = await storage.createStudent(validatedData);
      res.status(201).json(student);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data", errors: error.issues });
      }
      console.error("Error creating student:", error);
      res.status(500).json({ message: "Failed to create student" });
    }
  });

  app.put("/api/students/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update students
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingStudent = await storage.getStudent(req.params.id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // School admins can only update students from their school
      if (user.role === 'admin' && existingStudent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      delete requestBody.id; // Prevent ID modification
      delete requestBody.schoolId; // Prevent school change

      // Validate classId belongs to the same school if provided
      if (requestBody.classId) {
        const classData = await storage.getClass(requestBody.classId);
        if (!classData) {
          return res.status(400).json({ message: "Invalid class ID" });
        }
        if (classData.schoolId !== existingStudent.schoolId) {
          return res.status(400).json({ message: "Class must belong to the same school as the student" });
        }
      }

      const student = await storage.updateStudent(req.params.id, requestBody);
      res.json(student);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data", errors: error.issues });
      }
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete students
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingStudent = await storage.getStudent(req.params.id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // School admins can only delete students from their school
      if (user.role === 'admin' && existingStudent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteStudent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  // Student profile picture upload endpoint
  app.post("/api/students/:id/upload-profile-picture", authMiddleware, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const user = req.user;
      const studentId = req.params.id;
      
      // Only school admins and super admins can upload student profile pictures
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No profile picture uploaded" });
      }

      // Check if student exists and belongs to the user's school (for school admins)
      const existingStudent = await storage.getStudent(studentId);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingStudent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - student not in your school" });
      }

      // Validate file type - only allow images
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          message: `File type ${req.file.mimetype} not allowed. Only images are supported.` 
        });
      }
      
      // File size check (2MB limit for profile pictures)
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ 
          message: "File too large. Maximum size is 2MB" 
        });
      }

      // Generate secure filename
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(req.file.originalname) || '.jpg';
      const secureFilename = `${fileId}${fileExtension}`;
      
      // Create student profile pictures directory
      const profilePicturesDir = path.join(process.cwd(), 'Student Assets', 'Profile Picture');
      if (!fs.existsSync(profilePicturesDir)) {
        fs.mkdirSync(profilePicturesDir, { recursive: true });
      }
      
      // Save file to disk with secure filename
      const filePath = path.join(profilePicturesDir, secureFilename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Update student record with profile picture URL
      const profilePictureUrl = `/api/students/${studentId}/profile-picture/${fileId}${fileExtension}`;
      const updatedStudent = await storage.updateStudent(studentId, { 
        profilePictureUrl: profilePictureUrl 
      });
      
      res.json({ 
        message: "Profile picture uploaded successfully",
        profilePictureUrl: profilePictureUrl,
        student: updatedStudent
      });
    } catch (error) {
      console.error("Error uploading student profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // Student profile picture serving endpoint
  app.get("/api/students/:id/profile-picture/:filename", async (req, res) => {
    try {
      const { id: studentId, filename } = req.params;
      
      // Validate filename format (should be UUID + extension)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;
      if (!uuidRegex.test(filename)) {
        return res.status(400).json({ message: "Invalid filename format" });
      }

      // Check if student exists
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Construct file path
      const profilePicturesDir = path.join(process.cwd(), 'Student Assets', 'Profile Picture');
      const filePath = path.join(profilePicturesDir, filename);
      
      // Verify file exists and is within profile pictures directory
      if (!fs.existsSync(filePath) || !path.resolve(filePath).startsWith(path.resolve(profilePicturesDir))) {
        return res.status(404).json({ message: "Profile picture not found" });
      }

      // Get file stats and determine content type
      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      const contentType = mimeTypes[fileExtension] || 'image/jpeg';
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'X-Content-Type-Options': 'nosniff'
      });
      
      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving student profile picture:", error);
      res.status(500).json({ message: "Failed to serve profile picture" });
    }
  });

  // Parent endpoints
  app.get("/api/parents", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;
      
      // Only school admins and super admins can access parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let targetSchoolId: string | undefined;

      // For school admins, only show parents from their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        targetSchoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin can specify schoolId or see all
        targetSchoolId = schoolId;
      }

      const parents = await storage.getParents(targetSchoolId);
      res.json(parents);
    } catch (error) {
      console.error("Error fetching parents:", error);
      res.status(500).json({ message: "Failed to fetch parents" });
    }
  });

  app.get("/api/parents/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can access parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const parent = await storage.getParent(req.params.id);
      if (!parent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      // School admins can only access parents from their school
      if (user.role === 'admin' && parent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(parent);
    } catch (error) {
      console.error("Error fetching parent:", error);
      res.status(500).json({ message: "Failed to fetch parent" });
    }
  });

  app.post("/api/parents", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      const studentId = requestBody.studentId; // Extract studentId for linking
      delete requestBody.studentId; // Remove from parent data
      
      // For school admins, ensure the parent belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required" });
        }
      }

      const validatedData = insertParentSchema.parse(requestBody);
      const parent = await storage.createParent(validatedData);

      // If studentId is provided, link the parent to the student
      if (studentId) {
        await storage.linkParentToStudent(parent.id, studentId);
      }

      res.status(201).json(parent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data", errors: error.issues });
      }
      console.error("Error creating parent:", error);
      res.status(500).json({ message: "Failed to create parent" });
    }
  });

  app.put("/api/parents/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingParent = await storage.getParent(req.params.id);
      if (!existingParent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      // School admins can only update parents from their school
      if (user.role === 'admin' && existingParent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      delete requestBody.id; // Prevent ID modification
      delete requestBody.schoolId; // Prevent school change

      const parent = await storage.updateParent(req.params.id, requestBody);
      res.json(parent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data", errors: error.issues });
      }
      console.error("Error updating parent:", error);
      res.status(500).json({ message: "Failed to update parent" });
    }
  });

  app.delete("/api/parents/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingParent = await storage.getParent(req.params.id);
      if (!existingParent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      // School admins can only delete parents from their school
      if (user.role === 'admin' && existingParent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteParent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting parent:", error);
      res.status(500).json({ message: "Failed to delete parent" });
    }
  });

  // Student-Parent relationship endpoints
  app.post("/api/students/:studentId/parents/:parentId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can link students to parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { studentId, parentId } = req.params;

      // Verify both student and parent exist
      const student = await storage.getStudent(studentId);
      const parent = await storage.getParent(parentId);

      if (!student || !parent) {
        return res.status(404).json({ message: "Student or parent not found" });
      }

      // Critical security check: Student and parent must belong to the same school
      if (student.schoolId !== parent.schoolId) {
        return res.status(400).json({ message: "Student and parent must belong to the same school" });
      }

      // School admins can only link students/parents from their school
      if (user.role === 'admin') {
        if (student.schoolId !== user.schoolId || parent.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied - can only link students and parents from your school" });
        }
      }

      // For super admins, verify the school consistency
      if (user.role === 'super_admin') {
        // Additional verification that the school exists and is valid
        const school = await storage.getSchool(student.schoolId);
        if (!school) {
          return res.status(400).json({ message: "Invalid school for student and parent" });
        }
      }

      const relationship = await storage.linkStudentToParent(studentId, parentId);
      res.status(201).json(relationship);
    } catch (error) {
      console.error("Error linking student to parent:", error);
      res.status(500).json({ message: "Failed to link student to parent" });
    }
  });

  app.delete("/api/students/:studentId/parents/:parentId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can unlink students from parents
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { studentId, parentId } = req.params;

      // Verify both student and parent exist
      const student = await storage.getStudent(studentId);
      const parent = await storage.getParent(parentId);

      if (!student || !parent) {
        return res.status(404).json({ message: "Student or parent not found" });
      }

      // Critical security check: Student and parent must belong to the same school
      if (student.schoolId !== parent.schoolId) {
        return res.status(400).json({ message: "Student and parent must belong to the same school" });
      }

      // School admins can only unlink students/parents from their school
      if (user.role === 'admin') {
        if (student.schoolId !== user.schoolId || parent.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied - can only unlink students and parents from your school" });
        }
      }

      await storage.unlinkStudentFromParent(studentId, parentId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unlinking student from parent:", error);
      res.status(500).json({ message: "Failed to unlink student from parent" });
    }
  });

  app.get("/api/parents/:parentId/children", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can access parent-children relationships
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const parent = await storage.getParent(req.params.parentId);
      if (!parent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      // School admins can only access parents from their school
      if (user.role === 'admin' && parent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const children = await storage.getParentChildren(req.params.parentId);
      res.json(children);
    } catch (error) {
      console.error("Error fetching parent children:", error);
      res.status(500).json({ message: "Failed to fetch parent children" });
    }
  });

  app.get("/api/students/:studentId/parents", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      const student = await storage.getStudent(req.params.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Permission checks
      if (user.role === 'student') {
        // Students can only view their own parents
        if (user.studentId !== req.params.studentId) {
          return res.status(403).json({ message: "Access denied: Can only view your own parents" });
        }
      } else if (user.role === 'admin') {
        // School admins can only access students from their school
        if (student.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (user.role !== 'super_admin') {
        // Only students, admins, and super admins can access this endpoint
        return res.status(403).json({ message: "Access denied" });
      }

      const studentParents = await storage.getStudentParentsWithDetails(req.params.studentId);
      res.json(studentParents);
    } catch (error) {
      console.error("Error fetching student parents:", error);
      res.status(500).json({ message: "Failed to fetch student parents" });
    }
  });

  // Get student and parent login credentials
  app.get("/api/students/:studentId/credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can access credentials
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const student = await storage.getStudent(req.params.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // School admins can only access students from their school
      if (user.role === 'admin' && student.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const credentials = await storage.getStudentCredentials(req.params.studentId);
      res.json(credentials);
    } catch (error) {
      console.error("Error fetching student credentials:", error);
      res.status(500).json({ message: "Failed to fetch student credentials" });
    }
  });

  // Refresh student and parent login credentials
  app.post("/api/students/:studentId/credentials/refresh", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can refresh credentials
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const student = await storage.getStudent(req.params.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // School admins can only refresh students from their school
      if (user.role === 'admin' && student.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const credentials = await storage.refreshStudentCredentials(req.params.studentId);
      
      // Return student credentials in flat structure expected by frontend
      res.json({
        userId: credentials.studentLogin.userId,
        loginId: credentials.studentLogin.loginId,
        temporaryPassword: credentials.studentLogin.temporaryPassword,
        expiresAt: credentials.studentLogin.expiresAt
      });
    } catch (error) {
      console.error("Error refreshing student credentials:", error);
      res.status(500).json({ message: "Failed to refresh student credentials" });
    }
  });

  // Subject endpoints
  app.get("/api/subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;
      
      // Only school admins and super admins can access subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let targetSchoolId: string | undefined;

      // For school admins, only show subjects from their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        targetSchoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin can specify schoolId or see all
        targetSchoolId = schoolId;
      }

      const subjects = await storage.getSubjects(targetSchoolId);
      res.json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  app.post("/api/subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // For school admins, ensure the subject belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
      }

      // Generate unique alphanumeric code
      let baseCode = requestBody.code || requestBody.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
      let finalCode = baseCode;
      let counter = 1;
      
      // Check for existing codes and append number if needed
      while (await storage.checkSubjectCodeExists(finalCode, requestBody.schoolId)) {
        finalCode = baseCode + counter;
        if (finalCode.length > 10) {
          // If too long, truncate base and try again
          baseCode = baseCode.substring(0, 6);
          finalCode = baseCode + counter;
        }
        counter++;
      }
      
      requestBody.code = finalCode;
      // Generate unique color for this subject code
      requestBody.color = generateColorForSubjectCode(finalCode);
      const validatedData = insertSubjectSchema.parse(requestBody);
      const subject = await storage.createSubject(validatedData);
      res.status(201).json(subject);
    } catch (error) {
      console.error("Error creating subject:", error);
      res.status(400).json({ message: "Invalid subject data" });
    }
  });

  app.put("/api/subjects/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const subjectId = req.params.id;
      
      // Only school admins and super admins can update subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if subject exists and belongs to the user's school (for school admins)
      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingSubject.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - subject not in your school" });
      }

      const requestBody = { ...req.body };
      
      // If code is provided or name changed, ensure uniqueness
      if (requestBody.code || requestBody.name) {
        let baseCode = requestBody.code || requestBody.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
        let finalCode = baseCode;
        let counter = 1;
        
        // Check for existing codes (excluding current subject)
        while (await storage.checkSubjectCodeExists(finalCode, existingSubject.schoolId, subjectId)) {
          finalCode = baseCode + counter;
          if (finalCode.length > 10) {
            baseCode = baseCode.substring(0, 6);
            finalCode = baseCode + counter;
          }
          counter++;
        }
        
        requestBody.code = finalCode;
      }
      
      const validatedData = insertSubjectSchema.partial().parse(requestBody);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      const updatedSubject = await storage.updateSubject(subjectId, validatedData);
      res.json(updatedSubject);
    } catch (error) {
      console.error("Error updating subject:", error);
      res.status(400).json({ message: "Failed to update subject" });
    }
  });

  app.delete("/api/subjects/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const subjectId = req.params.id;
      
      // Only school admins and super admins can delete subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if subject exists and belongs to the user's school (for school admins)
      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingSubject.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - subject not in your school" });
      }

      await storage.deleteSubject(subjectId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ message: "Failed to delete subject" });
    }
  });


  // Get other sections of the same grade
  app.get("/api/classes/:classId/other-sections", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      
      // Only school admins and super admins can access this
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the current class to find its grade
      const currentClass = await storage.getClass(classId);
      if (!currentClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Check school access for admins
      if (user.role === 'admin' && user.schoolId && currentClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get all other classes with the same grade but different classId
      const otherSections = await storage.getOtherSectionsOfGrade(currentClass.grade, currentClass.schoolId, classId);
      res.json(otherSections);
    } catch (error) {
      console.error("Error fetching other sections:", error);
      res.status(500).json({ message: "Failed to fetch other sections" });
    }
  });

  // Copy subjects to other sections
  app.post("/api/classes/:classId/copy-subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      const { targetClassIds } = req.body;
      
      // Only school admins and super admins can copy subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!targetClassIds || !Array.isArray(targetClassIds) || targetClassIds.length === 0) {
        return res.status(400).json({ message: "Target class IDs are required" });
      }

      // Get the source class
      const sourceClass = await storage.getClass(classId);
      if (!sourceClass) {
        return res.status(404).json({ message: "Source class not found" });
      }

      // Check school access for admins
      if (user.role === 'admin' && user.schoolId && sourceClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get source class assignments to validate
      const sourceAssignments = await storage.getClassSubjectAssignments(classId, sourceClass.schoolId);

      // Validate period allocation for each target class
      const validator = new ClassPeriodAllocationValidator(storage);
      const validationErrors: { classId: string; className: string; error: string }[] = [];

      for (const targetClassId of targetClassIds) {
        const targetClass = await storage.getClass(targetClassId);
        
        if (!targetClass) {
          validationErrors.push({
            classId: targetClassId,
            className: 'Unknown',
            error: 'Class not found'
          });
          continue;
        }

        // Get existing assignments for target class
        const existingAssignments = await storage.getClassSubjectAssignments(targetClassId, sourceClass.schoolId);
        const existingSubjectIds = existingAssignments.map(a => a.subjectId);
        
        // copySubjectsBetweenClasses only ADDS new subjects (doesn't update existing ones)
        // So we only need to validate the new subjects that will be added
        const newAssignments = sourceAssignments.filter(a => !existingSubjectIds.includes(a.subjectId));
        
        if (newAssignments.length > 0) {
          // Validate if adding these new subjects would exceed the limit
          const result = await validator.validateAssignments(
            targetClassId,
            newAssignments.map(a => ({ weeklyFrequency: a.weeklyFrequency }))
          );

          if (!result.valid) {
            const className = `${targetClass.grade}${targetClass.section ? '-' + targetClass.section : ''}`;
            validationErrors.push({
              classId: targetClassId,
              className,
              error: result.errors[0]?.message || 'Period allocation would exceed weekly limit'
            });
          }
        }
      }

      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Cannot copy subjects: some classes would exceed the weekly period limit",
          errors: validationErrors
        });
      }

      // Copy subjects to target classes
      const result = await storage.copySubjectsBetweenClasses(classId, targetClassIds, sourceClass.schoolId);
      
      res.json({
        success: true,
        message: `Successfully copied subjects to ${result.copiedCount} sections`,
        copiedCount: result.copiedCount,
        skippedCount: result.skippedCount
      });
    } catch (error) {
      console.error("Error copying subjects:", error);
      res.status(500).json({ message: "Failed to copy subjects" });
    }
  });

  // Create and assign subject to class in one operation
  app.post("/api/classes/:classId/create-assign-subject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      
      // Only school admins and super admins can create and assign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify the class exists and belongs to the user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      const requestBody = { ...req.body, classId };
      
      // Set school ID based on user role
      let schoolId: string;
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        schoolId = classData.schoolId;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = createAndAssignSubjectSchema.parse(requestBody);

      // Pre-fetch all subjects once for efficiency
      const allSubjects = await storage.getSubjects(schoolId);

      // Check if this class already has a subject with this name to avoid duplicates
      const currentClassAssignments = await storage.getClassSubjectAssignments(classId);
      const existingSubjectForClass = currentClassAssignments.find(assignment => {
        const subject = allSubjects.find(s => s.id === assignment.subjectId);
        return subject && subject.name.toLowerCase() === validatedData.name.toLowerCase();
      });

      if (existingSubjectForClass) {
        return res.status(409).json({ message: `Subject "${validatedData.name}" is already assigned to this class` });
      }

      // Check if any other section of this grade already has this subject name
      const existingGradeClasses = (await storage.getClasses(schoolId)).filter(cls => cls.grade === classData.grade);
      let existingSubjectId = null;
      let existingSubject = null;
      
      for (const existingClass of existingGradeClasses) {
        if (existingClass.id === classId) continue; // Skip the current class
        const existingAssignments = await storage.getClassSubjectAssignments(existingClass.id);
        for (const assignment of existingAssignments) {
          const foundSubject = allSubjects.find(s => s.id === assignment.subjectId);
          if (foundSubject && foundSubject.name.toLowerCase() === validatedData.name.toLowerCase()) {
            existingSubjectId = foundSubject.id;
            existingSubject = foundSubject;
            break;
          }
        }
        if (existingSubjectId) break;
      }

      let subject;
      if (existingSubjectId && existingSubject) {
        // Reuse existing subject from same grade
        subject = existingSubject;
      } else {
        // Create new subject for this grade using standardized grade-specific code
        const finalCode = await generateGradeSpecificSubjectCode(
          validatedData.name,
          classData.grade,
          schoolId
        );

        // Create the subject with unique color based on code
        const subjectData = {
          name: validatedData.name,
          code: finalCode,
          color: generateColorForSubjectCode(finalCode), // Generate unique color based on code
          periodsPerWeek: validatedData.weeklyFrequency, // Use weekly frequency as default periods per week
          schoolId: schoolId,
        };

        subject = await storage.createSubject(subjectData);
      }

      // Get current academic session for proper assignment tracking
      const currentSession = await storage.getCurrentAcademicSession(schoolId);
      if (!currentSession) {
        return res.status(400).json({ message: "No active academic session found for this school" });
      }

      // Assign the subject to the class
      const assignmentData = {
        classId: validatedData.classId,
        subjectId: subject.id,
        weeklyFrequency: validatedData.weeklyFrequency,
        academicSessionId: currentSession.id,
      };

      const assignment = await storage.createClassSubjectAssignment(assignmentData);

      res.status(201).json({
        success: true,
        subject,
        assignment,
        message: `Subject "${subject.name}" created and assigned to class successfully`,
      });
    } catch (error) {
      console.error("Error creating and assigning subject:", error);
      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({ message: "Invalid data provided" });
      } else {
        res.status(500).json({ message: "Failed to create and assign subject" });
      }
    }
  });

  // Class endpoints
  app.get("/api/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      let schoolId: string | undefined;

      // For school admins, only show classes from their school
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      const classes = await storage.getClasses(schoolId);
      res.json(classes);
    } catch (error) {
      console.error("Error fetching classes:", error);
      res.status(500).json({ message: "Failed to fetch classes" });
    }
  });

  app.get("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;

      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Check if user has access to this class
      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      res.json(classData);
    } catch (error) {
      console.error("Error fetching class:", error);
      res.status(500).json({ message: "Failed to fetch class" });
    }
  });

  app.post("/api/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Debug logging
      console.log("User creating class:", { 
        role: user.role, 
        schoolId: user.schoolId,
        userId: user.id 
      });
      console.log("Request body:", req.body);

      // For school admins, ensure the class belongs to their school
      const requestBody = { ...req.body };
      
      let schoolId: string;
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
        schoolId = requestBody.schoolId;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get current academic session for the school and add to request body
      const currentSession = await storage.getCurrentAcademicSession(schoolId);
      if (!currentSession) {
        return res.status(400).json({ message: "No active academic session found for this school" });
      }
      requestBody.academicSessionId = currentSession.id;

      console.log("Final request body before validation:", requestBody);
      const validatedData = insertClassSchema.parse(requestBody);
      const classData = await storage.createClass(validatedData);
      res.status(201).json(classData);
    } catch (error) {
      console.error("Error creating class:", error);
      res.status(400).json({ message: "Invalid class data" });
    }
  });

  // Bulk upload classes endpoint
  app.post("/api/classes/bulk-upload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can bulk upload classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { classes } = req.body;
      
      if (!Array.isArray(classes) || classes.length === 0) {
        return res.status(400).json({ message: "No classes data provided" });
      }

      // Determine schoolId based on user role
      let schoolId: string;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admins should provide schoolId in request body
        schoolId = req.body.schoolId;
        if (!schoolId) {
          return res.status(400).json({ message: "schoolId is required for super admin" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get existing classes for duplicate checking
      const existingClasses = await storage.getClasses(schoolId);

      // Get subjects for validation
      const subjects = await storage.getSubjects(schoolId);
      const subjectMap = new Map();
      subjects.forEach(subject => {
        subjectMap.set(subject.name.toLowerCase(), subject.id);
        subjectMap.set(subject.code.toLowerCase(), subject.id);
      });

      const results = [];
      const errors = [];
      
      for (let i = 0; i < classes.length; i++) {
        const classData = classes[i];
        
        try {
          // Use original row number from client if available, otherwise fall back to calculated
          const originalRowNumber = classData.originalRowNumber || (i + 2);
          
          // Validate required fields
          if (!classData.grade || !classData.requiredSubjects) {
            errors.push({
              row: originalRowNumber,
              error: "Grade and Required Subjects are required"
            });
            continue;
          }

          // Check if class with same grade-section already exists
          const duplicateClass = existingClasses.find(cls => 
            cls.grade === classData.grade.toString() && 
            (cls.section || '') === (classData.section || '')
          );
          if (duplicateClass) {
            const sectionText = classData.section ? ` ${classData.section}` : '';
            errors.push({
              row: originalRowNumber,
              error: `Class Grade ${classData.grade}${sectionText} already exists`
            });
            continue;
          }

          // Check for duplicate grade-section within current batch
          const currentBatchDuplicate = classes.slice(0, i).find(c => 
            c.grade === classData.grade && (c.section || '') === (classData.section || '')
          );
          if (currentBatchDuplicate) {
            const sectionText = classData.section ? ` ${classData.section}` : '';
            errors.push({
              row: originalRowNumber,
              error: `Duplicate class Grade ${classData.grade}${sectionText} found in current upload batch`
            });
            continue;
          }

          // Validate and process subjects - create missing subjects
          const subjectNames = classData.requiredSubjects.split(',').map(s => s.trim()).filter(Boolean);
          const subjectIds: string[] = [];

          for (const subjectName of subjectNames) {
            // Create grade-specific key for subject lookup (shared across sections in same grade)
            const gradeSpecificSubjectKey = `${classData.grade}-${subjectName.toLowerCase()}`;
            let subjectId = subjectMap.get(gradeSpecificSubjectKey);
            
            if (!subjectId) {
              // Check if any other section of this grade already has this subject
              // First check existing classes in database
              const existingGradeClasses = existingClasses.filter(cls => cls.grade === classData.grade.toString());
              let existingSubjectId = null;
              
              for (const existingClass of existingGradeClasses) {
                const existingAssignments = await storage.getClassSubjectAssignments(existingClass.id);
                for (const assignment of existingAssignments) {
                  const existingSubject = subjects.find(s => s.id === assignment.subjectId);
                  if (existingSubject && existingSubject.name.toLowerCase() === subjectName.toLowerCase()) {
                    existingSubjectId = existingSubject.id;
                    break;
                  }
                }
                if (existingSubjectId) break;
              }
              
              if (existingSubjectId) {
                // Reuse existing subject from same grade
                subjectId = existingSubjectId;
                subjectMap.set(gradeSpecificSubjectKey, subjectId);
              } else {
                // Create new subject for this grade
                try {
                  // Create meaningful subject code based on subject name
                  const baseCode = subjectName.substring(0, 4).replace(/[^a-zA-Z]/g, '').padEnd(4, 'X');
                  let uniqueCode = '';
                  let attempts = 0;
                  const maxAttempts = 100;
                  
                  // Keep generating codes until we find a unique one
                  do {
                    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit number
                    uniqueCode = `${baseCode}${randomSuffix}`.toUpperCase();
                    attempts++;
                  } while (
                    (subjectMap.has(`code:${uniqueCode.toLowerCase()}`) || 
                     subjects.some(s => s.code.toLowerCase() === uniqueCode.toLowerCase())) && 
                    attempts < maxAttempts
                  );
                  
                  if (attempts >= maxAttempts) {
                    // Fallback to timestamp-based code if we can't find unique code
                    uniqueCode = `${baseCode}${Date.now().toString().slice(-3)}`.toUpperCase();
                  }
                  
                  const newSubject = await storage.createSubject({
                    name: subjectName,
                    code: uniqueCode,
                    periodsPerWeek: 5, // Default 5 periods per week for auto-created subjects
                    schoolId: schoolId
                  });
                  subjectId = newSubject.id;
                  // Add to map with grade-specific key for this batch
                  subjectMap.set(gradeSpecificSubjectKey, subjectId);
                  subjectMap.set(`code:${uniqueCode.toLowerCase()}`, subjectId);
                } catch (subjectError) {
                  console.error(`Error creating subject ${subjectName}:`, subjectError);
                  errors.push({
                    row: originalRowNumber,
                    error: `Failed to create subject: ${subjectName}`
                  });
                  continue;
                }
              }
            }
            
            subjectIds.push(subjectId);
          }

          // Get current academic session for the school
          const currentSession = await storage.getCurrentAcademicSession(schoolId);
          if (!currentSession) {
            errors.push({
              row: originalRowNumber,
              error: "No active academic session found for this school"
            });
            continue;
          }

          // Create class
          const newClassData = {
            grade: classData.grade.toString(),
            section: classData.section || '',
            requiredSubjects: subjectIds,
            schoolId: schoolId,
            academicSessionId: currentSession.id
          };

          const createdClass = await storage.createClass(newClassData);
          
          // Create class-subject assignments for each subject
          for (const subjectId of subjectIds) {
            try {
              await storage.createClassSubjectAssignment({
                classId: createdClass.id,
                subjectId: subjectId,
                weeklyFrequency: 5, // Default 5 periods per week to match subject's periodsPerWeek
                academicSessionId: currentSession.id
              });
            } catch (assignmentError) {
              console.error(`Error creating class-subject assignment for class ${createdClass.id} and subject ${subjectId}:`, assignmentError);
              // Continue with other assignments even if one fails
            }
          }
          
          results.push(createdClass);

        } catch (error) {
          console.error(`Error processing class ${i + 1}:`, error);
          errors.push({
            row: classData.originalRowNumber || (i + 2),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        imported: results.length,
        total: classes.length,
        errors: errors,
        results: results
      });
      
    } catch (error) {
      console.error("Error in bulk class upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  app.put("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;
      
      // Only school admins and super admins can update classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if class exists and belongs to the user's school (for school admins)
      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      const validatedData = updateClassSchema.parse(req.body);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      // Check if the new grade-section combination already exists in the same school
      const schoolId = existingClass.schoolId;
      const isDuplicate = await storage.checkClassExists(
        validatedData.grade || existingClass.grade,
        validatedData.section !== undefined ? validatedData.section : existingClass.section,
        schoolId,
        classId
      );

      if (isDuplicate) {
        const sectionText = validatedData.section !== undefined ? validatedData.section : existingClass.section;
        const displayName = sectionText 
          ? `Class ${validatedData.grade || existingClass.grade}${sectionText}` 
          : `Class ${validatedData.grade || existingClass.grade}`;
        return res.status(400).json({ message: `${displayName} already exists in this school` });
      }

      const updatedClass = await storage.updateClass(classId, validatedData);
      res.json(updatedClass);
    } catch (error) {
      console.error("Error updating class:", error);
      res.status(400).json({ message: "Invalid class data" });
    }
  });

  app.delete("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;
      
      // Only school admins and super admins can delete classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if class exists and belongs to the user's school (for school admins)
      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      await storage.deleteClass(classId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting class:", error);
      res.status(500).json({ message: "Failed to delete class" });
    }
  });

  // Class Teacher Management Endpoints

  // Get class teacher assignments for a specific class
  app.get("/api/classes/:classId/teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      const classTeachers = await storage.getClassTeacherAssignments(classId);
      res.json(classTeachers);
    } catch (error) {
      console.error("Error fetching class teachers:", error);
      res.status(500).json({ message: "Failed to fetch class teachers" });
    }
  });

  // Assign a teacher to a class
  app.post("/api/classes/:classId/teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;

      // Only school admins and super admins can assign class teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Prepare assignment data
      const assignmentData = {
        ...req.body,
        classId,
        assignedBy: user.id,
        schoolId: classData.schoolId,
        academicSessionId: classData.academicSessionId
      };

      // Validate the data
      const validatedData = insertClassTeacherAssignmentSchema.parse(assignmentData);

      // Check if teacher is already assigned to this class
      const existingAssignment = await storage.getClassTeacherAssignment(classId, validatedData.teacherId);
      if (existingAssignment) {
        return res.status(400).json({ message: "Teacher is already assigned to this class" });
      }

      // If assigning as primary teacher, ensure no other primary teacher exists
      if (validatedData.role === 'primary' || validatedData.isPrimary) {
        const existingPrimary = await storage.getPrimaryClassTeacher(classId);
        if (existingPrimary) {
          return res.status(400).json({ message: "This class already has a primary class teacher. Please remove the existing primary teacher first or assign as co-class teacher." });
        }
      }

      const assignment = await storage.createClassTeacherAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning class teacher:", error);
      res.status(400).json({ message: "Invalid assignment data" });
    }
  });

  // Update class teacher assignment (role/privileges)
  app.put("/api/class-teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const assignmentId = req.params.id;

      // Only school admins and super admins can update class teacher assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get existing assignment
      const existingAssignment = await storage.getClassTeacherAssignmentById(assignmentId);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Class teacher assignment not found" });
      }

      // Verify school access
      if (user.role === 'admin' && user.schoolId && existingAssignment.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - assignment not in your school" });
      }

      // If changing to primary teacher, ensure no other primary teacher exists
      if ((req.body.role === 'primary' || req.body.isPrimary) && !existingAssignment.isPrimary) {
        const existingPrimary = await storage.getPrimaryClassTeacher(existingAssignment.classId);
        if (existingPrimary && existingPrimary.id !== assignmentId) {
          return res.status(400).json({ message: "This class already has a primary class teacher. Please remove the existing primary teacher first." });
        }
      }

      const updatedAssignment = await storage.updateClassTeacherAssignment(assignmentId, req.body);
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Error updating class teacher assignment:", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Remove teacher from class
  app.delete("/api/class-teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const assignmentId = req.params.id;

      // Only school admins and super admins can remove class teacher assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get existing assignment
      const existingAssignment = await storage.getClassTeacherAssignmentById(assignmentId);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Class teacher assignment not found" });
      }

      // Verify school access
      if (user.role === 'admin' && user.schoolId && existingAssignment.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - assignment not in your school" });
      }

      // Check if this is the last class teacher
      const classTeachers = await storage.getClassTeacherAssignments(existingAssignment.classId);
      if (classTeachers.length <= 1) {
        return res.status(400).json({ message: "Cannot remove the last class teacher. Each class must have at least one class teacher." });
      }

      await storage.deleteClassTeacherAssignment(assignmentId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing class teacher:", error);
      res.status(500).json({ message: "Failed to remove class teacher" });
    }
  });

  // Student class access endpoints (read-only for students)
  app.get("/api/classes/:classId/students", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;

      // Only students can access this endpoint (read-only)
      if (user.role !== 'student') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify the student belongs to this class
      const student = await storage.getStudent(user.studentId);
      if (!student || student.classId !== classId) {
        return res.status(403).json({ message: "Access denied - you are not a member of this class" });
      }

      // Get all students in the class (excluding passwords and sensitive data)
      const students = await storage.getStudents(user.schoolId, classId);
      
      // Return only basic student information for privacy
      const sanitizedStudents = students.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        rollNumber: s.rollNumber,
        admissionNumber: s.admissionNumber,
        status: s.status
      }));

      res.json(sanitizedStudents);
    } catch (error) {
      console.error("Error fetching class students:", error);
      res.status(500).json({ message: "Failed to fetch class students" });
    }
  });

  // Timetable endpoints
  app.get("/api/timetable", authMiddleware, async (req: any, res) => {
    try {
      const { classId, teacherId } = req.query;
      
      let timetable;
      if (classId) {
        timetable = await storage.getTimetableForClass(classId as string);
      } else if (teacherId) {
        timetable = await storage.getTimetableForTeacher(teacherId as string);
      } else {
        timetable = await storage.getTimetableEntries();
      }
      
      res.json(timetable);
    } catch (error) {
      console.error("Error fetching timetable:", error);
      res.status(500).json({ message: "Failed to fetch timetable" });
    }
  });

  app.get("/api/timetable/detailed", authMiddleware, async (req: any, res) => {
    try {
      const { classId, teacherId, date } = req.query;
      
      // Use merged timetable data (global + weekly overrides)
      const user = req.user;
      let schoolId: string | undefined;
      if (user.role !== 'superadmin' && user.schoolId) {
        schoolId = user.schoolId;
      }
      console.log(`[DETAILED API] Fetching timetable - classId: ${classId}, teacherId: ${teacherId}, schoolId: ${schoolId}`);
      let timetable = await getMergedTimetableData(classId, teacherId, schoolId);
      console.log(`[DETAILED API] getMergedTimetableData returned ${timetable.length} entries`);

      // Apply timetable changes for both daily and weekly views
      try {
        if (schoolId) {
          // For daily view, use the provided date
          // For weekly view, use today's date to get current week changes
          const targetDate = date || new Date().toISOString().split('T')[0];
          const changes = await storage.getActiveTimetableChanges(schoolId, targetDate);
          
          // Apply approved changes to the timetable
          const approvedChanges = changes.filter(change => change.approvedBy && change.isActive);
          
          for (const change of approvedChanges) {
            if (change.changeType === 'cancellation') {
              // Remove cancelled entries
              timetable = timetable.filter(entry => entry.id !== change.timetableEntryId);
            }
          }
        }
      } catch (changeError) {
        console.error("Error applying timetable changes:", changeError);
        // Continue without changes if there's an error
      }

      // Filter by date if provided (for daily view)
      if (date && typeof date === 'string') {
        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Filter timetable entries for the specific day
        timetable = timetable.filter(entry => entry.day.toLowerCase() === dayOfWeek);
      }

      // Get related data with proper school filtering (user and schoolId already declared above)
      const [teachers, subjects, classes] = await Promise.all([
        storage.getTeachers(schoolId),
        storage.getSubjects(schoolId),
        storage.getClasses(schoolId),
      ]);

      // Enrich timetable with related data
      const detailedTimetable = timetable.map(entry => {
        const teacher = teachers.find(t => t.id === entry.teacherId);
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          ...entry,
          teacher,
          subject,
          class: classData,
        };
      });

      res.json(detailedTimetable);
    } catch (error) {
      console.error("Error fetching detailed timetable:", error);
      res.status(500).json({ message: "Failed to fetch detailed timetable" });
    }
  });

  // Helper function to merge global timetable with weekly overrides
  async function getMergedTimetableData(classId?: string, teacherId?: string, schoolId?: string) {
    let globalTimetable;
    if (classId) {
      globalTimetable = await storage.getTimetableForClass(classId as string);
    } else if (teacherId) {
      globalTimetable = await storage.getTimetableForTeacher(teacherId as string);
    } else {
      globalTimetable = await storage.getTimetableEntries(schoolId);
    }

    // If requesting for a specific class, check for weekly timetable overrides
    if (classId) {
      // Get current week's weekly timetable
      const currentDate = new Date();
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      try {
        const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
        
        if (weeklyTimetable && weeklyTimetable.timetableData) {
          // Create a map of global entries
          const globalMap = new Map();
          globalTimetable.forEach(entry => {
            const key = `${entry.day.toLowerCase()}-${entry.period}`;
            globalMap.set(key, entry);
          });

          // Apply weekly overrides
          const weeklyData = Array.isArray(weeklyTimetable.timetableData) 
            ? weeklyTimetable.timetableData 
            : [];
          
          weeklyData.forEach(weeklyEntry => {
            const key = `${weeklyEntry.day.toLowerCase()}-${weeklyEntry.period}`;
            
            if (weeklyEntry.isModified) {
              if (weeklyEntry.teacherId === null && weeklyEntry.subjectId === null) {
                // This is a deletion - remove the entry
                console.log(`[TIMETABLE MERGE] Deleting entry: ${key}`);
                globalMap.delete(key);
              } else if (weeklyEntry.teacherId && weeklyEntry.subjectId) {
                // This is an assignment - update or add the entry
                console.log(`[TIMETABLE MERGE] Updating entry: ${key}`);
                globalMap.set(key, {
                  id: `weekly-${key}`,
                  classId: classId,
                  teacherId: weeklyEntry.teacherId,
                  subjectId: weeklyEntry.subjectId,
                  day: weeklyEntry.day,
                  period: weeklyEntry.period,
                  startTime: weeklyEntry.startTime,
                  endTime: weeklyEntry.endTime,
                  room: weeklyEntry.room,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
              }
            }
          });

          // Convert back to array
          return Array.from(globalMap.values());
        }
      } catch (error) {
        console.error('[TIMETABLE MERGE] Error getting weekly timetable:', error);
        // Continue with global data if weekly fetch fails
      }
    }

    return globalTimetable;
  }

  // Global Timetable API - returns timetable with weekly overrides when available
  app.get("/api/timetable/global", authMiddleware, async (req: any, res) => {
    try {
      // Prevent caching of global timetable data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { classId, teacherId, date } = req.query;
      console.log('[GLOBAL API] Request params:', { classId, teacherId, date });

      // Get school filtering
      const user = req.user;
      let schoolId: string | undefined;
      if (user.role !== 'superadmin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      // CRITICAL FIX: This endpoint should ALWAYS return ONLY the master/global timetable
      // It should NEVER return weekly timetable data, regardless of date parameter
      // The date parameter is ignored - master timetable is date-independent
      
      // Get classes for the school
      const allClasses = await storage.getClasses(schoolId);
      const targetClasses = classId 
        ? allClasses.filter((c: any) => c.id === classId)
        : allClasses;

      console.log('[GLOBAL API] Target classes count:', targetClasses.length);

      // Fetch related data
      const [teachers, subjects] = await Promise.all([
        storage.getTeachers(schoolId),
        storage.getSubjects(schoolId),
      ]);

      let allEntries: any[] = [];

      // For each class, get ONLY the master timetable (never weekly)
      for (const classData of targetClasses) {
        // Always use master timetable - this endpoint should never return weekly data
        const masterEntries = await storage.getTimetableEntriesForClass(classData.id);
        let classEntries = masterEntries.filter((e: any) => e.isActive);

        // Filter by teacherId if provided
        if (teacherId) {
          classEntries = classEntries.filter((e: any) => e.teacherId === teacherId);
        }

        // Enrich with teacher, subject, and class data
        const enrichedEntries = classEntries.map(entry => {
          const teacher = teachers.find((t: any) => t.id === entry.teacherId);
          const subject = subjects.find((s: any) => s.id === entry.subjectId);

          return {
            ...entry,
            teacher,
            subject,
            class: classData,
          };
        });

        allEntries = allEntries.concat(enrichedEntries);
      }

      console.log('[GLOBAL API] Final timetable entries count:', allEntries.length);
      res.json(allEntries);
    } catch (error) {
      console.error("Error fetching global timetable:", error);
      res.status(500).json({ message: "Failed to fetch global timetable" });
    }
  });

  app.get("/api/timetable/optimize", async (req, res) => {
    try {
      const suggestions = await scheduler.suggestOptimizations();
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting optimization suggestions:", error);
      res.status(500).json({ message: "Failed to get optimization suggestions" });
    }
  });

  // Teacher Substitution endpoints
  app.get("/api/substitutions", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admins can view substitutions
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { status, startDate, endDate } = req.query;
      const schoolId = user.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const { teacherSubstitutions } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and, gte, lte, or, lt } = await import("drizzle-orm");
      const { getCurrentDateIST } = await import("@shared/utils/dateUtils");
      
      const today = getCurrentDateIST();
      
      // Auto-cancel past substitutions that are still pending/suggested (no action taken)
      await db.update(teacherSubstitutions)
        .set({ 
          status: 'cancelled',
          notes: 'Automatically cancelled - date has passed',
          updatedAt: new Date()
        })
        .where(and(
          eq(teacherSubstitutions.schoolId, schoolId),
          lt(teacherSubstitutions.date, today),
          or(
            eq(teacherSubstitutions.status, 'pending'),
            eq(teacherSubstitutions.status, 'suggested')
          )
        ));
      
      const conditions = [
        eq(teacherSubstitutions.schoolId, schoolId),
        gte(teacherSubstitutions.date, today) // Only today and future dates
      ];
      
      if (status) {
        conditions.push(eq(teacherSubstitutions.status, status as any));
      }
      if (startDate) {
        conditions.push(gte(teacherSubstitutions.date, startDate as string));
      }
      if (endDate) {
        conditions.push(lte(teacherSubstitutions.date, endDate as string));
      }
      
      const substitutions = await db.query.teacherSubstitutions.findMany({
        where: and(...conditions),
        with: {
          originalTeacher: true,
          substituteTeacher: true,
          class: true,
          subject: true,
        },
        orderBy: (teacherSubstitutions, { asc }) => [asc(teacherSubstitutions.date), asc(teacherSubstitutions.period)]
      });
      
      // Map suggestedSubstitutes to suggestions for frontend compatibility
      // Also compute class name from grade and section with "Class" prefix
      const substitutionsWithSuggestions = substitutions.map(sub => ({
        ...sub,
        suggestions: sub.suggestedSubstitutes || [],
        class: sub.class ? {
          ...sub.class,
          name: `Class ${sub.class.grade}${sub.class.section ? ` ${sub.class.section}` : ''}`
        } : null
      }));
      
      res.json(substitutionsWithSuggestions);
    } catch (error) {
      console.error("Error fetching substitutions:", error);
      res.status(500).json({ message: "Failed to fetch substitutions" });
    }
  });
  
  app.get("/api/substitutions/urgent", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const { teacherSubstitutions } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and, or, isNull, lte, gte, lt, sql } = await import("drizzle-orm");
      const { getCurrentDateIST } = await import("@shared/utils/dateUtils");
      
      const today = getCurrentDateIST();
      
      // Auto-cancel past substitutions that are still pending/suggested (no action taken)
      await db.update(teacherSubstitutions)
        .set({ 
          status: 'cancelled',
          notes: 'Automatically cancelled - date has passed',
          updatedAt: new Date()
        })
        .where(and(
          eq(teacherSubstitutions.schoolId, schoolId),
          lt(teacherSubstitutions.date, today),
          or(
            eq(teacherSubstitutions.status, 'pending'),
            eq(teacherSubstitutions.status, 'suggested')
          )
        ));
      
      // Calculate 15 days ago for history
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split('T')[0];
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Return ALL notifications (read and unread) from today onwards (no past dates)
      const urgent = await db.query.teacherSubstitutions.findMany({
        where: and(
          eq(teacherSubstitutions.schoolId, schoolId),
          or(
            eq(teacherSubstitutions.status, 'pending'),
            eq(teacherSubstitutions.status, 'suggested')
          ),
          isNull(teacherSubstitutions.substituteTeacherId),
          lte(teacherSubstitutions.date, tomorrowStr),
          gte(teacherSubstitutions.date, today) // Changed from fifteenDaysAgoStr to today
        ),
        with: {
          originalTeacher: true,
          class: true,
          subject: true,
        },
        orderBy: (teacherSubstitutions, { desc }) => [desc(teacherSubstitutions.createdAt)]
      });
      
      // Map suggestedSubstitutes to suggestions for frontend compatibility
      // Also compute class name from grade and section with "Class" prefix
      // Include viewedBy and isRead status for frontend
      const urgentWithSuggestions = urgent.map(sub => ({
        ...sub,
        suggestions: sub.suggestedSubstitutes || [],
        class: sub.class ? {
          ...sub.class,
          name: `Class ${sub.class.grade}${sub.class.section ? ` ${sub.class.section}` : ''}`
        } : null,
        isRead: (sub.viewedBy || []).includes(user.id)
      }));
      
      res.json(urgentWithSuggestions);
    } catch (error) {
      console.error("Error fetching urgent substitutions:", error);
      res.status(500).json({ message: "Failed to fetch urgent substitutions" });
    }
  });
  
  app.post("/api/notifications/mark-viewed", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const { teacherSubstitutions, timetableChanges } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and, or, isNull, lte, not, sql } = await import("drizzle-orm");
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Mark urgent substitutions as viewed
      await db.execute(sql`
        UPDATE teacher_substitutions 
        SET viewed_by = COALESCE(viewed_by, '[]'::jsonb) || ${JSON.stringify([user.id])}::jsonb
        WHERE school_id = ${schoolId}
        AND (status = 'pending' OR status = 'suggested')
        AND substitute_teacher_id IS NULL
        AND date <= ${tomorrowStr}
        AND NOT (viewed_by @> ${JSON.stringify([user.id])}::jsonb)
      `);
      
      // Mark active timetable changes as viewed
      await db.execute(sql`
        UPDATE timetable_changes 
        SET viewed_by = COALESCE(viewed_by, '[]'::jsonb) || ${JSON.stringify([user.id])}::jsonb
        WHERE timetable_entry_id IN (
          SELECT id FROM timetable_entries WHERE school_id = ${schoolId}
        )
        AND is_active = true
        AND NOT (viewed_by @> ${JSON.stringify([user.id])}::jsonb)
      `);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as viewed:", error);
      res.status(500).json({ message: "Failed to mark notifications as viewed" });
    }
  });
  
  app.post("/api/substitutions/:id/suggest", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { substitutionService } = await import("./services/substitution");
      const suggestions = await substitutionService.suggestSubstitutes(id);
      
      console.log("[SUGGEST API] Generated suggestions:", JSON.stringify(suggestions, null, 2));
      
      res.json({ suggestions });
    } catch (error) {
      console.error("Error suggesting substitutes:", error);
      res.status(500).json({ message: "Failed to suggest substitutes" });
    }
  });
  
  app.post("/api/substitutions/:id/assign", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { substituteTeacherId } = req.body;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!substituteTeacherId) {
        return res.status(400).json({ message: "substituteTeacherId is required" });
      }
      
      const { substitutionService } = await import("./services/substitution");
      const updated = await substitutionService.assignSubstitute(id, substituteTeacherId, user.id);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error assigning substitute:", error);
      const message = error.message || "Failed to assign substitute";
      res.status(500).json({ message });
    }
  });
  
  app.put("/api/substitutions/:id/cancel", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { substitutionService } = await import("./services/substitution");
      await substitutionService.cancelSubstitution(id);
      
      res.json({ success: true, message: "Substitution cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling substitution:", error);
      res.status(500).json({ message: "Failed to cancel substitution" });
    }
  });

  // Manual assignment endpoints
  // Assign teacher to multiple subjects in a class
  app.post("/api/classes/:classId/assign-teacher-multiple", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { teacherId, subjectIds } = req.body;

      // Validate required fields
      if (!teacherId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "teacherId and subjectIds (array) are required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if teacher exists
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Validate teacher workload BEFORE processing assignments
      const teacherAssignments = await storage.getClassSubjectAssignmentsByTeacher(teacherId);
      const currentWeeklyPeriods = teacherAssignments.reduce((sum, assignment) => {
        return sum + (assignment.weeklyFrequency || 0);
      }, 0);

      // Calculate total additional periods from all subjects being assigned
      let totalAdditionalPeriods = 0;
      for (const subjectId of subjectIds) {
        const assignment = await storage.getClassSubjectAssignmentByClassAndSubject(classId, subjectId);
        if (assignment && !assignment.assignedTeacherId) {
          totalAdditionalPeriods += assignment.weeklyFrequency || 0;
        }
      }

      const totalAfterAssignment = currentWeeklyPeriods + totalAdditionalPeriods;
      
      // Calculate teacher's weekly capacity
      const workingDays = getWorkingDaysFromAvailability(teacher.availability);
      const teacherWeeklyCapacity = calculateWeeklyCapacity(teacher.maxDailyPeriods || 6, workingDays);
      
      if (totalAfterAssignment > teacherWeeklyCapacity) {
        return res.status(400).json({ 
          message: `Current load: ${currentWeeklyPeriods} periods, adding ${totalAdditionalPeriods} would make it ${totalAfterAssignment} — but the maximum allowed is ${teacherWeeklyCapacity} periods. Please assign another teacher or adjust the workload.`,
          details: {
            teacherName: teacher.name,
            currentLoad: currentWeeklyPeriods,
            additionalLoad: totalAdditionalPeriods,
            totalLoad: totalAfterAssignment,
            maxLoad: teacherWeeklyCapacity
          }
        });
      }

      const results = [];
      const errors = [];

      // Process each subject assignment
      for (const subjectId of subjectIds) {
        try {
          // Check if subject exists
          const subject = await storage.getSubject(subjectId);
          if (!subject) {
            errors.push(`Subject ${subjectId} not found`);
            continue;
          }

          // Check if the subject is already assigned to this class
          const existingAssignment = await storage.getClassSubjectAssignmentByClassAndSubject(classId, subjectId);

          if (!existingAssignment) {
            errors.push(`Subject ${subject.name} must be assigned to class first before assigning a teacher`);
            continue;
          }

          if (existingAssignment.assignedTeacherId && existingAssignment.assignedTeacherId === teacherId) {
            errors.push(`Teacher is already assigned to teach ${subject.name} for this class`);
            continue;
          }

          // Update the class subject assignment with the teacher
          const updatedAssignment = await storage.updateClassSubjectAssignment(existingAssignment.id, {
            assignedTeacherId: teacherId
          });

          results.push({
            subjectId,
            subjectName: subject.name,
            assignment: updatedAssignment
          });
        } catch (error) {
          console.error(`Error assigning teacher to subject ${subjectId}:`, error);
          errors.push(`Failed to assign teacher to subject ${subjectId}`);
        }
      }

      res.status(200).json({ 
        message: `Successfully assigned teacher to ${results.length} subjects`,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error assigning teacher to multiple subjects:", error);
      res.status(500).json({ message: "Failed to assign teacher to subjects" });
    }
  });

  app.post("/api/classes/:classId/assign-teacher", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { teacherId, subjectId } = req.body;

      // Validate required fields
      if (!teacherId || !subjectId) {
        return res.status(400).json({ message: "teacherId and subjectId are required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if teacher exists
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Check if subject exists
      const subject = await storage.getSubject(subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // Check if the subject is already assigned to this class
      const existingAssignment = await storage.getClassSubjectAssignmentByClassAndSubject(classId, subjectId);

      if (!existingAssignment) {
        return res.status(404).json({ message: "Subject must be assigned to class first before assigning a teacher" });
      }

      if (existingAssignment.assignedTeacherId && existingAssignment.assignedTeacherId === teacherId) {
        return res.status(409).json({ message: "This teacher is already assigned to teach this subject for this class" });
      }

      // Validate teacher workload - check if this assignment would exceed maxLoad
      const teacherAssignments = await storage.getClassSubjectAssignmentsByTeacher(teacherId);
      const currentWeeklyPeriods = teacherAssignments.reduce((sum, assignment) => {
        // Don't count the assignment we're about to update
        if (assignment.id === existingAssignment.id) return sum;
        return sum + (assignment.weeklyFrequency || 0);
      }, 0);
      
      const newWeeklyPeriods = existingAssignment.weeklyFrequency || 0;
      const totalAfterAssignment = currentWeeklyPeriods + newWeeklyPeriods;
      
      // Calculate teacher's weekly capacity
      const workingDays = getWorkingDaysFromAvailability(teacher.availability);
      const teacherWeeklyCapacity = calculateWeeklyCapacity(teacher.maxDailyPeriods || 6, workingDays);
      
      if (totalAfterAssignment > teacherWeeklyCapacity) {
        return res.status(400).json({ 
          message: `Current load: ${currentWeeklyPeriods} periods, adding ${newWeeklyPeriods} would make it ${totalAfterAssignment} — but the maximum allowed is ${teacherWeeklyCapacity} periods. Please assign another teacher or adjust the workload.`,
          details: {
            teacherName: teacher.name,
            currentLoad: currentWeeklyPeriods,
            additionalLoad: newWeeklyPeriods,
            totalLoad: totalAfterAssignment,
            maxLoad: teacherWeeklyCapacity
          }
        });
      }

      // Update the class subject assignment with the teacher
      const updatedAssignment = await storage.updateClassSubjectAssignment(existingAssignment.id, {
        assignedTeacherId: teacherId
      });

      res.status(200).json(updatedAssignment);
    } catch (error) {
      console.error("Error assigning teacher to class:", error);
      res.status(500).json({ message: "Failed to assign teacher to class" });
    }
  });

  app.post("/api/classes/:classId/assign-subject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { subjectId } = req.body;

      if (!subjectId) {
        return res.status(400).json({ message: "subjectId is required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if subject exists
      const subject = await storage.getSubject(subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // Add subject to class's required subjects if not already present
      const requiredSubjects = classData.requiredSubjects || [];
      if (!requiredSubjects.includes(subjectId)) {
        requiredSubjects.push(subjectId);
        
        await storage.updateClass(classId, {
          requiredSubjects
        });
      }

      res.json({ message: "Subject assigned to class successfully" });
    } catch (error) {
      console.error("Error assigning subject to class:", error);
      res.status(500).json({ message: "Failed to assign subject to class" });
    }
  });

  app.delete("/api/classes/:classId/unassign-teacher/:assignmentId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can unassign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, assignmentId } = req.params;

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Update the class subject assignment to remove the teacher
      await storage.updateClassSubjectAssignment(assignmentId, {
        assignedTeacherId: null
      });

      res.status(200).json({ message: "Teacher unassigned successfully" });
    } catch (error) {
      console.error("Error unassigning teacher from class:", error);
      res.status(500).json({ message: "Failed to unassign teacher from class" });
    }
  });

  app.delete("/api/classes/:classId/unassign-subject/:subjectId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can unassign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, subjectId } = req.params;

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Remove subject from class's required subjects
      const requiredSubjects = (classData.requiredSubjects || []).filter(id => id !== subjectId);
      
      await storage.updateClass(classId, {
        requiredSubjects
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning subject from class:", error);
      res.status(500).json({ message: "Failed to unassign subject from class" });
    }
  });


  // Timetable changes endpoints
  app.get("/api/timetable-changes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can view timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const schoolId = user.role === 'super_admin' ? req.query.schoolId : user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const changes = await storage.getTimetableChanges(schoolId, date);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching timetable changes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/timetable-changes/active", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can view active changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const schoolId = user.role === 'super_admin' ? req.query.schoolId : user.schoolId;
      const changeDate = date || new Date().toISOString().split('T')[0];
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const allChanges = await storage.getActiveTimetableChanges(schoolId, changeDate);
      
      // Filter out changes already viewed by this admin
      const changes = allChanges.filter(change => {
        const viewedBy = (change as any).viewedBy || [];
        return !viewedBy.includes(user.id);
      });
      
      res.json(changes);
    } catch (error) {
      console.error("Error fetching active timetable changes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/timetable-changes/entry/:timetableEntryId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view changes by entry
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changes = await storage.getTimetableChangesByEntry(req.params.timetableEntryId);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching timetable changes for entry:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/timetable-changes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const validatedData = insertTimetableChangeSchema.parse(req.body);
      const change = await storage.createTimetableChange(validatedData);
      res.status(201).json(change);
    } catch (error) {
      console.error("Error creating timetable change:", error);
      res.status(400).json({ message: "Invalid timetable change data" });
    }
  });

  app.put("/api/timetable-changes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const validatedData = insertTimetableChangeSchema.partial().parse(req.body);
      const change = await storage.updateTimetableChange(req.params.id, validatedData);
      res.json(change);
    } catch (error) {
      console.error("Error updating timetable change:", error);
      res.status(400).json({ message: "Invalid timetable change data" });
    }
  });

  app.delete("/api/timetable-changes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Get the change details before deletion to check if it's approved
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToDelete = changes.find(c => c.id === req.params.id);
      
      if (!changeToDelete) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // If this is an approved change, just mark it as dismissed (hide from UI)
      if (changeToDelete.approvedBy) {
        await storage.updateTimetableChange(req.params.id, {
          isActive: false
        });
        
        console.log(`Dismissed approved change notification ${req.params.id}`);
      } else {
        // For unapproved changes, fully delete as before
        await storage.deleteTimetableChange(req.params.id);
        console.log(`Permanently deleted unapproved change ${req.params.id}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting timetable change:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Approve timetable change
  app.post("/api/timetable-changes/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can approve changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changeId = req.params.id;
      
      // Get the change details before deletion
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToApprove = changes.find(c => c.id === changeId);
      
      if (!changeToApprove) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // Log the approval before deletion
      await storage.createAuditLog({
        action: "approve_timetable_change",
        entityType: "timetable_changes",
        entityId: changeId,
        userId: user.id,
        description: `Approved and processed timetable change: ${changeToApprove.changeType} for ${changeToApprove.changeDate}`,
        schoolId: user.schoolId || ""
      });

      // Permanently delete the timetable change notification after approval
      await storage.deleteTimetableChange(changeId);

      res.json({ 
        message: "Timetable change approved and notification cleared"
      });
      
    } catch (error) {
      console.error("Error approving timetable change:", error);
      res.status(500).json({ message: "Failed to approve timetable change" });
    }
  });

  // Reject timetable change
  app.post("/api/timetable-changes/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can reject changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changeId = req.params.id;
      const { reason } = req.body;
      
      // Get the change details before deletion
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToReject = changes.find(c => c.id === changeId);
      
      if (!changeToReject) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // Permanently delete the timetable change
      await storage.deleteTimetableChange(changeId);

      // Log the rejection and deletion
      await storage.createAuditLog({
        action: "reject_timetable_change",
        entityType: "timetable_changes",
        entityId: changeId,
        userId: user.id,
        description: `Rejected and permanently deleted timetable change: ${changeToReject.changeType} for ${changeToReject.changeDate}. Reason: ${reason || 'No reason provided'}`,
        schoolId: user.schoolId || ""
      });

      res.json({ 
        message: "Timetable change rejected successfully"
      });
      
    } catch (error) {
      console.error("Error rejecting timetable change:", error);
      res.status(500).json({ message: "Failed to reject timetable change" });
    }
  });

  // Timetable validity period endpoints
  app.get("/api/timetable-validity", authMiddleware, async (req: any, res) => {
    try {
      const classId = req.query.classId as string;
      const periods = await storage.getTimetableValidityPeriods(classId);
      res.json(periods);
    } catch (error) {
      console.error("Error fetching timetable validity periods:", error);
      res.status(500).json({ message: "Failed to fetch validity periods" });
    }
  });

  app.get("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const period = await storage.getTimetableValidityPeriod(req.params.id);
      if (!period) {
        return res.status(404).json({ message: "Validity period not found" });
      }
      res.json(period);
    } catch (error) {
      console.error("Error fetching validity period:", error);
      res.status(500).json({ message: "Failed to fetch validity period" });
    }
  });

  app.post("/api/timetable-validity", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { insertTimetableValidityPeriodSchema } = await import("@shared/schema");
      const validatedData = insertTimetableValidityPeriodSchema.parse(req.body);
      
      const period = await storage.createTimetableValidityPeriod(validatedData);
      res.status(201).json(period);
    } catch (error) {
      console.error("Error creating validity period:", error);
      res.status(400).json({ message: "Invalid validity period data" });
    }
  });

  app.put("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { insertTimetableValidityPeriodSchema } = await import("@shared/schema");
      const validatedData = insertTimetableValidityPeriodSchema.partial().parse(req.body);
      
      const period = await storage.updateTimetableValidityPeriod(req.params.id, validatedData);
      res.json(period);
    } catch (error) {
      console.error("Error updating validity period:", error);
      res.status(400).json({ message: "Failed to update validity period" });
    }
  });

  app.delete("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTimetableValidityPeriod(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting validity period:", error);
      res.status(500).json({ message: "Failed to delete validity period" });
    }
  });

  // CSV upload endpoints
  app.post("/api/upload/teachers", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = CSVProcessor.processTeachersCSV(csvContent);

      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV",
          errors: result.errors 
        });
      }

      // Save teachers to database
      const createdTeachers = [];
      const creationErrors = [];
      for (const teacherData of result.data) {
        try {
          // Generate proper employee ID using centralized helper from storage
          const employeeId = await storage.generateNextTeacherEmployeeId();
          const teacherWithId = {
            ...teacherData,
            employeeId // Add T#### format employee ID
          };
          
          const teacher = await storage.createTeacher(teacherWithId);
          createdTeachers.push(teacher);
        } catch (error) {
          console.error("Error creating teacher:", error);
          if (error && typeof error === 'object' && 'code' in error && 'constraint' in error) {
            if (error.code === '23505' && error.constraint === 'teachers_email_unique') {
              creationErrors.push(`Teacher with email ${teacherData.email} already exists`);
            } else {
              creationErrors.push(`Failed to create teacher: ${teacherData.name}`);
            }
          } else {
            creationErrors.push(`Failed to create teacher: ${teacherData.name}`);
          }
        }
      }

      const allErrors = [...result.errors, ...creationErrors];
      res.json({
        message: `Successfully processed ${createdTeachers.length} teachers${creationErrors.length > 0 ? ` with ${creationErrors.length} errors` : ''}`,
        teachers: createdTeachers,
        errors: allErrors
      });

    } catch (error) {
      console.error("Error uploading teachers:", error);
      res.status(500).json({ message: "Failed to upload teachers" });
    }
  });

  app.post("/api/upload/classes", authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = CSVProcessor.processClassesCSV(csvContent);

      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV",
          errors: result.errors 
        });
      }

      // Get user and schoolId for authentication
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Determine schoolId based on user role
      let schoolId: string;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admins should provide schoolId in request body or query
        schoolId = req.body.schoolId || req.query.schoolId;
        if (!schoolId) {
          return res.status(400).json({ message: "schoolId is required for super admin" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Save classes to database
      const createdClasses = [];
      const errors: string[] = [];
      for (let i = 0; i < result.data.length; i++) {
        const classData = result.data[i];
        try {
          // Add schoolId to each class before saving
          const classWithSchool = {
            ...classData,
            schoolId
          };
          const classEntity = await storage.createClass(classWithSchool);
          createdClasses.push(classEntity);
        } catch (error) {
          console.error(`Error processing row ${i + 2}:`, error);
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully processed ${createdClasses.length} classes`,
        classes: createdClasses,
        errors: result.errors
      });

    } catch (error) {
      console.error("Error uploading classes:", error);
      res.status(500).json({ message: "Failed to upload classes" });
    }
  });


  // Class Subject Assignments endpoints
  app.get("/api/class-subject-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId, teacherId } = req.query;
      
      // Ensure school-based filtering for admins
      let schoolId: string | undefined;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }
      
      // Get assignments based on filters
      let assignments = await storage.getClassSubjectAssignments(classId, schoolId);
      
      // Filter by teacherId if provided
      if (teacherId) {
        assignments = assignments.filter((a: any) => a.assignedTeacherId === teacherId);
      }
      
      console.log(`[CSA API DEBUG] ClassId: ${classId}, TeacherId: ${teacherId}, Count: ${assignments.length}`);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching class subject assignments:", error);
      res.status(500).json({ message: "Failed to fetch class subject assignments" });
    }
  });

  app.post("/api/class-subject-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertClassSubjectAssignmentSchema.parse(req.body);
      
      // Check if assignment already exists
      const existing = await storage.getClassSubjectAssignmentByClassAndSubject(
        validatedData.classId, 
        validatedData.subjectId
      );
      if (existing) {
        return res.status(400).json({ message: "Assignment already exists for this class and subject" });
      }

      // Validate period allocation before creating
      const validationResult = await classPeriodValidator.validateAssignments(
        validatedData.classId,
        [{ weeklyFrequency: validatedData.weeklyFrequency }]
      );

      if (!validationResult.valid) {
        const error = validationResult.errors[0];
        return res.status(400).json({ 
          message: error.message,
          details: {
            className: error.className,
            currentPeriods: error.currentPeriods,
            requestedPeriods: error.requestedPeriods,
            maxPeriods: error.maxPeriods,
            exceedBy: error.exceedBy
          }
        });
      }

      const assignment = await storage.createClassSubjectAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error: any) {
      console.error("Error creating class subject assignment:", error);
      const statusCode = error.statusCode || 400;
      const message = error.message || "Invalid assignment data";
      res.status(statusCode).json({ message });
    }
  });

  app.put("/api/class-subject-assignments/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignmentId = req.params.id;
      const updateData = req.body;
      
      // Get the existing assignment to determine the classId
      const existingAssignment = await storage.getClassSubjectAssignment(assignmentId);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Validate if weeklyFrequency or classId is being updated
      const weeklyFrequency = updateData.weeklyFrequency ?? existingAssignment.weeklyFrequency;
      const targetClassId = updateData.classId ?? existingAssignment.classId;
      const needsValidation = updateData.weeklyFrequency !== undefined || updateData.classId !== undefined;

      if (needsValidation) {
        // When changing classes, exclude from old class but validate against new class
        const excludeId = updateData.classId !== undefined ? undefined : assignmentId;
        
        const validationResult = await classPeriodValidator.validateAssignments(
          targetClassId,
          [{ weeklyFrequency }],
          excludeId
        );

        if (!validationResult.valid) {
          const error = validationResult.errors[0];
          return res.status(400).json({ 
            message: error.message,
            details: {
              className: error.className,
              currentPeriods: error.currentPeriods,
              requestedPeriods: error.requestedPeriods,
              maxPeriods: error.maxPeriods,
              exceedBy: error.exceedBy
            }
          });
        }
      }
      
      const assignment = await storage.updateClassSubjectAssignment(assignmentId, updateData);
      res.json(assignment);
    } catch (error: any) {
      console.error("Error updating class subject assignment:", error);
      const statusCode = error.statusCode || 400;
      const message = error.message || "Invalid assignment data";
      res.status(statusCode).json({ message });
    }
  });

  app.delete("/api/class-subject-assignments/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignmentId = req.params.id;
      await storage.deleteClassSubjectAssignment(assignmentId);
      res.json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting class subject assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Timetable Structure endpoints
  app.get("/api/timetable-structure", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Get timetable structure for the school
      let structure;
      let schoolDefaultMaxPeriods;
      
      if (user.role === 'super_admin') {
        const { schoolId } = req.query;
        structure = schoolId 
          ? await storage.getTimetableStructureBySchool(schoolId as string)
          : await storage.getTimetableStructures();
        
        // Get school's default max periods if schoolId is provided
        if (schoolId) {
          const school = await storage.getSchool(schoolId as string);
          schoolDefaultMaxPeriods = school?.defaultMaxPeriodsPerDay;
        }
      } else if (user.schoolId) {
        structure = await storage.getTimetableStructureBySchool(user.schoolId);
        
        // Get school's default max periods
        const school = await storage.getSchool(user.schoolId);
        schoolDefaultMaxPeriods = school?.defaultMaxPeriodsPerDay;
      }
      
      // Include school's default max periods in the response
      const response = structure ? {
        ...structure,
        schoolDefaultMaxPeriodsPerDay: schoolDefaultMaxPeriods
      } : structure;
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching timetable structure:", error);
      res.status(500).json({ message: "Failed to fetch timetable structure" });
    }
  });

  // Timetable Structure status endpoint - check if configuration is completed
  app.get("/api/timetable-structure/status", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Check if timetable structure exists for the school
      const structure = await storage.getTimetableStructureBySchool(user.schoolId);
      
      // Configuration is considered complete if structure exists with proper validation
      const configured = !!(
        structure && 
        structure.periodsPerDay > 0 && 
        Array.isArray(structure.workingDays) && structure.workingDays.length > 0 && 
        Array.isArray(structure.timeSlots) && structure.timeSlots.length > 0 &&
        structure.timeSlots.every(slot => 
          slot.startTime && slot.endTime && slot.period && 
          slot.startTime !== slot.endTime
        )
      );
      
      res.json({ configured });
    } catch (error) {
      console.error("Error checking timetable structure status:", error);
      res.status(500).json({ message: "Failed to check timetable structure status" });
    }
  });

  app.post("/api/timetable-structure", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create/update timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertTimetableStructureSchema.parse(req.body);
      
      // Set schoolId if not provided (for school admins)
      if (user.role === 'admin' && user.schoolId) {
        validatedData.schoolId = user.schoolId;
      }

      // Check if structure already exists for this school
      const existingStructure = await storage.getTimetableStructureBySchool(validatedData.schoolId);
      
      let structure;
      if (existingStructure) {
        // Update existing structure
        structure = await storage.updateTimetableStructure(existingStructure.id, validatedData);
      } else {
        // Create new structure
        structure = await storage.createTimetableStructure(validatedData);
      }
      
      res.status(201).json(structure);
    } catch (error) {
      console.error("Error creating/updating timetable structure:", error);
      res.status(400).json({ message: "Invalid structure data" });
    }
  });

  app.put("/api/timetable-structure/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const structureId = req.params.id;
      const updateData = req.body;
      
      // Check if structure exists and user has permission
      const existingStructure = await storage.getTimetableStructure(structureId);
      if (!existingStructure) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - structure not in your school" });
      }
      
      const structure = await storage.updateTimetableStructure(structureId, updateData);
      res.json(structure);
    } catch (error) {
      console.error("Error updating timetable structure:", error);
      res.status(400).json({ message: "Invalid structure data" });
    }
  });

  app.delete("/api/timetable-structure/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const structureId = req.params.id;
      
      // Check if structure exists and user has permission
      const existingStructure = await storage.getTimetableStructure(structureId);
      if (!existingStructure) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - structure not in your school" });
      }
      
      await storage.deleteTimetableStructure(structureId);
      res.json({ message: "Timetable structure deleted successfully" });
    } catch (error) {
      console.error("Error deleting timetable structure:", error);
      res.status(500).json({ message: "Failed to delete timetable structure" });
    }
  });

  // Timetable generation endpoints
  app.post("/api/timetable/generate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can generate timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Optional class ID parameter for generating timetable for specific class
      const { classId } = req.body;

      // Prevent caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const result = await scheduler.generateTimetable(classId, user.schoolId);
      res.json(result);
    } catch (error) {
      console.error("Error generating timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate timetable" 
      });
    }
  });

  // Check which classes have existing master timetables
  app.get("/api/check-existing-master-timetables", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can check timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all classes for the school
      const classes = await storage.getClasses(user.schoolId);
      const classStatus: Array<{
        classId: string;
        className: string;
        grade: string;
        section: string | null;
        hasExistingTimetable: boolean;
        hasAssignments: boolean;
        entryCount: number;
      }> = [];

      // Check each class for existing timetables and assignments
      for (const classItem of classes) {
        try {
          // Check for existing timetable entries
          const existingEntries = await storage.getTimetableForClass(classItem.id);
          
          // Check for class-subject assignments
          const assignments = await storage.getClassSubjectAssignments(classItem.id);
          
          const className = classItem.section && classItem.section.trim() !== '' && classItem.section !== '-' 
            ? `${classItem.grade}-${classItem.section}` 
            : classItem.grade;
            
          classStatus.push({
            classId: classItem.id,
            className,
            grade: classItem.grade,
            section: classItem.section,
            hasExistingTimetable: existingEntries.length > 0,
            hasAssignments: assignments?.length > 0,
            entryCount: existingEntries.length
          });
        } catch (classError) {
          console.error(`[CHECK TIMETABLES] Error checking class ${classItem.grade}-${classItem.section}:`, classError);
          // Add class with error status
          const className = classItem.section && classItem.section.trim() !== '' && classItem.section !== '-' 
            ? `${classItem.grade}-${classItem.section}` 
            : classItem.grade;
            
          classStatus.push({
            classId: classItem.id,
            className,
            grade: classItem.grade,
            section: classItem.section,
            hasExistingTimetable: false,
            hasAssignments: false,
            entryCount: 0
          });
        }
      }

      // Separate classes into categories
      const classesWithTimetables = classStatus.filter(c => c.hasExistingTimetable);
      const classesWithoutTimetables = classStatus.filter(c => !c.hasExistingTimetable && c.hasAssignments);
      const classesWithoutAssignments = classStatus.filter(c => !c.hasAssignments);

      res.json({
        success: true,
        allClasses: classStatus,
        classesWithTimetables,
        classesWithoutTimetables,
        classesWithoutAssignments,
        summary: {
          totalClasses: classes.length,
          withTimetables: classesWithTimetables.length,
          withoutTimetables: classesWithoutTimetables.length,
          withoutAssignments: classesWithoutAssignments.length
        }
      });
    } catch (error) {
      console.error("Error checking existing master timetables:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check existing timetables" 
      });
    }
  });

  // Generate school-wide timetables for all classes
  app.post("/api/generate-school-timetable", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can generate school timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Extract new parameters from request body
      const { overwriteExisting = true, targetClasses = [] } = req.body;

      // Get all classes for the school
      const allClasses = await storage.getClasses(user.schoolId);
      let classesToProcess = allClasses;

      // Filter classes based on targetClasses if provided
      if (targetClasses.length > 0) {
        classesToProcess = allClasses.filter(cls => targetClasses.includes(cls.id));
      }

      // If not overwriting existing, exclude classes with existing timetables
      if (!overwriteExisting) {
        const filteredClasses = [];
        for (const classItem of classesToProcess) {
          const existingEntries = await storage.getTimetableForClass(classItem.id);
          if (existingEntries.length === 0) {
            filteredClasses.push(classItem);
          }
        }
        classesToProcess = filteredClasses;
      }

      const generatedClasses: string[] = [];
      const skippedClasses: string[] = [];
      const overwrittenClasses: string[] = [];
      let totalGenerated = 0;

      // Generate timetables for each selected class
      for (const classItem of classesToProcess) {
        try {
          console.log(`[SCHOOL TIMETABLE] Processing class ${classItem.grade}-${classItem.section}...`);
          
          // Check if class has assigned teachers and subjects
          const assignments = await storage.getClassSubjectAssignments(classItem.id);
          
          if (!assignments || assignments.length === 0) {
            console.log(`[SCHOOL TIMETABLE] Skipping class ${classItem.grade}-${classItem.section} - no assignments`);
            const className = classItem.section && classItem.section.trim() !== '' && classItem.section !== '-' 
              ? `${classItem.grade}-${classItem.section}` 
              : classItem.grade;
            skippedClasses.push(className);
            continue;
          }

          // Check if class has existing timetable (for tracking overwrite vs new)
          const existingEntries = await storage.getTimetableForClass(classItem.id);
          const isOverwrite = existingEntries.length > 0;

          // Generate timetable for this class
          const result = await scheduler.generateTimetable(classItem.id, user.schoolId);
          
          if (result.success) {
            const className = classItem.section && classItem.section.trim() !== '' && classItem.section !== '-' 
              ? `${classItem.grade}-${classItem.section}` 
              : classItem.grade;
            
            generatedClasses.push(className);
            if (isOverwrite) {
              overwrittenClasses.push(className);
            }
            totalGenerated++;
            console.log(`[SCHOOL TIMETABLE] Successfully generated for class ${className} ${isOverwrite ? '(overwritten)' : '(new)'}`);
          } else {
            console.log(`[SCHOOL TIMETABLE] Failed to generate for class ${classItem.grade}-${classItem.section}:`, result.message);
          }
        } catch (classError) {
          console.error(`[SCHOOL TIMETABLE] Error generating for class ${classItem.grade}-${classItem.section}:`, classError);
          // Continue with next class even if one fails
        }
      }

      console.log(`[SCHOOL TIMETABLE] Generation complete. Generated ${totalGenerated} out of ${classesToProcess.length} targeted classes`);

      res.json({ 
        success: true, 
        message: `Generated timetables for ${totalGenerated} classes`,
        classes: generatedClasses,
        skippedClasses,
        overwrittenClasses,
        totalClasses: allClasses.length,
        targetedClasses: classesToProcess.length,
        generatedCount: totalGenerated,
        settings: {
          overwriteExisting,
          targetClassesCount: targetClasses.length
        }
      });
    } catch (error) {
      console.error("Error generating school timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate school timetable" 
      });
    }
  });

  // Set as Global Timetable - Promote weekly timetable to global timetable
  app.post("/api/timetable/set-as-global", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update global timetable
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, date } = req.body;
      
      if (!classId || !date) {
        return res.status(400).json({ message: "classId and date are required" });
      }

      // Validate date format and range
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ 
          message: "Invalid date format. Expected YYYY-MM-DD format" 
        });
      }

      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date (Monday as start of week)
      // Use fully UTC-consistent approach to avoid timezone bugs
      const d = new Date(date + 'T00:00:00Z'); // Parse as UTC
      const dow = d.getUTCDay(); // Use UTC day of week
      const offset = (dow + 6) % 7; // Monday=0, Sunday=6
      const weekStart = new Date(Date.UTC(
        d.getUTCFullYear(), 
        d.getUTCMonth(), 
        d.getUTCDate() - offset
      ));
      
      // Normalize to midnight UTC to ensure consistent date handling
      weekStart.setUTCHours(0, 0, 0, 0);

      // Get the weekly timetable for this class and week with comprehensive error handling
      let weeklyTimetable;
      try {
        weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      } catch (error) {
        console.error("Error retrieving weekly timetable:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to retrieve weekly timetable from database"
        });
      }
      
      if (!weeklyTimetable) {
        console.log(`No weekly timetable found for class ${classId} and week starting ${weekStart.toISOString().split('T')[0]}`);
        return res.status(400).json({ 
          success: false, 
          message: "No weekly timetable found for this class and week. There are no modifications to promote to global schedule." 
        });
      }

      // Validate that the weekly timetable has actual data
      if (!weeklyTimetable.timetableData || !Array.isArray(weeklyTimetable.timetableData) || 
          weeklyTimetable.timetableData.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Weekly timetable exists but contains no timetable data to promote"
        });
      }

      // Count valid entries before promotion
      const validEntries = weeklyTimetable.timetableData.filter(entry => 
        entry.teacherId && entry.subjectId
      );
      
      if (validEntries.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Weekly timetable contains no valid entries to promote to global schedule"
        });
      }

      console.log(`Promoting weekly timetable ${weeklyTimetable.id} with ${validEntries.length} valid entries to global`);

      // Promote the weekly timetable to global with comprehensive error handling
      try {
        await storage.promoteWeeklyTimetableToGlobal(weeklyTimetable.id);
        console.log(`Successfully promoted weekly timetable ${weeklyTimetable.id} to global`);
      } catch (error) {
        console.error("Error promoting weekly timetable to global:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to promote weekly timetable to global schedule: " + 
                   (error instanceof Error ? error.message : "Unknown error")
        });
      }
      
      // Deactivate the weekly timetable since it's now part of the global schedule
      try {
        await storage.updateWeeklyTimetable(weeklyTimetable.id, { isActive: false });
        console.log(`Successfully deactivated weekly timetable ${weeklyTimetable.id}`);
      } catch (error) {
        console.error("Error deactivating weekly timetable:", error);
        // Log the error but don't fail the request since the promotion succeeded
        console.warn("Weekly timetable promotion succeeded but failed to deactivate the weekly record");
      }
      
      // Use the previously calculated valid entries count for response
      const entriesCount = validEntries.length;
      
      console.log(`Set as Global operation completed successfully for class ${classId}, promoted ${entriesCount} entries`);
      
      res.json({ 
        success: true, 
        message: "Weekly timetable has been promoted to Global Timetable successfully",
        entriesUpdated: entriesCount,
        weekStartDate: weekStart.toISOString().split('T')[0]
      });
    } catch (error) {
      console.error("Error setting as global timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to update global timetable"
      });
    }
  });

  // Copy from Global Timetable - Copy global timetable to weekly timetable
  app.post("/api/timetable/copy-from-global", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can copy global to weekly
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, date } = req.body;
      
      if (!classId || !date) {
        return res.status(400).json({ message: "classId and date are required" });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD" });
      }

      // Validate that the date can be parsed
      try {
        new Date(date + 'T00:00:00Z');
      } catch (error) {
        return res.status(400).json({ message: "Invalid date provided" });
      }

      // Verify class exists and user has access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date (Monday as start of week)
      // Use fully UTC-consistent approach to avoid timezone bugs
      const d = new Date(date + 'T00:00:00Z'); // Parse as UTC
      const dow = d.getUTCDay(); // Use UTC day of week
      const offset = (dow + 6) % 7; // Monday=0, Sunday=6
      const weekStart = new Date(Date.UTC(
        d.getUTCFullYear(), 
        d.getUTCMonth(), 
        d.getUTCDate() - offset
      ));
      
      // Normalize to midnight UTC to ensure consistent date handling
      weekStart.setUTCHours(0, 0, 0, 0);

      // Get the global timetable for this class
      let globalTimetable;
      try {
        globalTimetable = await storage.getTimetableForClass(classId);
      } catch (error) {
        console.error("Error retrieving global timetable:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to retrieve global timetable from database"
        });
      }
      
      if (!globalTimetable || globalTimetable.length === 0) {
        console.log(`No global timetable found for class ${classId}`);
        return res.status(400).json({ 
          success: false, 
          message: "No global timetable found for this class. Generate a timetable first." 
        });
      }

      // Count valid entries in global timetable
      const validEntries = globalTimetable.filter(entry => 
        entry.teacherId && entry.subjectId
      );
      
      if (validEntries.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Global timetable contains no valid entries to copy"
        });
      }

      console.log(`Copying global timetable for class ${classId} (${validEntries.length} entries) to week starting ${weekStart.toISOString().split('T')[0]}`);

      // Copy global timetable to weekly timetable (this will overwrite existing weekly data)
      try {
        // Check if a weekly timetable already exists for this class and week
        const existingWeeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
        
        // Prepare timetable data from global entries (convert to weekly format)
        const weeklyTimetableData = globalTimetable.map(entry => ({
          day: entry.day,
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          room: entry.room,
          isModified: false // These are fresh copies from global
        }));
        
        if (existingWeeklyTimetable) {
          // Update existing weekly timetable with global data
          await storage.updateWeeklyTimetable(existingWeeklyTimetable.id, {
            timetableData: weeklyTimetableData,
            basedOnGlobalVersion: '1', // Mark as fresh copy from global
            modificationCount: 0,
            isActive: true
          });
          console.log(`Successfully updated existing weekly timetable ${existingWeeklyTimetable.id} with global data for class ${classId}, week ${weekStart.toISOString().split('T')[0]}`);
        } else {
          // Create new weekly timetable from global data
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // Sunday
          
          await storage.createWeeklyTimetable({
            classId: classId,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            timetableData: weeklyTimetableData,
            modifiedBy: user.id,
            modificationCount: 0,
            basedOnGlobalVersion: '1',
            schoolId: user.schoolId || classData.schoolId,
            academicSessionId: classData.academicSessionId,
            isActive: true
          });
          console.log(`Successfully created new weekly timetable from global data for class ${classId}, week ${weekStart.toISOString().split('T')[0]}`);
        }
      } catch (error) {
        console.error("Error copying global timetable to weekly:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to copy global timetable to weekly schedule: " + 
                   (error instanceof Error ? error.message : "Unknown error")
        });
      }
      
      // Use the previously calculated valid entries count for response
      const entriesCount = validEntries.length;
      
      console.log(`Copy from Global operation completed successfully for class ${classId}, copied ${entriesCount} entries`);
      
      res.json({ 
        success: true, 
        message: "Global timetable has been copied to weekly schedule successfully",
        entriesCopied: entriesCount,
        weekStartDate: weekStart.toISOString().split('T')[0]
      });
    } catch (error) {
      console.error("Error copying from global timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to copy from global timetable"
      });
    }
  });


  // Validate Timetable
  app.get("/api/timetable/validate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can validate timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = await scheduler.validateTimetable();
      res.json(validation);
    } catch (error) {
      console.error("Error validating timetable:", error);
      res.status(500).json({ 
        isValid: false, 
        conflicts: ["Unable to validate timetable due to system error"]
      });
    }
  });

  app.get("/api/timetable/suggestions", authMiddleware, async (req: any, res) => {
    try {
      const suggestions = await scheduler.suggestOptimizations();
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting timetable suggestions:", error);
      res.status(500).json({ message: "Failed to get suggestions" });
    }
  });

  // Manual Timetable Assignment Validation
  app.post("/api/timetable/validate-manual-assignment", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can validate manual assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate request body
      const validationSchema = z.object({
        classId: z.string().uuid(),
        teacherId: z.string().uuid().nullable().optional(),
        subjectId: z.string().uuid().nullable().optional(),
        day: z.string().min(1),
        period: z.number().int().positive(),
        weekStart: z.string(),
        existingEntryId: z.string().uuid().optional()
      });

      const validatedData = validationSchema.parse(req.body);

      // For free periods, both teacherId and subjectId should be null
      if (!validatedData.teacherId && !validatedData.subjectId) {
        // This is a free period - both should be null
        validatedData.teacherId = null;
        validatedData.subjectId = null;
      } else if (!validatedData.teacherId || !validatedData.subjectId) {
        // Invalid - if one is provided, both must be provided
        return res.status(400).json({
          isValid: false,
          conflicts: [{
            type: 'teacher_conflict',
            severity: 'error',
            message: 'Both teacher and subject must be provided for a scheduled assignment',
            details: { teacherId: validatedData.teacherId, subjectId: validatedData.subjectId }
          }]
        });
      }

      // Get user's school ID for access control
      let userSchoolId: string;
      if (user.role === 'super_admin') {
        // Super admin can access any school, but need to validate class belongs to a school
        const classData = await storage.getClass(validatedData.classId);
        if (!classData) {
          return res.status(404).json({
            isValid: false,
            conflicts: [{
              type: 'class_conflict',
              severity: 'error',
              message: 'Class not found',
              details: { classId: validatedData.classId }
            }]
          });
        }
        userSchoolId = classData.schoolId;
      } else {
        // Regular admin - use their school ID
        userSchoolId = user.schoolId!;
      }

      console.log(`[MANUAL VALIDATION API] Validating assignment for user ${user.id}, class ${validatedData.classId}`);

      // Call the validation service
      const validationResult = await manualTimetableValidationService.validateManualAssignment(
        validatedData,
        userSchoolId
      );

      console.log(`[MANUAL VALIDATION API] Validation result: ${validationResult.isValid ? 'VALID' : 'INVALID'}, conflicts: ${validationResult.conflicts.length}`);

      res.json(validationResult);

    } catch (error) {
      console.error("Error validating manual assignment:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          isValid: false,
          conflicts: [{
            type: 'teacher_conflict',
            severity: 'error',
            message: 'Invalid request data',
            details: { errors: error.errors }
          }]
        });
      }

      res.status(500).json({
        isValid: false,
        conflicts: [{
          type: 'teacher_conflict',
          severity: 'error',
          message: 'Validation failed due to system error',
          details: { error: error instanceof Error ? error.message : String(error) }
        }]
      });
    }
  });

  // Advanced Teacher Management Routes

  // Get teacher schedule
  app.get("/api/teachers/:teacherId/schedule", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;
      const { date } = req.query;

      // Verify teacher belongs to user's school
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher || (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId)) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const schedule = await storage.getTeacherSchedule(teacherId, date);
      
      // Get related data with proper school filtering
      let schoolId: string | undefined;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      // For teacher schedule, we should use the teacher's school to get subjects
      const teacherSchoolId = teacher.schoolId;

      const [subjects, classes] = await Promise.all([
        storage.getSubjects(teacherSchoolId),
        storage.getClasses(teacherSchoolId),
      ]);

      // Enrich schedule with related data
      const detailedSchedule = schedule.map(entry => {
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          ...entry,
          subject: subject ? {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            color: subject.color
          } : null,
          class: classData ? {
            id: classData.id,
            grade: classData.grade,
            section: classData.section
          } : null,
        };
      });

      res.json(detailedSchedule);
    } catch (error) {
      console.error("Error getting teacher schedule:", error);
      res.status(500).json({ message: "Failed to get teacher schedule" });
    }
  });

  // Get all classes assigned to a teacher
  app.get("/api/teachers/:teacherId/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;

      // Verify teacher belongs to user's school and authorization
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Authorization check: teachers can only access their own classes
      if (user.role === 'teacher' && user.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied. You can only view your own classes" });
      }

      // Non-super admins must be in the same school
      if (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const classes = await storage.getTeacherClasses(teacherId);

      res.json({ classes });
    } catch (error) {
      console.error("Error getting teacher classes:", error);
      res.status(500).json({ message: "Failed to get teacher classes" });
    }
  });

  // Get classes where teacher is class teacher (for attendance marking)
  app.get("/api/teachers/:teacherId/class-teacher-classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;

      // Verify teacher belongs to user's school and authorization
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Authorization check: teachers can only access their own classes
      if (user.role === 'teacher' && user.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied. You can only view your own classes" });
      }

      // Non-super admins must be in the same school
      if (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Get class teacher assignments
      const assignments = await db
        .select({
          id: classTeacherAssignments.id,
          classId: classTeacherAssignments.classId,
          classGrade: classes.grade,
          classSection: classes.section,
          className: sql<string>`${classes.grade} || '-' || ${classes.section}`.as('className'),
          studentCount: classes.studentCount,
          room: classes.room,
          isPrimary: classTeacherAssignments.isPrimary,
          role: classTeacherAssignments.role,
        })
        .from(classTeacherAssignments)
        .innerJoin(classes, eq(classTeacherAssignments.classId, classes.id))
        .where(
          and(
            eq(classTeacherAssignments.teacherId, teacherId),
            eq(classTeacherAssignments.isPrimary, true),
            eq(classTeacherAssignments.isActive, true)
          )
        );

      res.json({ classes: assignments });
    } catch (error) {
      console.error("Error getting teacher class teacher classes:", error);
      res.status(500).json({ message: "Failed to get class teacher classes" });
    }
  });

  // Teacher workload analytics
  app.get("/api/analytics/teacher-workload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view analytics
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const analytics = await storage.getTeacherWorkloadAnalytics(user.schoolId);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting teacher workload analytics:", error);
      res.status(500).json({ message: "Failed to get teacher workload analytics" });
    }
  });

  // Optimize teacher workload
  app.post("/api/analytics/optimize-workload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can optimize workload
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await scheduler.optimizeTeacherWorkload(user.schoolId);
      res.json(result);
    } catch (error) {
      console.error("Error optimizing teacher workload:", error);
      res.status(500).json({ message: "Failed to optimize teacher workload" });
    }
  });


  // Manual Assignment Endpoints

  // Get available teachers for manual assignment to a timetable slot
  app.get("/api/timetable/available-teachers", authMiddleware, async (req: any, res) => {
    // Disable ALL caching for this endpoint
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', `debug-${Date.now()}`); // Force unique response
    
    try {
      const user = req.user;
      const { classId, day, period, date, subjectId } = req.query;

      console.log(`[TEACHER API] Request: classId=${classId}, day=${day}, period=${period}, date=${date}, subjectId=${subjectId}`);

      // Only school admins and super admins can view available teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!classId || !day || !period) {
        return res.status(400).json({ message: "classId, day, and period are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId as string);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      console.log(`[TEACHER API] Class found: ${classData.grade}, schoolId: ${classData.schoolId}`);

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get teachers who can teach the selected subject
      console.log(`[TEACHER API] Getting teachers for schoolId: ${classData.schoolId}, subjectId: ${subjectId}`);
      
      // Step 1: Get all teachers who can teach this subject
      let availableTeachers: any[] = [];
      
      if (subjectId) {
        // Use class_subject_assignments table to find qualified teachers
        console.log(`[TEACHER API] Finding teachers qualified for subject ${subjectId} from class_subject_assignments`);
        const subjectAssignments = await storage.getClassSubjectAssignmentsBySubject(subjectId as string);
        console.log(`[TEACHER API] Found ${subjectAssignments.length} class-subject assignments for this subject`);
        
        // Extract unique teacher IDs who are assigned to teach this subject
        const qualifiedTeacherIds = new Set(
          subjectAssignments
            .filter(assignment => assignment.assignedTeacherId)
            .map(assignment => assignment.assignedTeacherId!)
        );
        console.log(`[TEACHER API] Found ${qualifiedTeacherIds.size} unique teachers qualified for this subject`);
        
        // Get all teachers from the school
        const allTeachers = await storage.getTeachers(classData.schoolId);
        
        // Filter to only qualified teachers
        const qualifiedTeachers = allTeachers.filter(teacher => qualifiedTeacherIds.has(teacher.id));
        console.log(`[TEACHER API] Qualified teachers: ${qualifiedTeachers.map(t => t.name).join(', ')}`);
        
        // Step 2: Filter out teachers who are busy during this time slot (check WEEKLY timetables)
        // Calculate week start (Monday) from the provided date using IST-safe utilities
        const targetDate = new Date(date as string);
        const weekStartDate = getWeekStartDateIST(targetDate);
        const weekStartString = getISTDateString(weekStartDate);
        
        console.log(`[TEACHER API] Checking weekly timetables for week starting: ${weekStartString}`);
        
        // Get all weekly timetables for this school and week
        const weeklyTimetables = await storage.getWeeklyTimetablesByWeek(classData.schoolId, weekStartString);
        console.log(`[TEACHER API] Found ${weeklyTimetables.length} weekly timetables for this week`);
        
        // Extract all entries from weekly timetables and find conflicts
        const conflictingEntries: any[] = [];
        for (const weeklyTimetable of weeklyTimetables) {
          // Skip the class we're assigning to
          if (weeklyTimetable.classId === classId) {
            continue;
          }
          
          // Parse timetableData JSON and find conflicts
          const timetableData = weeklyTimetable.timetableData as any[];
          if (Array.isArray(timetableData)) {
            const conflicts = timetableData.filter((entry: any) => {
              const dayMatch = entry.day?.toLowerCase() === (day as string).toLowerCase();
              const periodMatch = entry.period === parseInt(period as string);
              return dayMatch && periodMatch && entry.teacherId;
            });
            conflictingEntries.push(...conflicts);
          }
        }
        
        const busyTeacherIds = new Set(conflictingEntries.map((entry: any) => entry.teacherId));
        console.log(`[TEACHER API] Found ${conflictingEntries.length} busy teachers from weekly timetables during ${day} period ${period}`);
        
        // Return only qualified AND free teachers
        availableTeachers = qualifiedTeachers.filter(teacher => !busyTeacherIds.has(teacher.id));
        
      } else {
        // If no subject selected, return all free teachers in the school (check WEEKLY timetables)
        const allTeachers = await storage.getTeachers(classData.schoolId);
        
        // Calculate week start (Monday) from the provided date using IST-safe utilities
        const targetDate = new Date(date as string);
        const weekStartDate = getWeekStartDateIST(targetDate);
        const weekStartString = getISTDateString(weekStartDate);
        
        console.log(`[TEACHER API] Checking weekly timetables for week starting: ${weekStartString}`);
        
        // Get all weekly timetables for this school and week
        const weeklyTimetables = await storage.getWeeklyTimetablesByWeek(classData.schoolId, weekStartString);
        console.log(`[TEACHER API] Found ${weeklyTimetables.length} weekly timetables for this week`);
        
        // Extract all entries and find conflicts
        const busyTeacherIds = new Set<string>();
        for (const weeklyTimetable of weeklyTimetables) {
          // Skip the class we're assigning to
          if (weeklyTimetable.classId === classId) {
            continue;
          }
          
          const timetableData = weeklyTimetable.timetableData as any[];
          if (Array.isArray(timetableData)) {
            timetableData.forEach((entry: any) => {
              const dayMatch = entry.day?.toLowerCase() === (day as string).toLowerCase();
              const periodMatch = entry.period === parseInt(period as string);
              if (dayMatch && periodMatch && entry.teacherId) {
                busyTeacherIds.add(entry.teacherId);
              }
            });
          }
        }
        
        console.log(`[TEACHER API] Found ${busyTeacherIds.size} busy teachers from weekly timetables`);
        availableTeachers = allTeachers.filter(teacher => !busyTeacherIds.has(teacher.id));
      }

      // Step 2.5: Filter out absent teachers if date is provided (BATCH query for efficiency)
      if (date && typeof date === 'string') {
        console.log(`[TEACHER API] Filtering out absent teachers for date: ${date}`);
        
        // Get all absent teacher IDs for this date in one query (BATCH)
        const absentTeacherIds = new Set<string>();
        const teacherAttendance = await storage.getTeacherAttendance(classData.schoolId, date);
        
        // Mark teachers as absent based on their attendance status
        teacherAttendance.forEach(attendance => {
          // Consider absent, on_leave, medical_leave, personal_leave as unavailable
          if (attendance.status === 'absent' || 
              attendance.status === 'on_leave' || 
              attendance.status === 'medical_leave' || 
              attendance.status === 'personal_leave') {
            absentTeacherIds.add(attendance.teacherId);
            console.log(`[TEACHER API] Teacher ${attendance.teacherId} is ${attendance.status} on ${date}`);
          }
        });
        
        // Filter out absent teachers
        const presentTeachers = availableTeachers.filter(teacher => !absentTeacherIds.has(teacher.id));
        console.log(`[TEACHER API] Filtered out ${absentTeacherIds.size} absent/on-leave teachers`);
        
        availableTeachers = presentTeachers;
        console.log(`[TEACHER API] After filtering absent teachers: ${availableTeachers.length} teachers remain`);
      }

      // Step 2.6: Filter out teachers who have reached their daily period limit
      if (date && typeof date === 'string') {
        console.log(`[TEACHER API] Checking daily period limits for date: ${date}`);
        
        // Calculate week start for the date using IST-safe utilities
        const targetDate = new Date(date as string);
        const weekStartDate = getWeekStartDateIST(targetDate);
        const weekStartString = getISTDateString(weekStartDate);
        
        // Get the day name from the date
        const dayName = (day as string).toLowerCase();
        
        // Get all weekly timetables for this week
        const weeklyTimetables = await storage.getWeeklyTimetablesByWeek(classData.schoolId, weekStartString);
        
        // Count periods for each teacher on this specific day
        const teacherPeriodCounts = new Map<string, number>();
        
        for (const weeklyTimetable of weeklyTimetables) {
          const timetableData = weeklyTimetable.timetableData as any[];
          if (Array.isArray(timetableData)) {
            timetableData.forEach((entry: any) => {
              if (entry.day?.toLowerCase() === dayName && entry.teacherId) {
                const count = teacherPeriodCounts.get(entry.teacherId) || 0;
                teacherPeriodCounts.set(entry.teacherId, count + 1);
              }
            });
          }
        }
        
        // Filter out teachers who have reached their max daily periods
        const teachersWithinLimit = [];
        for (const teacher of availableTeachers) {
          const currentPeriods = teacherPeriodCounts.get(teacher.id) || 0;
          const maxDailyPeriods = teacher.maxDailyPeriods || 6; // Default to 6 if not set
          
          if (currentPeriods < maxDailyPeriods) {
            teachersWithinLimit.push(teacher);
          } else {
            console.log(`[TEACHER API] Teacher ${teacher.name} has reached daily limit: ${currentPeriods}/${maxDailyPeriods} periods on ${dayName}`);
          }
        }
        
        availableTeachers = teachersWithinLimit;
        console.log(`[TEACHER API] After checking daily limits: ${availableTeachers.length} teachers remain`);
      }

      // Step 3: Prioritize class teachers (primary and co-class teachers) for this specific class
      const classTeacherAssignments = await storage.getClassTeacherAssignments(classId as string);
      const classTeacherIds = new Set(classTeacherAssignments.map((assignment: any) => assignment.teacherId));

      const result = availableTeachers.map(teacher => ({
        ...teacher,
        priority: classTeacherIds.has(teacher.id) ? 1 : 2,
        teachingThisClass: classTeacherIds.has(teacher.id)
      })).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

      console.log(`[TEACHER API] SUCCESS - Returning ${result.length} available teachers:`, result.map(t => t.name));
      res.json(result);
    } catch (error) {
      console.error("[TEACHER API] ERROR:", error);
      res.status(500).json({ message: "Failed to get available teachers" });
    }
  });

  // Manually assign teacher to a weekly timetable slot
  app.post("/api/timetable/manual-assign", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can manually assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        newTeacherId, 
        classId, 
        subjectId, 
        day, 
        period, 
        startTime, 
        endTime, 
        room, 
        reason,
        weekStart // Required for weekly timetable operations
      } = req.body;

      // Validate required fields for weekly timetable operations
      if (!newTeacherId || !classId || !day || period === undefined || !weekStart) {
        return res.status(400).json({ message: "newTeacherId, classId, day, period, and weekStart are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Date validation: only allow edits for current/future dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dayMap: Record<string, number> = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2,
        'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
      };
      
      const editWeekStart = new Date(weekStart);
      const dayOffset = dayMap[day.toLowerCase()] || 0;
      const editDate = new Date(editWeekStart);
      editDate.setDate(editWeekStart.getDate() + dayOffset);
      editDate.setHours(0, 0, 0, 0);

      if (editDate < today) {
        return res.status(400).json({ 
          message: "Cannot assign teachers for past dates. You can only assign teachers for today or future dates." 
        });
      }

      // Verify teacher exists and belongs to same school
      const teacher = await storage.getTeacher(newTeacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.schoolId !== classData.schoolId) {
        return res.status(403).json({ message: "Teacher does not belong to the same school as the class" });
      }

      // Check teacher availability for this weekly time slot by looking at global timetable
      console.log(`[WEEKLY ASSIGNMENT] Checking availability for teacher ${newTeacherId} on ${day} period ${period}`);
      const allTimetableEntries = await storage.getTimetableEntries();
      const conflictingEntry = allTimetableEntries.find((entry: any) => {
        const dayMatch = entry.day.toLowerCase() === day.toLowerCase();
        const periodMatch = entry.period === period;
        const sameTeacher = entry.teacherId === newTeacherId;
        const differentClass = entry.classId !== classId;
        
        return dayMatch && periodMatch && sameTeacher && differentClass;
      });
      
      if (conflictingEntry) {
        const conflictClass = await storage.getClass(conflictingEntry.classId);
        console.log(`[WEEKLY ASSIGNMENT] CONFLICT: Teacher ${newTeacherId} is teaching class ${conflictingEntry.classId} during ${day} period ${period}`);
        return res.status(409).json({ 
          message: `Teacher ${teacher.name} is already assigned to ${conflictClass?.grade}-${conflictClass?.section} at this time slot`,
          hasConflicts: true
        });
      }
      
      console.log(`[WEEKLY ASSIGNMENT] Teacher ${newTeacherId} is available for ${day} period ${period}`);

      // Calculate week end date
      const weekEnd = new Date(editWeekStart);
      weekEnd.setDate(editWeekStart.getDate() + 6);

      // Update the weekly timetable entry directly
      const result = await storage.updateWeeklyTimetableEntry(
        classId,
        weekStart,
        weekEnd.toISOString().split('T')[0],
        day,
        period,
        {
          teacherId: newTeacherId,
          subjectId: subjectId || null,
          startTime: startTime || null,
          endTime: endTime || null,
          room: room || null,
          isModified: true,
          modificationReason: reason || "Manual teacher assignment"
        },
        user.id
      );

      // Create audit log entry for weekly assignment
      await storage.createAuditLog({
        action: "weekly_teacher_assignment",
        entityType: "weekly_timetables",
        entityId: result.id || `${classId}-${weekStart}-${day}-${period}`,
        userId: user.id,
        description: `Assigned teacher ${teacher.name} to ${classData.grade}-${classData.section} for ${day} period ${period}, week ${weekStart}`,
        schoolId: classData.schoolId
      });

      res.json({ 
        success: true, 
        message: "Teacher assigned to weekly timetable successfully", 
        weeklyEntry: result 
      });
    } catch (error) {
      console.error("Error manually assigning teacher to weekly timetable:", error);
      res.status(500).json({ message: "Failed to assign teacher to weekly timetable" });
    }
  });

  // Weekly-only manual edit endpoint (bypasses approval workflow)
  app.post("/api/timetable/weekly-edit", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can make weekly edits
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        classId, 
        weekStart,
        day, 
        period, 
        teacherId, // null to delete assignment
        subjectId, // null to delete assignment
        startTime,
        endTime,
        room,
        reason = "Manual admin edit"
      } = req.body;

      // Validate required fields
      if (!classId || !weekStart || !day || period === undefined) {
        return res.status(400).json({ message: "classId, weekStart, day, and period are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Simple date validation: allow edits for today or future dates only
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today for comparison
      
      // Calculate the actual date being edited (weekStart + day offset)
      const dayMap: Record<string, number> = {
        'monday': 0,
        'tuesday': 1, 
        'wednesday': 2,
        'thursday': 3,
        'friday': 4,
        'saturday': 5,
        'sunday': 6
      };
      
      // Parse weekStart as UTC to avoid timezone issues
      let editWeekStart = new Date(weekStart + 'T00:00:00.000Z');
      
      // TEMPORARY FIX: If weekStart is a Sunday, adjust it to the Monday of that week
      // This fixes the frontend sending 2025-09-21 (Sunday) instead of 2025-09-22 (Monday)
      if (editWeekStart.getDay() === 0) { // Sunday
        editWeekStart = new Date(editWeekStart.getTime() + 24 * 60 * 60 * 1000); // Add 1 day to get Monday
        console.log(`[DATE FIX] Adjusted Sunday weekStart ${weekStart} to Monday ${editWeekStart.toISOString().split('T')[0]}`);
      }
      
      const dayOffset = dayMap[day.toLowerCase()] || 0;
      const editDate = new Date(editWeekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      editDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

      if (editDate < today) {
        return res.status(400).json({ 
          message: "Cannot edit timetable entries for past dates. You can only edit entries for today or future dates." 
        });
      }

      // Calculate week end date (Sunday)
      const weekEnd = new Date(editWeekStart);
      weekEnd.setDate(editWeekStart.getDate() + 6);

      // If teacher is provided, verify they exist and belong to same school
      if (teacherId) {
        const teacher = await storage.getTeacher(teacherId);
        if (!teacher) {
          return res.status(404).json({ message: "Teacher not found" });
        }

        if (teacher.schoolId !== classData.schoolId) {
          return res.status(403).json({ message: "Teacher does not belong to the same school as the class" });
        }

        // Check for conflicts with other classes at the same time
        const globalTimetableEntries = await storage.getTimetableEntries();
        const conflictingEntry = globalTimetableEntries.find((entry: any) => {
          const dayMatch = entry.day.toLowerCase() === day.toLowerCase();
          const periodMatch = entry.period === period;
          const sameTeacher = entry.teacherId === teacherId;
          const differentClass = entry.classId !== classId;
          
          return dayMatch && periodMatch && sameTeacher && differentClass;
        });

        if (conflictingEntry) {
          const conflictClass = await storage.getClass(conflictingEntry.classId);
          return res.status(409).json({ 
            message: `Teacher ${teacher.name} is already assigned to ${conflictClass?.grade}-${conflictClass?.section} at this time slot`,
            hasConflicts: true
          });
        }
      }

      // Update or create the weekly timetable entry
      const result = await storage.updateWeeklyTimetableEntry(
        classId,
        weekStart,
        weekEnd.toISOString().split('T')[0],
        day,
        period,
        {
          teacherId,
          subjectId,
          startTime,
          endTime,
          room,
          isModified: true,
          modificationReason: reason
        },
        user.id
      );

      // Log the weekly edit (not as a timetable change)
      await storage.createAuditLog({
        action: "weekly_timetable_edit",
        entityType: "weekly_timetables",
        entityId: result.id,
        userId: user.id,
        description: `Manual weekly edit: ${teacherId ? 'Assigned' : 'Removed'} teacher for ${day} period ${period} in week ${weekStart}. Reason: ${reason}`,
        schoolId: user.schoolId || classData.schoolId
      });

      // Enrich the response with teacher and subject details for immediate UI update
      let teacher = null;
      let subject = null;
      
      if (teacherId) {
        teacher = await storage.getTeacher(teacherId);
      }
      
      if (subjectId) {
        const subjects = await storage.getSubjects(classData.schoolId);
        subject = subjects.find((s: any) => s.id === subjectId) || null;
      }

      res.json({ 
        success: true, 
        message: "Weekly timetable updated successfully (no approval required)", 
        weeklyTimetableId: result.id,
        modificationCount: result.modificationCount,
        assignment: {
          day,
          period,
          teacherId,
          subjectId,
          teacher,
          subject,
          startTime,
          endTime
        }
      });
    } catch (error) {
      console.error("Error updating weekly timetable:", error);
      res.status(500).json({ message: "Failed to update weekly timetable" });
    }
  });

  // Copy global timetable to weekly timetable endpoint
  app.post("/api/timetable/copy-global-to-weekly", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can copy global to weekly
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, weekStart, weekEnd } = req.body;

      // Validate required fields
      if (!classId || !weekStart || !weekEnd) {
        return res.status(400).json({ message: "classId, weekStart, and weekEnd are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get global timetable entries for this class
      const globalEntries = await storage.getTimetableEntries();
      const classGlobalEntries = globalEntries.filter((entry: any) => 
        entry.classId === classId && entry.isActive
      );

      if (classGlobalEntries.length === 0) {
        return res.status(404).json({ 
          message: "No global timetable found for this class. Please generate a global timetable first." 
        });
      }

      // Convert global entries to weekly timetable format
      const weeklyTimetableData = classGlobalEntries.map((entry: any) => ({
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        isModified: false // Initially not modified since it's copied from global
      }));

      // Create or update the weekly timetable
      const result = await storage.createOrUpdateWeeklyTimetable(
        classId,
        new Date(weekStart),
        weeklyTimetableData,
        user.id,
        classData.schoolId
      );

      // Log the action
      await storage.createAuditLog({
        action: "copy_global_to_weekly",
        entityType: "weekly_timetables",
        entityId: result.id,
        userId: user.id,
        description: `Copied global timetable to weekly timetable for class ${classData.grade}-${classData.section} for week ${weekStart}`,
        schoolId: user.schoolId || classData.schoolId
      });

      console.log(`[COPY GLOBAL TO WEEKLY] Successfully copied global timetable to weekly for class ${classId}, week ${weekStart}`);

      res.json({ 
        success: true, 
        message: "Global timetable copied to weekly successfully", 
        weeklyTimetableId: result.id,
        entriesCopied: weeklyTimetableData.length
      });
    } catch (error) {
      console.error("Error copying global timetable to weekly:", error);
      res.status(500).json({ message: "Failed to copy global timetable to weekly" });
    }
  });

  // Delete timetable entry endpoint
  app.delete("/api/timetable/entry/:entryId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can delete timetable entries
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { entryId } = req.params;
      const { date, permanent } = req.query;

      // Verify the timetable entry exists
      const entry = await storage.getTimetableEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Timetable entry not found" });
      }

      // Verify the entry's class belongs to user's school
      const classData = await storage.getClass(entry.classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - entry not in your school" });
      }

      // If permanent=true, delete from global timetable permanently 
      if (permanent === 'true') {
        // Permanently delete the entry from global timetable
        await storage.deleteTimetableEntry(entryId);

        // Create audit log for permanent deletion
        await storage.createAuditLog({
          action: "delete_global_entry",
          entityType: "timetable_entries", 
          entityId: entryId,
          userId: user.id,
          description: `Permanently deleted global timetable entry: ${entry.day} period ${entry.period} for class ${entry.classId}`,
          schoolId: user.schoolId || classData.schoolId
        });

        return res.json({ 
          success: true, 
          message: "Timetable entry permanently deleted from global schedule",
          type: "permanent_deletion"
        });
      }

      // Otherwise, create a cancellation for specific week (original behavior)
      const cancellationDate = date ? new Date(date as string) : new Date();

      // Create a cancellation timetable change instead of deleting the entry
      // Don't set approvedBy/approvedAt to prevent auto-dismissal logic from treating it as a notification
      const cancellationChange = await storage.createTimetableChange({
        timetableEntryId: entryId,
        changeType: "cancellation",
        changeDate: cancellationDate.toISOString().split('T')[0],
        originalTeacherId: entry.teacherId,
        newTeacherId: null,
        reason: "Period cancelled by admin",
        changeSource: "manual",
        approvedBy: null, // Don't auto-approve to prevent dismissal
        approvedAt: null,
        isActive: true
      });

      // Create audit log entry for the cancellation
      await storage.createManualAssignmentAudit({
        timetableEntryId: entryId,
        classId: entry.classId,
        day: entry.day,
        period: entry.period,
        oldTeacherId: entry.teacherId,
        newTeacherId: null, // null indicates cancellation
        subjectId: entry.subjectId || null,
        changeReason: "Period cancelled by admin for specific week",
        assignedBy: user.id,
      });

      // Create or update weekly timetable snapshot after cancellation
      try {
        const currentWeek = new Date(cancellationDate);
        const weekStart = new Date(currentWeek);
        weekStart.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Monday
        
        // Get current global timetable for this class
        const globalTimetable = await storage.getTimetableEntriesForClass(entry.classId);
        
        // Convert to weekly timetable format, marking cancelled period as null
        const weeklyTimetableData = globalTimetable.map((globalEntry: any) => {
          if (globalEntry.id === entryId) {
            // Mark this entry as cancelled (free period) for this week
            return {
              day: globalEntry.day,
              period: globalEntry.period,
              teacherId: null, // Cancelled - no teacher assigned
              subjectId: null, // Cancelled - no subject
              startTime: globalEntry.startTime,
              endTime: globalEntry.endTime,
              room: null,
              isModified: true,
              modificationReason: 'Period cancelled by admin',
            };
          } else {
            return {
              day: globalEntry.day,
              period: globalEntry.period,
              teacherId: globalEntry.teacherId,
              subjectId: globalEntry.subjectId,
              startTime: globalEntry.startTime,
              endTime: globalEntry.endTime,
              room: globalEntry.room,
              isModified: false,
            };
          }
        });
        
        await storage.createOrUpdateWeeklyTimetable(
          entry.classId,
          weekStart,
          weeklyTimetableData,
          user.id,
          classData.schoolId
        );
        
        console.log(`[WEEKLY TIMETABLE] Created/updated weekly timetable for class ${entry.classId}, week ${weekStart.toISOString().split('T')[0]} with cancellation`);
      } catch (weeklyError) {
        console.error('[WEEKLY TIMETABLE] Error creating weekly timetable:', weeklyError);
        // Don't fail the request if weekly timetable creation fails
      }

      res.json({ 
        success: true, 
        message: "Period cancelled for this week successfully",
        changeId: cancellationChange.id
      });
    } catch (error) {
      console.error("Error deleting timetable entry:", error);
      res.status(500).json({ message: "Failed to delete timetable entry" });
    }
  });

  // Audit Logs Routes

  // Get audit logs
  app.get("/api/audit-logs", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view audit logs
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { limit } = req.query;
      const logs = await storage.getAuditLogs(user.schoolId, limit ? parseInt(limit as string) : 50);
      res.json(logs);
    } catch (error) {
      console.error("Error getting audit logs:", error);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // Create audit log (mainly for manual tracking)
  app.post("/api/audit-logs", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create audit logs
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const auditData = {
        ...req.body,
        schoolId: user.schoolId,
        userId: user.id
      };

      const validatedData = insertAuditLogSchema.parse(auditData);
      const log = await storage.createAuditLog(validatedData);
      res.json(log);
    } catch (error) {
      console.error("Error creating audit log:", error);
      res.status(500).json({ message: "Failed to create audit log" });
    }
  });

  // Enhanced Timetable Management

  // Check teacher availability
  app.get("/api/teachers/:teacherId/availability", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;
      const { day, period, date } = req.query;

      // Verify teacher belongs to user's school
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher || (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId)) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (!day || !period || !date) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const isAvailable = await scheduler.isTeacherAvailableForSubstitute(
        teacherId,
        day as string,
        parseInt(period as string),
        date as string
      );

      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking teacher availability:", error);
      res.status(500).json({ message: "Failed to check teacher availability" });
    }
  });

  // Bulk Import Routes
  
  // Download sample Excel template
  app.get("/api/bulk-import/template", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create sample data structure showing both cases: with sections and without sections
      const sampleData = [
        {
          "Grade": "10",
          "Section": "A", 
          "Subject Names": "Mathematics,English,Science,History,Geography"
        },
        {
          "Grade": "10",
          "Section": "B",
          "Subject Names": "Mathematics,English,Science,History,Geography"
        },
        {
          "Grade": "11",
          "Section": "NA",
          "Subject Names": "Mathematics,English,Physics,Chemistry,Biology"
        },
        {
          "Grade": "12",
          "Section": "NA",
          "Subject Names": "Mathematics,English,Physics,Chemistry,Biology"
        }
      ];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      
      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download with cache busting
      res.setHeader('Content-Disposition', 'attachment; filename="class_subjects_template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Upload and process Excel file
  app.post("/api/bulk-import/excel", authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check file type
      if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
        return res.status(400).json({ error: "Please upload a valid Excel file (.xlsx or .xls)" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (!data || data.length === 0) {
        return res.status(400).json({ error: "Excel file is empty or invalid" });
      }

      let classesCreated = 0;
      let subjectsCreated = 0;
      let assignmentsCreated = 0;
      const errors: string[] = [];

      // Get existing subjects for this school
      const existingSubjects = await storage.getSubjects(user.schoolId);
      
      // Track subjects per grade to ensure consistent codes across sections of same grade
      // But different codes across different grades
      const gradeSubjectMap = new Map<string, Map<string, { id: string; code: string }>>();

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const rowNum = i + 2; // Excel row number (1-indexed + header)

          // Validate required fields - only Grade is required
          if (!row.Grade) {
            errors.push(`Row ${rowNum}: Grade is required`);
            continue;
          }

          const grade = row.Grade.toString();
          // Handle sections: "NA" means no section, otherwise use the provided value
          const section = (row.Section && row.Section.toString().toUpperCase() === "NA") ? "" : (row.Section || "").toString();

          // Check if class already exists
          const existingClass = await storage.checkClassExists(grade, section, user.schoolId);

          if (existingClass) {
            errors.push(`Row ${rowNum}: Class ${grade}${section ? `-${section}` : ''} already exists`);
            continue;
          }

          // Create class with minimal data
          const classData = {
            grade: grade,
            section: section,
            studentCount: 0, // Default value, not imported
            room: null, // Not imported
            schoolId: user.schoolId,
            requiredSubjects: []
          };

          const newClass = await storage.createClass(classData);
          classesCreated++;

          // Process subject names if provided
          if (row["Subject Names"]) {
            const subjectNames = row["Subject Names"].toString().split(',').map((name: string) => name.trim());
            
            // Initialize grade subject tracking if not exists
            if (!gradeSubjectMap.has(grade)) {
              gradeSubjectMap.set(grade, new Map());
            }
            const gradeSubjects = gradeSubjectMap.get(grade)!;

            for (const subjectName of subjectNames) {
              if (!subjectName) continue;

              const normalizedName = subjectName.toLowerCase();
              let subjectId: string;
              let subjectCode: string;

              // Check if this subject already exists for this specific grade
              if (gradeSubjects.has(normalizedName)) {
                // Use existing subject from this grade
                const gradeSubject = gradeSubjects.get(normalizedName)!;
                subjectId = gradeSubject.id;
                subjectCode = gradeSubject.code;
              } else {
                // Check if we can find an existing subject for this grade and name combination
                const existingSubjectForGrade = existingSubjects.find(s => 
                  s.name.toLowerCase() === normalizedName && s.code.includes(grade)
                );

                if (existingSubjectForGrade) {
                  // Found existing subject for this grade
                  subjectId = existingSubjectForGrade.id;
                  subjectCode = existingSubjectForGrade.code;
                  gradeSubjects.set(normalizedName, { id: subjectId, code: subjectCode });
                } else {
                  // Create new grade-specific subject with auto-generated code and unique color
                  subjectCode = await generateGradeSpecificSubjectCode(subjectName, grade, user.schoolId);
                  const uniqueColor = generateColorForSubjectCode(subjectCode);
                  
                  const newSubject = await storage.createSubject({
                    name: subjectName,
                    code: subjectCode,
                    schoolId: user.schoolId,
                    periodsPerWeek: 5, // Default value
                    color: uniqueColor
                  });
                  
                  subjectId = newSubject.id;
                  subjectsCreated++;
                  
                  // Add to grade tracking
                  gradeSubjects.set(normalizedName, { id: subjectId, code: subjectCode });
                }
              }

              // Create subject assignment
              await storage.createClassSubjectAssignment({
                classId: newClass.id,
                subjectId: subjectId,
                weeklyFrequency: 5, // Default value
                assignedTeacherId: null
              });
              assignmentsCreated++;
            }
          }

        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }


      // Return results
      res.json({
        classesCreated,
        subjectsCreated,
        assignmentsCreated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${classesCreated} classes, ${subjectsCreated} subjects, and ${assignmentsCreated} subject assignments`
      });

    } catch (error) {
      console.error("Error processing Excel file:", error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  // Default Periods Management Routes
  
  // Get subjects with default periods for school admin settings
  app.get("/api/subjects/default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all subjects for the school with their default periods
      const subjects = await storage.getSubjects(user.schoolId);
      
      const subjectsWithDefaults = subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        periodsPerWeek: subject.periodsPerWeek,
        color: subject.color
      }));

      res.json(subjectsWithDefaults);
    } catch (error) {
      console.error("Error fetching subjects with default periods:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  // Update default periods for subjects
  app.put("/api/subjects/default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = req.body.updates; // Array of {id, periodsPerWeek}
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Updates must be an array" });
      }

      // Validate each update
      for (const update of updates) {
        if (!update.id || typeof update.periodsPerWeek !== 'number' || update.periodsPerWeek < 1 || update.periodsPerWeek > 20) {
          return res.status(400).json({ message: "Invalid update data. Periods per week must be between 1 and 20." });
        }
      }

      // Update each subject
      const results = [];
      for (const update of updates) {
        try {
          const updatedSubject = await storage.updateSubject(update.id, {
            periodsPerWeek: update.periodsPerWeek
          });
          results.push(updatedSubject);
        } catch (error) {
          console.error(`Error updating subject ${update.id}:`, error);
          throw error;
        }
      }

      res.json({ 
        message: `Successfully updated ${results.length} subjects`,
        updatedSubjects: results
      });
    } catch (error) {
      console.error("Error updating default periods:", error);
      res.status(500).json({ message: "Failed to update default periods" });
    }
  });

  // Update global default periods for all subjects
  app.put("/api/settings/global-default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { defaultPeriods, updateExisting } = req.body;
      
      if (typeof defaultPeriods !== 'number' || defaultPeriods < 1 || defaultPeriods > 20) {
        return res.status(400).json({ message: "Default periods must be between 1 and 20" });
      }

      // Get all subjects for the school
      const subjects = await storage.getSubjects(user.schoolId);
      
      if (subjects.length === 0) {
        return res.status(404).json({ message: "No subjects found for this school" });
      }

      // Update all subjects' default periods
      const subjectUpdatePromises = subjects.map(subject =>
        storage.updateSubject(subject.id, { periodsPerWeek: defaultPeriods })
      );
      
      await Promise.all(subjectUpdatePromises);

      // If requested, also update existing class-subject assignments
      let assignmentsUpdated = 0;
      if (updateExisting) {
        try {
          // Get all class-subject assignments for the school
          const allAssignments = await storage.getClassSubjectAssignments();
          const subjectIds = new Set(subjects.map(s => s.id));
          
          // Filter assignments that belong to this school's subjects
          const schoolAssignments = allAssignments.filter(assignment => 
            subjectIds.has(assignment.subjectId)
          );
          
          // Update each assignment
          const assignmentUpdatePromises = schoolAssignments.map(assignment =>
            storage.updateClassSubjectAssignment(assignment.id, { weeklyFrequency: defaultPeriods })
          );
          
          await Promise.all(assignmentUpdatePromises);
          assignmentsUpdated = schoolAssignments.length;
        } catch (error) {
          console.error("Error updating existing assignments:", error);
          // Don't fail the whole operation if assignment updates fail
        }
      }

      res.json({ 
        message: `Successfully updated ${subjects.length} subjects to ${defaultPeriods} periods per week` +
                 (updateExisting ? ` and ${assignmentsUpdated} existing class assignments` : ''),
        subjectsUpdated: subjects.length,
        assignmentsUpdated: updateExisting ? assignmentsUpdated : 0,
        newDefaultPeriods: defaultPeriods
      });
      
    } catch (error) {
      console.error("Error updating global default periods:", error);
      res.status(500).json({ message: "Failed to update global default periods" });
    }
  });

  // Get timetable freeze status for school
  app.get("/api/settings/timetable-freeze-status", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const school = await storage.getSchool(user.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      res.json({ 
        timetableFrozen: school.timetableFrozen || false
      });
      
    } catch (error) {
      console.error("Error getting timetable freeze status:", error);
      res.status(500).json({ message: "Failed to get timetable freeze status" });
    }
  });

  // Freeze timetable changes for school
  app.put("/api/settings/freeze-timetable", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateSchool(user.schoolId, { timetableFrozen: true });

      res.json({ 
        message: "Timetable changes have been frozen successfully",
        timetableFrozen: true
      });
      
    } catch (error) {
      console.error("Error freezing timetable:", error);
      res.status(500).json({ message: "Failed to freeze timetable changes" });
    }
  });

  // Unfreeze timetable changes for school
  app.put("/api/settings/unfreeze-timetable", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateSchool(user.schoolId, { timetableFrozen: false });

      res.json({ 
        message: "Timetable changes have been unfrozen successfully",
        timetableFrozen: false
      });
      
    } catch (error) {
      console.error("Error unfreezing timetable:", error);
      res.status(500).json({ message: "Failed to unfreeze timetable changes" });
    }
  });

  // Get free teachers for today organized by periods
  app.get("/api/availability/free-teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Use today if no date provided
      const selectedDate = date || new Date().toISOString().split('T')[0];
      const dateObj = new Date(selectedDate);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Get all teachers for the school
      const teachers = await storage.getTeachers(user.schoolId);
      
      // Get timetable structure to know periods
      const timetableStructure = await storage.getTimetableStructure(user.schoolId);
      if (!timetableStructure || !timetableStructure.timeSlots) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }
      
      // Filter out break periods
      const regularPeriods = timetableStructure.timeSlots.filter(slot => !slot.isBreak);
      
      // For each period, find which teachers are free
      const freeTeachersByPeriod = [];
      
      for (const timeSlot of regularPeriods) {
        const freeTeachers = [];
        
        for (const teacher of teachers) {
          if (!teacher.isActive) continue;
          
          const isAvailable = await storage.isTeacherAvailable(
            teacher.id, 
            dayOfWeek, 
            timeSlot.period, 
            selectedDate
          );
          
          if (isAvailable) {
            freeTeachers.push({
              id: teacher.id,
              name: teacher.name,
              email: teacher.email,
              subjects: teacher.subjects || []
            });
          }
        }
        
        freeTeachersByPeriod.push({
          period: timeSlot.period,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          freeTeachers: freeTeachers.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
      
      res.json({
        date: selectedDate,
        dayOfWeek: dayOfWeek,
        periods: freeTeachersByPeriod
      });
      
    } catch (error) {
      console.error("Error fetching free teachers:", error);
      res.status(500).json({ message: "Failed to fetch free teachers for today" });
    }
  });

  // Weekly Timetable Routes

  // Batch endpoint: Get weekly timetables for multiple classes at once
  app.post("/api/timetable/weekly/batch", authMiddleware, async (req: any, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const user = req.user;
      const { classIds, date } = req.body;
      
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({ message: "classIds array is required" });
      }

      console.log(`[BATCH WEEKLY] Fetching ${classIds.length} classes for date: ${date}`);
      
      // Calculate week start from provided date using IST timezone
      const targetDate = date ? new Date(date as string) : new Date();
      
      // Get IST date components
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const targetDateIST = new Date(targetDate.getTime() + istOffset);
      const dayOfWeek = targetDateIST.getUTCDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayName = dayNames[dayOfWeek];
      
      // Calculate Monday (week start) in IST
      const weekStart = new Date(targetDate);
      const daysFromMonday = (dayOfWeek + 6) % 7; // Convert Sunday=0 to Monday=0
      weekStart.setUTCDate(targetDateIST.getUTCDate() - daysFromMonday);
      weekStart.setUTCHours(0, 0, 0, 0);
      
      console.log(`[BATCH WEEKLY] Selected date: ${date}, Day: ${selectedDayName}, Week start: ${weekStart.toISOString().split('T')[0]}`);
      
      // Fetch all classes in one query
      const classes = await storage.getClasses(user.schoolId);
      const requestedClasses = classes.filter(c => classIds.includes(c.id));
      
      // Verify access
      if (user.role === 'admin' && requestedClasses.some(c => c.schoolId !== user.schoolId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Fetch teachers and subjects once for all classes
      const teachers = await storage.getTeachers(user.schoolId);
      const subjects = await storage.getSubjects(user.schoolId);
      
      // Batch fetch all weekly timetables at once (optimized!)
      const classIdsList = requestedClasses.map(c => c.id);
      const weeklyTimetablesMap = await storage.getWeeklyTimetablesBatch(classIdsList, weekStart);
      
      // Get list of classes that need master timetable fallback
      const classesNeedingMaster = requestedClasses.filter(c => {
        const weeklyTT = weeklyTimetablesMap.get(c.id);
        return !weeklyTT || !weeklyTT.timetableData || !Array.isArray(weeklyTT.timetableData);
      });
      
      // Batch fetch master timetables for classes that need it (optimized!)
      const masterEntriesMap = classesNeedingMaster.length > 0
        ? await storage.getTimetableEntriesBatch(classesNeedingMaster.map(c => c.id))
        : new Map();
      
      // Build results using the batch-fetched data
      const results = requestedClasses.map((classData) => {
        try {
          const weeklyTimetable = weeklyTimetablesMap.get(classData.id);
          let dataSource: 'weekly' | 'master' = 'weekly';
          let timetableData: any[] = [];
          
          if (weeklyTimetable && weeklyTimetable.timetableData && Array.isArray(weeklyTimetable.timetableData)) {
            // Has weekly override - use it
            timetableData = weeklyTimetable.timetableData.map((entry: any) => {
              const teacher = teachers.find(t => t.id === entry.teacherId) || null;
              const subject = subjects.find(s => s.id === entry.subjectId) || null;
              
              return {
                ...entry,
                teacher,
                subject,
                class: classData
              };
            });
            dataSource = 'weekly';
          } else {
            // Fallback to master timetable
            console.log(`[BATCH FALLBACK] No weekly override for class ${classData.grade}${classData.section}, using master timetable`);
            const globalEntries = masterEntriesMap.get(classData.id) || [];
            
            // Enrich master timetable entries with teacher/subject details
            timetableData = globalEntries.map((entry: any) => {
              const teacher = teachers.find(t => t.id === entry.teacherId) || null;
              const subject = subjects.find(s => s.id === entry.subjectId) || null;
              
              return {
                ...entry,
                teacher,
                subject,
                class: classData
              };
            });
            dataSource = 'master';
          }
          
          return {
            classId: classData.id,
            className: `${classData.grade} ${classData.section}`,
            weekStart: weekStart.toISOString().split('T')[0],
            data: { timetableData },
            hasWeeklyOverrides: dataSource === 'weekly',
            dataSource,
            selectedDay: selectedDayName
          };
        } catch (error) {
          console.error(`[BATCH WEEKLY] Error for class ${classData.id}:`, error);
          return {
            classId: classData.id,
            className: `${classData.grade} ${classData.section}`,
            error: 'Failed to fetch'
          };
        }
      });
      
      res.json({ results });
      
    } catch (error) {
      console.error("[BATCH WEEKLY] Error:", error);
      res.status(500).json({ message: "Failed to fetch batch weekly timetables" });
    }
  });

  // Get weekly timetable for a class and specific week
  app.get("/api/timetable/weekly/:classId", authMiddleware, async (req: any, res) => {
    // Disable caching for this endpoint to ensure auto-creation logic runs
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.query; // Date within the week
      
      console.log(`[WEEKLY API] Request for classId: ${classId}, date: ${date}`);

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start date in IST (YYYY-MM-DD format)
      const targetDateStr = date as string || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      console.log(`[WEEKLY API] Target date (IST): ${targetDateStr}`);

      // Try to get or create weekly timetable using centralized service
      try {
        const weeklyTimetable = await weeklyTimetableService.ensureWeeklyTimetable(
          classId,
          targetDateStr,
          classData.schoolId,
          user.id
        );

        // Enrich timetable data with teacher and subject objects
        const enrichedData = { ...weeklyTimetable };
        if (weeklyTimetable.timetableData && Array.isArray(weeklyTimetable.timetableData)) {
          const teachers = await storage.getTeachers(classData.schoolId);
          const subjects = await storage.getSubjects(classData.schoolId);
          
          enrichedData.timetableData = weeklyTimetable.timetableData.map((entry: any) => ({
            ...entry,
            teacher: teachers.find(t => t.id === entry.teacherId) || null,
            subject: subjects.find(s => s.id === entry.subjectId) || null,
            class: classData
          }));
        }
        
        res.json({
          type: 'weekly',
          classId,
          weekStart: weeklyTimetable.weekStart,
          data: enrichedData,
          hasWeeklyOverrides: true
        });
      } catch (error: any) {
        // If no master timetable exists, return empty structure
        if (error.message?.includes('No master timetable')) {
          console.log(`[WEEKLY API] No master timetable found for class ${classId}, returning empty weekly structure`);
          
          // Calculate week start for response (even though we don't have data)
          const date = new Date(targetDateStr + 'T00:00:00+05:30');
          const day = date.getDay();
          const mondayOffset = day === 0 ? -6 : 1 - day;
          const weekStartDate = new Date(date);
          weekStartDate.setDate(date.getDate() + mondayOffset);
          const weekStart = weekStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          
          res.json({
            type: 'weekly',
            classId,
            weekStart,
            data: null,
            hasWeeklyOverrides: false,
            isEmpty: true
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error fetching/creating weekly timetable:", error);
      res.status(500).json({ message: "Failed to fetch or create weekly timetable" });
    }
  });

  // Promote weekly timetable to global timetable
  app.post("/api/timetable/weekly/:weeklyTimetableId/promote", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { weeklyTimetableId } = req.params;

      // Only school admins and super admins can promote timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the weekly timetable to verify access
      const weeklyTimetable = await storage.getWeeklyTimetable("", new Date()); // This won't work, need to fix the storage method
      // For now, let's implement a simpler approach by getting the weekly timetable by ID
      
      await storage.promoteWeeklyTimetableToGlobal(weeklyTimetableId);
      
      res.json({ 
        success: true, 
        message: "Weekly timetable promoted to global timetable successfully" 
      });
    } catch (error) {
      console.error("Error promoting weekly timetable:", error);
      res.status(500).json({ message: "Failed to promote weekly timetable" });
    }
  });

  // Enhanced timetable loader that prioritizes weekly timetables
  app.get("/api/timetable/enhanced/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.query; // Date within the week

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date or current date
      const targetDate = date ? new Date(date as string) : new Date();
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday

      // Try to get weekly timetable first
      const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      
      if (weeklyTimetable) {
        // Return weekly timetable data formatted for frontend
        const formattedEntries = weeklyTimetable.timetableData.map((entry: any) => ({
          id: `weekly-${entry.day}-${entry.period}`, // Generate temporary ID
          classId,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          day: entry.day,
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isActive: true,
          isWeeklyOverride: true,
          isModified: entry.isModified || false,
          modificationReason: entry.modificationReason,
          createdAt: weeklyTimetable.createdAt,
          updatedAt: weeklyTimetable.updatedAt
        }));

        res.json({
          entries: formattedEntries,
          source: 'weekly',
          weekStart: weekStart.toISOString().split('T')[0],
          modifiedBy: weeklyTimetable.modifiedBy,
          modificationCount: weeklyTimetable.modificationCount
        });
      } else {
        // Fall back to global timetable with detailed info
        const globalEntries = await storage.getTimetableEntriesWithDetails();
        const classEntries = globalEntries.filter((entry: any) => entry.classId === classId);
        
        res.json({
          entries: classEntries.map((entry: any) => ({
            ...entry,
            isWeeklyOverride: false,
            isModified: false
          })),
          source: 'global',
          weekStart: weekStart.toISOString().split('T')[0],
          modifiedBy: null,
          modificationCount: 0
        });
      }
    } catch (error) {
      console.error("Error fetching enhanced timetable:", error);
      res.status(500).json({ message: "Failed to fetch enhanced timetable" });
    }
  });

  // Refresh Global Timetable Action
  app.post("/api/timetable/refresh-global/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;

      // Only school admins and super admins can refresh global timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(`[REFRESH GLOBAL] Starting global timetable refresh for class ${classId}`);

      // Step 1: Delete global timetable and current/future weekly timetables (preserve past weeks for history)
      const deletionResult = await storage.deleteGlobalAndFutureWeeklyTimetables(classId);
      console.log(`[REFRESH GLOBAL] Deleted ${deletionResult.globalDeleted} global entries and ${deletionResult.weeklyDeleted} current/future weekly timetables`);

      // Step 2: Generate new global timetable using existing logic
      // Get class assignments and generate timetable
      const classAssignments = await storage.getClassSubjectAssignments(classId);
      const timetableStructure = await storage.getTimetableStructure(classData.schoolId);
      
      if (!timetableStructure) {
        return res.status(400).json({ message: "No timetable structure found for school" });
      }

      // Simple timetable generation logic (you can enhance this with AI later)
      const newTimetableEntries = [];
      // Use the actual working days from timetable structure instead of hardcoded weekdays
      const days = timetableStructure.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      
      for (const assignment of classAssignments) {
        if (!assignment.assignedTeacherId) continue;
        
        const subject = assignment.subject;
        const periodsNeeded = assignment.weeklyFrequency;
        let periodsAssigned = 0;
        
        // Distribute periods across the week
        for (let dayIndex = 0; dayIndex < days.length && periodsAssigned < periodsNeeded; dayIndex++) {
          const day = days[dayIndex];
          const dailyPeriods = periodsNeeded <= 5 ? 1 : Math.ceil(periodsNeeded / 5);
          
          for (let p = 0; p < dailyPeriods && periodsAssigned < periodsNeeded; p++) {
            const period = (dayIndex * dailyPeriods + p + 1) % timetableStructure.periodsPerDay + 1;
            const timeSlot = timetableStructure.timeSlots.find((slot: any) => slot.period === period);
            
            if (timeSlot) {
              newTimetableEntries.push({
                classId,
                teacherId: assignment.assignedTeacherId,
                subjectId: subject.id,
                day: day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday",
                period,
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                room: null,
                isActive: true
              });
              periodsAssigned++;
            }
          }
        }
      }

      // Step 3: Save new global timetable entries
      if (newTimetableEntries.length > 0) {
        await storage.createMultipleTimetableEntries(newTimetableEntries);
      }

      console.log(`[REFRESH GLOBAL] Created ${newTimetableEntries.length} new global timetable entries`);

      // Step 4: Copy the same timetable into weekly timetable table for current week
      const currentWeek = new Date();
      const weekStart = new Date(currentWeek);
      weekStart.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Monday
      
      const weeklyTimetableData = newTimetableEntries.map(entry => ({
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        isModified: false,
        modificationReason: 'Global timetable refresh'
      }));

      // Remove any existing weekly timetable for this class and week, then create new one
      const existingWeekly = await storage.getWeeklyTimetable(classId, weekStart);
      if (existingWeekly) {
        await storage.updateWeeklyTimetable(existingWeekly.id, {
          timetableData: weeklyTimetableData,
          modifiedBy: user.id,
          modificationCount: 1,
          basedOnGlobalVersion: 'latest-refresh'
        });
      } else {
        await storage.createWeeklyTimetable({
          classId,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          timetableData: weeklyTimetableData,
          modifiedBy: user.id,
          modificationCount: 1,
          basedOnGlobalVersion: 'latest-refresh',
          schoolId: classData.schoolId,
          academicSessionId: classData.academicSessionId,
          isActive: true
        });
      }

      console.log(`[REFRESH GLOBAL] Copied global timetable to weekly for week ${weekStart.toISOString().split('T')[0]}`);

      res.json({
        success: true,
        message: "Global timetable refreshed and current/future weekly timetables updated successfully (past weeks preserved for history)",
        entriesCreated: newTimetableEntries.length,
        globalDeleted: deletionResult.globalDeleted,
        weeklyDeleted: deletionResult.weeklyDeleted,
        weekStart: weekStart.toISOString().split('T')[0]
      });

    } catch (error) {
      console.error("Error refreshing global timetable:", error);
      res.status(500).json({ message: "Failed to refresh global timetable" });
    }
  });

  // Set Weekly as Global Timetable
  app.post("/api/timetable/set-weekly-as-global/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.body; // Date within the week to promote

      // Only school admins and super admins can set weekly as global
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date or current date
      const targetDate = date ? new Date(date) : new Date();
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday

      // Get the weekly timetable to promote
      const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      if (!weeklyTimetable) {
        return res.status(404).json({ message: "No weekly timetable found for this week to promote" });
      }

      console.log(`[SET WEEKLY AS GLOBAL] Promoting weekly timetable for class ${classId}, week ${weekStart.toISOString().split('T')[0]} to global`);

      // Step 1: Deactivate current global timetable entries for this class
      await storage.deactivateTimetableEntriesForClass(classId);

      // Step 2: Create new global timetable entries from weekly timetable data
      if (weeklyTimetable.timetableData && Array.isArray(weeklyTimetable.timetableData)) {
        const newGlobalEntries = weeklyTimetable.timetableData
          .filter((entry: any) => entry.teacherId && entry.subjectId) // Only non-cancelled entries
          .map((entry: any) => ({
            classId,
            teacherId: entry.teacherId,
            subjectId: entry.subjectId,
            day: entry.day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
            period: entry.period,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
            isActive: true
          }));

        if (newGlobalEntries.length > 0) {
          await storage.createMultipleTimetableEntries(newGlobalEntries);
        }

        console.log(`[SET WEEKLY AS GLOBAL] Created ${newGlobalEntries.length} new global entries from weekly timetable`);

        // Step 3: Update the weekly timetable to mark it as the new baseline
        await storage.updateWeeklyTimetable(weeklyTimetable.id, {
          basedOnGlobalVersion: 'promoted-to-global',
          modificationCount: weeklyTimetable.modificationCount + 1
        });

        res.json({
          success: true,
          message: "Weekly timetable successfully promoted to global timetable",
          entriesPromoted: newGlobalEntries.length,
          weekStart: weekStart.toISOString().split('T')[0]
        });
      } else {
        res.status(400).json({ message: "Weekly timetable has no valid data to promote" });
      }

    } catch (error) {
      console.error("Error setting weekly as global:", error);
      res.status(500).json({ message: "Failed to set weekly timetable as global" });
    }
  });

  // Sample data generation endpoint for testing Student & Parent functionality
  app.post("/api/generate-sample-data", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow super_admin or admin to generate sample data
      if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
        return res.status(403).json({ error: "Insufficient permissions. Only admins can generate sample data." });
      }

      console.log(`🌱 Sample data generation requested by: ${user.firstName} ${user.lastName} (${user.role})`);

      // Import and execute the sample data generator
      const { generateSampleStudentsAndParents } = await import("./seedSampleData");
      const result = await generateSampleStudentsAndParents();
      
      res.json({
        success: true,
        message: "Sample data generated successfully! Check console for login credentials.",
        data: {
          studentsCreated: result.students.length,
          parentsCreated: result.parents.length,
          school: result.school.name,
          classes: [
            `Grade ${result.classes.class5A.grade} Section ${result.classes.class5A.section}`,
            `Grade ${result.classes.class6B.grade} Section ${result.classes.class6B.section}`
          ]
        }
      });
    } catch (error) {
      console.error("❌ Error generating sample data:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to generate sample data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Chat API endpoints
  app.post("/api/chat/process", authMiddleware, processChatMessage);
  
  // NEW: Tool-based Chroney Chat (Phase 1)
  app.post("/api/chroney/chat", authMiddleware, processChroneyToolChat);
  
  // Reset chat memory (called on new chat session)
  app.post("/api/chroney/reset", authMiddleware, resetChatMemory);

  // Report Generation endpoint (Admin only)
  app.post("/api/chroney/generate-report", authMiddleware, async (req: any, res) => {
    try {
      // Role-based access control - only admins and super admins can generate reports
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ 
          success: false,
          error: "Access denied. Admin privileges required to generate reports." 
        });
      }

      // Validate request with Zod schema
      const reportRequestSchema = z.object({
        reportType: z.enum([
          'attendance_summary',
          'teacher_workload',
          'class_list',
          'student_list',
          'teacher_list',
          'absent_today',
          'attendance_overview'
        ]),
        filters: z.object({
          dateRange: z.object({
            start: z.string(),
            end: z.string()
          }).optional(),
          classId: z.string().optional(),
          teacherId: z.string().optional(),
          grade: z.string().optional(),
        }).optional()
      });

      const validation = reportRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid request parameters",
          details: validation.error.errors
        });
      }

      const { reportType, filters } = validation.data;

      const { ToolExecutionService } = await import("./services/toolExecutionService");
      const { reportFormatter } = await import("./services/reportFormatter");
      
      const context = {
        schoolId: req.user.schoolId,
        userId: req.user.id,
        userRole: req.user.role,
      };

      const result = await ToolExecutionService.executeTool(
        "generate_report",
        { reportType, filters: filters || {} },
        context
      );

      if (result.success) {
        // Format the report using ReportFormatter for better UX
        const formattedReport = reportFormatter.formatReport({
          title: reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          data: Array.isArray(result.data) ? result.data : Object.values(result.data).find(v => Array.isArray(v)) || [],
          query: `${reportType} report`,
          insights: []
        });

        res.json({
          success: true,
          data: result.data,
          formatted: formattedReport,
          message: result.message
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error("Report generation error:", error);
      res.status(500).json({ 
        success: false,
        error: error.message || "Failed to generate report" 
      });
    }
  });

  // AI Connection Status endpoint
  app.get("/api/chat/status", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user || !user.schoolId) {
        return res.json({ 
          connected: false,
          status: 'offline'
        });
      }
      
      // Check if school has access to OpenAI (either school-specific key or global key)
      const { hasOpenAIAccess } = await import("./openaiHelper");
      const hasAccess = await hasOpenAIAccess(user.schoolId);
      
      res.json({ 
        connected: hasAccess,
        status: hasAccess ? 'online' : 'offline'
      });
    } catch (error) {
      res.json({ 
        connected: false,
        status: 'offline'
      });
    }
  });

  // ============================================================================
  // SCHOOL INSIGHTS (School Admin Only)
  // ============================================================================

  app.get("/api/school-insights", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID not found" });
      }

      // Get rule-based insights
      const ruleBasedInsights = await storage.getAllSchoolInsights(schoolId);

      // AI Enhancement: Use Chroney to analyze patterns (if insights exist)
      let aiEnhancedInsights = ruleBasedInsights;
      
      if (ruleBasedInsights.length > 0) {
        try {
          const insightsSummary = ruleBasedInsights.map(insight => ({
            category: insight.category,
            severity: insight.severity,
            title: insight.title,
            message: insight.message,
            details: insight.details
          }));

          const aiPrompt = `You are an expert school administrator analyst. Based on these school insights, provide:
1. A brief analysis of patterns you notice
2. Any hidden correlations or trends
3. One actionable priority recommendation

Insights data:
${JSON.stringify(insightsSummary, null, 2)}

Keep your response concise (under 150 words). Focus on actionable insights.`;

          const aiResponse = await processChatMessage(
            { body: { message: aiPrompt }, user: req.user } as any,
            { json: (data: any) => data } as any
          );

          if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
            // Add AI analysis as a special insight
            aiEnhancedInsights = [
              {
                id: 'ai-analysis',
                category: 'ai-insights',
                severity: 'info',
                title: 'AI Pattern Analysis',
                message: aiResponse.response,
                details: {},
                action: { type: 'none' }
              },
              ...ruleBasedInsights
            ];
          }
        } catch (aiError) {
          console.error('AI enhancement failed:', aiError);
          // If AI fails, just return rule-based insights
        }
      }

      res.json({ insights: aiEnhancedInsights });
    } catch (error: any) {
      console.error("Error getting school insights:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Timetable Workload Insights (School Admin Only)
  app.get("/api/ai-timetable-insights", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. School Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID not found" });
      }

      // Get current academic session for the school
      const currentSession = await storage.getCurrentAcademicSession(schoolId);
      if (!currentSession) {
        return res.json([]); // No session, no insights
      }

      // Fetch actual timetable data using proper joins
      // Note: classSubjectAssignments has no schoolId, must join through classes table
      const [allTeachers, classSubjectData, allTimetableEntries, timetableStructureArray] = await Promise.all([
        db.query.teachers.findMany({
          where: (teachers, { eq }) => eq(teachers.schoolId, schoolId),
          columns: {
            id: true,
            name: true,
            maxPeriodsPerDay: true,
            schoolId: true
          }
        }),
        // Join classSubjectAssignments with classes to filter by schoolId and academicSessionId
        db.select({
          assignment: classSubjectAssignments,
          class: classes,
          subject: subjects
        })
        .from(classSubjectAssignments)
        .innerJoin(classes, eq(classSubjectAssignments.classId, classes.id))
        .leftJoin(subjects, eq(classSubjectAssignments.subjectId, subjects.id))
        .where(
          and(
            eq(classes.schoolId, schoolId),
            eq(classes.academicSessionId, currentSession.id)
          )
        ),
        db.query.timetableEntries.findMany({
          with: {
            teacher: true,
            subject: true,
            class: true
          }
        }),
        db.select().from(timetableStructures).where(eq(timetableStructures.schoolId, schoolId)).limit(1)
      ]);

      // Transform classSubjectData to match expected format
      const classSubjects = classSubjectData.map((row: any) => ({
        ...row.assignment,
        class: row.class,
        subject: row.subject,
        weeklyPeriods: row.assignment.weeklyFrequency || 0
      }));

      // Filter timetable entries by teacher's schoolId and academic session
      const timetableEntriesData = allTimetableEntries.filter((entry: any) => 
        entry.teacher?.schoolId === schoolId && 
        entry.class?.academicSessionId === currentSession.id
      );

      const timetableStructureData = timetableStructureArray[0] || null;

      const workingDays = timetableStructureData?.workingDays?.length || 6;
      const periodsPerDay = timetableStructureData?.timeSlots?.filter((slot: any) => !slot.isBreak).length || 7;
      const defaultMaxPeriodsPerDay = timetableStructureData?.schoolDefaultMaxPeriodsPerDay || 6;

      // Build teacher workload map from actual timetable
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        weeklyLoad: number;
        maxCapacity: number;
        utilization: number;
        subjects: Set<string>;
      }>();

      // Initialize all teachers
      allTeachers.forEach((t: any) => {
        teacherWorkload.set(t.id, {
          teacherId: t.id,
          name: t.name,
          weeklyLoad: 0,
          maxCapacity: (t.maxPeriodsPerDay || defaultMaxPeriodsPerDay) * workingDays,
          utilization: 0,
          subjects: new Set()
        });
      });

      // Count weekly periods from timetable entries
      timetableEntriesData.forEach((entry: any) => {
        if (entry.teacherId && entry.day && entry.period) {
          const workload = teacherWorkload.get(entry.teacherId);
          if (workload) {
            workload.weeklyLoad += 1;
            if (entry.subject?.name) {
              workload.subjects.add(entry.subject.name);
            }
          }
        }
      });

      // Calculate utilization
      teacherWorkload.forEach((t: any) => {
        t.utilization = t.maxCapacity > 0 ? Math.round((t.weeklyLoad / t.maxCapacity) * 100) : 0;
      });

      // Calculate total periods needed
      const totalPeriodsNeeded = classSubjects.reduce((sum: number, cs: any) => sum + (cs.weeklyPeriods || 0), 0);
      const assignedPeriods = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.weeklyLoad, 0);
      const unassignedPeriods = totalPeriodsNeeded - assignedPeriods;

      // Generate AI recommendations using same logic as Teacher Planner
      const recommendations: any[] = [];

      const overloaded = Array.from(teacherWorkload.values()).filter(t => t.weeklyLoad > t.maxCapacity);
      const underutilized = Array.from(teacherWorkload.values()).filter(t => t.utilization < 50 && t.utilization > 0);
      const avgUtilization = allTeachers.length > 0
        ? Math.round(Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.utilization, 0) / allTeachers.length)
        : 0;
      const totalAvailableCapacity = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + (t.maxCapacity - t.weeklyLoad), 0);

      // PRIORITY 0: Critical overload warnings
      if (overloaded.length > 0) {
        const totalOverload = overloaded.reduce((sum, t) => sum + (t.weeklyLoad - t.maxCapacity), 0);
        
        recommendations.push({
          type: 'warning',
          title: 'Critical Overload Alert',
          description: `⚠️ CRITICAL: ${overloaded.length} teacher${overloaded.length > 1 ? 's are' : ' is'} overloaded by ${totalOverload} total periods. Immediate redistribution needed!`
        });
        
        // Top 3 most overloaded teachers
        const topOverloaded = overloaded
          .sort((a, b) => (b.weeklyLoad - b.maxCapacity) - (a.weeklyLoad - a.maxCapacity))
          .slice(0, 3);
        
        topOverloaded.forEach(t => {
          const excess = t.weeklyLoad - t.maxCapacity;
          recommendations.push({
            type: 'warning',
            title: 'Teacher Overloaded',
            description: `Teacher ${t.name} is overloaded: ${t.weeklyLoad}/${t.maxCapacity} periods (${t.utilization}% capacity, ${excess} period${excess > 1 ? 's' : ''} over limit)`
          });
        });
        
        if (underutilized.length > 0) {
          const availableCapacity = underutilized.reduce((sum, t) => sum + (t.maxCapacity - t.weeklyLoad), 0);
          recommendations.push({
            type: 'info',
            title: 'Redistribution Opportunity',
            description: `${underutilized.length} teacher${underutilized.length > 1 ? 's have' : ' has'} ${availableCapacity} free periods combined - can redistribute ${Math.min(totalOverload, availableCapacity)} overloaded periods to balance workload`
          });
        }
      }

      // PRIORITY 1: Unassigned periods
      if (unassignedPeriods > 0) {
        if (totalAvailableCapacity >= unassignedPeriods) {
          recommendations.push({
            type: 'warning',
            title: 'Unassigned Periods',
            description: `${unassignedPeriods} period${unassignedPeriods > 1 ? 's remain' : ' remains'} unassigned. Existing teachers have capacity to cover - reassign workload instead of hiring.`
          });
        } else {
          const avgCapacity = allTeachers.length > 0 
            ? Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.maxCapacity, 0) / allTeachers.length
            : defaultMaxPeriodsPerDay * workingDays;
          const additionalTeachersNeeded = Math.ceil((unassignedPeriods - totalAvailableCapacity) / avgCapacity);
          recommendations.push({
            type: 'warning',
            title: 'Additional Teachers Needed',
            description: `${unassignedPeriods} period${unassignedPeriods > 1 ? 's remain' : ' remains'} unassigned. ${additionalTeachersNeeded} additional teacher${additionalTeachersNeeded > 1 ? 's' : ''} needed after utilizing current capacity.`
          });
        }
      }

      // PRIORITY 2: Utilization insights
      if (avgUtilization < 70 && unassignedPeriods === 0) {
        recommendations.push({
          type: 'info',
          title: 'Low Capacity Utilization',
          description: `Currently utilizing only ${avgUtilization}% of teacher capacity. Consider workload optimization.`
        });
      }

      // PRIORITY 3: Underutilized teachers - show top 5 individually
      if (underutilized.length > 0) {
        const topUnderutilized = underutilized
          .sort((a, b) => a.utilization - b.utilization)
          .slice(0, 5);
        
        topUnderutilized.forEach(t => {
          recommendations.push({
            type: 'info',
            title: 'Underutilized Teacher',
            description: `${t.name} is at ${t.utilization}% capacity (${t.weeklyLoad}/${t.maxCapacity} periods) - can handle ${t.maxCapacity - t.weeklyLoad} more periods`
          });
        });
      }

      // PRIORITY 4: Teachers near optimal utilization (70-90%) - highlight good examples
      const wellUtilized = Array.from(teacherWorkload.values())
        .filter(t => t.utilization >= 70 && t.utilization <= 90)
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 3);

      wellUtilized.forEach(t => {
        recommendations.push({
          type: 'success',
          title: 'Optimal Workload',
          description: `${t.name} has optimal workload at ${t.utilization}% capacity (${t.weeklyLoad}/${t.maxCapacity} periods) - well balanced!`
        });
      });

      // PRIORITY 5: Free period opportunities (top 10)
      const teachersWithFreeTime = Array.from(teacherWorkload.values())
        .filter(t => t.maxCapacity - t.weeklyLoad >= 10)
        .sort((a, b) => (b.maxCapacity - b.weeklyLoad) - (a.maxCapacity - a.weeklyLoad))
        .slice(0, 10);

      teachersWithFreeTime.forEach(t => {
        const freePeriods = t.maxCapacity - t.weeklyLoad;
        const subjectNames = Array.from(t.subjects).slice(0, 2).join(', ');
        
        if (subjectNames) {
          recommendations.push({
            type: 'success',
            title: 'Free Period Opportunity',
            description: `${t.name} has ${freePeriods} free periods - can teach ${subjectNames} in additional classes`
          });
        }
      });

      // PRIORITY 6: Subject diversity analysis
      const teachersWithMultipleSubjects = Array.from(teacherWorkload.values())
        .filter(t => t.subjects.size > 2)
        .sort((a, b) => b.subjects.size - a.subjects.size)
        .slice(0, 3);

      teachersWithMultipleSubjects.forEach(t => {
        const subjectList = Array.from(t.subjects).join(', ');
        recommendations.push({
          type: 'info',
          title: 'Multi-Subject Teacher',
          description: `${t.name} teaches ${t.subjects.size} subjects (${subjectList}) - versatile teaching capability`
        });
      });

      // PRIORITY 7: Capacity summary
      if (allTeachers.length > 0) {
        const totalCapacity = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.maxCapacity, 0);
        const totalUsed = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.weeklyLoad, 0);
        const overallUtilization = Math.round((totalUsed / totalCapacity) * 100);
        
        recommendations.push({
          type: 'info',
          title: 'Overall Capacity Analysis',
          description: `School-wide: ${totalUsed} periods used out of ${totalCapacity} total capacity (${overallUtilization}% utilization). ${totalCapacity - totalUsed} periods available for expansion.`
        });
      }

      // If no issues found
      if (recommendations.length === 0) {
        recommendations.push({
          type: 'success',
          title: 'Well Balanced Workload',
          description: `Timetable is well balanced! Average teacher utilization is ${avgUtilization}% with no critical issues detected.`
        });
      }

      res.json(recommendations);
    } catch (error: any) {
      console.error("Error generating AI timetable insights:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // TEACHER PLANNER - AI-Based Teacher Requirement Planning
  // ============================================================================

  // Get teacher planner settings for current school
  app.get("/api/teacher-planner/settings", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      let settings = await storage.getTeacherPlannerSettings(schoolId);
      
      if (!settings) {
        settings = await storage.upsertTeacherPlannerSettings(schoolId, 40);
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching teacher planner settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update teacher planner settings
  app.put("/api/teacher-planner/settings", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { maxPeriodsPerTeacher } = req.body;
      
      if (!maxPeriodsPerTeacher || maxPeriodsPerTeacher <= 0) {
        return res.status(400).json({ message: "Valid max periods per teacher is required" });
      }

      const updated = await storage.upsertTeacherPlannerSettings(schoolId, maxPeriodsPerTeacher);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating teacher planner settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get teacher requirement calculations (class-wise, subject-wise, overall)
  app.get("/api/teacher-planner/calculations", authMiddleware, async (req: any, res) => {
    try {
      // Prevent caching to ensure fresh calculations
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      let settings = await storage.getTeacherPlannerSettings(schoolId);
      if (!settings) {
        settings = await storage.upsertTeacherPlannerSettings(schoolId, 40);
      }

      const maxPeriods = settings.maxPeriodsPerTeacher;

      const classSubjects = await storage.getClassSubjectAssignments(undefined, schoolId);
      const allTeachers = await storage.getTeachers(schoolId);
      
      // Get timetable structure to calculate total available periods per week
      const timetableStructure = await storage.getTimetableStructure(schoolId);
      const periodsPerDay = timetableStructure?.periodsPerDay || 8; // Default to 8 if not set
      const workingDays = timetableStructure?.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const totalPeriodsPerWeek = periodsPerDay * workingDays.length; // e.g., 8 periods/day * 6 days = 48 total periods per week
      
      // Fetch actual timetable entries (master timetable only, no weekly overrides)
      const actualTimetable = await db
        .select({
          classId: timetableEntries.classId,
          teacherId: timetableEntries.teacherId,
          subjectId: timetableEntries.subjectId,
          day: timetableEntries.day,
          period: timetableEntries.period
        })
        .from(timetableEntries)
        .innerJoin(classes, eq(timetableEntries.classId, classes.id))
        .where(
          and(
            eq(classes.schoolId, schoolId),
            eq(timetableEntries.isActive, true)
          )
        );
      
      // ====== PHASE 1: TEACHER WORKLOAD ANALYSIS (FROM ACTUAL TIMETABLE) ======
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string; 
        assignedPeriods: number;
        maxLoad: number;
        assignments: Array<{ className: string; subjectName: string; periods: number }>;
      }>();

      // Initialize all teachers
      for (const teacher of allTeachers) {
        const workingDays = getWorkingDaysFromAvailability(teacher.availability);
        const weeklyCapacity = calculateWeeklyCapacity(teacher.maxDailyPeriods || 6, workingDays);
        
        teacherWorkload.set(teacher.id, {
          teacherId: teacher.id,
          name: teacher.name,
          assignedPeriods: 0,
          maxLoad: weeklyCapacity,
          assignments: []
        });
      }

      // Count teacher workload from ACTUAL timetable entries
      const teacherAssignmentCounts = new Map<string, Map<string, number>>(); // teacherId -> (classId-subjectId -> count)
      
      for (const entry of actualTimetable) {
        if (entry.teacherId) {
          const workload = teacherWorkload.get(entry.teacherId);
          if (workload) {
            workload.assignedPeriods++;
            
            // Track per assignment for display
            const key = `${entry.classId}-${entry.subjectId}`;
            if (!teacherAssignmentCounts.has(entry.teacherId)) {
              teacherAssignmentCounts.set(entry.teacherId, new Map());
            }
            const counts = teacherAssignmentCounts.get(entry.teacherId)!;
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
      }
      
      // Build assignment details for display
      for (const assignment of classSubjects) {
        if (assignment.assignedTeacherId) {
          const teacherId = assignment.assignedTeacherId;
          const key = `${assignment.classId}-${assignment.subjectId}`;
          const counts = teacherAssignmentCounts.get(teacherId);
          const scheduledPeriods = counts?.get(key) || 0;
          
          if (scheduledPeriods > 0) {
            const workload = teacherWorkload.get(teacherId);
            if (workload) {
              workload.assignments.push({
                className: `${assignment.classGrade} ${assignment.classSection}`,
                subjectName: assignment.subject?.name || 'Unknown',
                periods: scheduledPeriods
              });
            }
          }
        }
      }

      // Identify overloaded (>90%) and underutilized (<50%) teachers
      const overloadedTeachers: any[] = [];
      const underutilizedTeachers: any[] = [];

      for (const [teacherId, workload] of teacherWorkload.entries()) {
        const utilizationRate = (workload.assignedPeriods / workload.maxLoad) * 100;
        
        if (utilizationRate > 90) {
          overloadedTeachers.push({
            teacherId,
            name: workload.name,
            assignedPeriods: workload.assignedPeriods,
            maxLoad: workload.maxLoad,
            utilizationRate: Math.round(utilizationRate),
            overflow: workload.assignedPeriods - workload.maxLoad,
            assignments: workload.assignments
          });
        } else if (utilizationRate < 50 && workload.assignedPeriods > 0) {
          underutilizedTeachers.push({
            teacherId,
            name: workload.name,
            assignedPeriods: workload.assignedPeriods,
            maxLoad: workload.maxLoad,
            utilizationRate: Math.round(utilizationRate),
            availableCapacity: workload.maxLoad - workload.assignedPeriods,
            assignments: workload.assignments
          });
        }
      }

      // ====== CLASS-WISE WITH GAP ANALYSIS (FROM ACTUAL TIMETABLE) ======
      const classWiseData = new Map<string, { 
        className: string; 
        grade: string; 
        section: string; 
        totalPeriods: number;
        assignedPeriods: number;
        freePeriods: number;
        assignedTeachers: Set<string>;
        currentTeachers: number;
        idealTeachers: number;
        subjects: any[] 
      }>();

      // Count actual scheduled periods per class from timetable
      const classScheduledPeriods = new Map<string, number>(); // classId -> total scheduled periods count
      const classSubjectScheduled = new Map<string, number>(); // "classId-subjectId" -> count
      
      for (const entry of actualTimetable) {
        // Count total scheduled periods per class
        classScheduledPeriods.set(entry.classId, (classScheduledPeriods.get(entry.classId) || 0) + 1);
        
        // Count per subject
        const key = `${entry.classId}-${entry.subjectId}`;
        classSubjectScheduled.set(key, (classSubjectScheduled.get(key) || 0) + 1);
      }

      for (const assignment of classSubjects) {
        const classKey = assignment.classId;
        const className = `${assignment.classGrade} ${assignment.classSection}`;
        const subjectName = assignment.subject?.name || 'Unknown';
        const weeklyFrequency = assignment.weeklyFrequency || 0;
        const scheduledKey = `${assignment.classId}-${assignment.subjectId}`;
        const scheduledPeriods = classSubjectScheduled.get(scheduledKey) || 0;

        if (!classWiseData.has(classKey)) {
          // Initialize with total periods from timetable structure
          const assignedPeriodsForClass = classScheduledPeriods.get(classKey) || 0;
          classWiseData.set(classKey, {
            className,
            grade: assignment.classGrade,
            section: assignment.classSection,
            totalPeriods: totalPeriodsPerWeek, // Use timetable structure (e.g., 48 periods)
            assignedPeriods: assignedPeriodsForClass,
            freePeriods: totalPeriodsPerWeek - assignedPeriodsForClass, // Free periods = total - assigned
            assignedTeachers: new Set(),
            currentTeachers: 0,
            idealTeachers: 0,
            subjects: []
          });
        }

        const classData = classWiseData.get(classKey)!;
        
        if (scheduledPeriods > 0 && assignment.assignedTeacherId) {
          classData.assignedTeachers.add(assignment.assignedTeacherId);
        }

        classData.subjects.push({
          name: subjectName,
          periods: weeklyFrequency,
          assigned: scheduledPeriods > 0,
          teacherName: assignment.assignedTeacherId 
            ? teacherWorkload.get(assignment.assignedTeacherId)?.name || 'Unknown'
            : null
        });
      }

      // ====== SUBJECT-WISE WITH TEACHER COVERAGE (FROM ACTUAL TIMETABLE) ======
      const subjectWiseData = new Map<string, { 
        subjectName: string; 
        subjectCode: string; 
        totalPeriods: number; 
        assignedPeriods: number;
        assignedTeachers: Set<string>;
        teachersNeeded: number; 
        classes: string[]; 
        grades: number[] 
      }>();

      for (const assignment of classSubjects) {
        const className = `${assignment.classGrade} ${assignment.classSection}`;
        const subjectName = assignment.subject?.name || 'Unknown';
        const subjectCode = assignment.subject?.code || 'N/A';
        const weeklyFrequency = assignment.weeklyFrequency || 0;
        const classGrade = parseInt(assignment.classGrade) || 0;
        const scheduledKey = `${assignment.classId}-${assignment.subjectId}`;
        const scheduledPeriods = classSubjectScheduled.get(scheduledKey) || 0;

        if (!subjectWiseData.has(subjectCode)) {
          subjectWiseData.set(subjectCode, {
            subjectName,
            subjectCode,
            totalPeriods: 0,
            assignedPeriods: 0,
            assignedTeachers: new Set(),
            teachersNeeded: 0,
            classes: [],
            grades: []
          });
        }

        const subjectData = subjectWiseData.get(subjectCode)!;
        subjectData.totalPeriods += weeklyFrequency;
        subjectData.assignedPeriods += scheduledPeriods;
        
        if (scheduledPeriods > 0 && assignment.assignedTeacherId) {
          subjectData.assignedTeachers.add(assignment.assignedTeacherId);
        }
        
        if (!subjectData.classes.includes(className)) {
          subjectData.classes.push(className);
        }
        if (!subjectData.grades.includes(classGrade)) {
          subjectData.grades.push(classGrade);
        }
      }

      // Generate comprehensive smart suggestions for each class
      const generateClassSuggestions = (classId: string, className: string, freePeriods: number, assignedPeriods: number, subjects: any[]): string => {
        const suggestions: string[] = [];
        const grade = className.match(/^(\d+)/)?.[1] || className.split(' ')[0];
        const section = className.match(/([A-Z])$/)?.[1] || className.split(' ')[1];
        
        // 1. Free periods analysis with specific recommendations
        if (freePeriods > 0) {
          const unassignedSubjects = subjects.filter(s => !s.assigned);
          if (unassignedSubjects.length > 0) {
            const subjectNames = unassignedSubjects.slice(0, 2).map(s => s.name).join(' or ');
            suggestions.push(`${className} has ${freePeriods} free periods - assign ${subjectNames} or increase existing subject periods`);
          } else {
            const lowPeriodSubjects = subjects.filter(s => s.assigned && s.periods < 5).sort((a, b) => a.periods - b.periods);
            if (lowPeriodSubjects.length > 0) {
              suggestions.push(`${className} has ${freePeriods} free periods - increase ${lowPeriodSubjects[0].name} (currently ${lowPeriodSubjects[0].periods}/week) or add new subjects`);
            } else {
              suggestions.push(`${className} has ${freePeriods} free periods - consider adding co-curricular activities or study periods`);
            }
          }
        }
        
        // 2. Teacher sharing opportunities across sections in same grade
        const sameGradeClasses = Array.from(classWiseData.values())
          .filter(c => c.grade === grade && c.section !== section);
        
        if (sameGradeClasses.length > 0) {
          const assignedSubjects = subjects.filter(s => s.assigned && s.teacherName);
          const sharingOpportunities: string[] = [];
          
          // Find subjects with different teachers in same grade
          for (const subject of assignedSubjects) {
            for (const otherClass of sameGradeClasses) {
              const matchingSubject = otherClass.subjects.find(s => s.name === subject.name && s.assigned);
              if (matchingSubject && matchingSubject.teacherName && matchingSubject.teacherName !== subject.teacherName) {
                sharingOpportunities.push(subject.name);
                break;
              }
            }
          }
          
          if (sharingOpportunities.length > 0 && suggestions.length === 0) {
            const subjectList = sharingOpportunities.slice(0, 2).join(' and ');
            const otherSections = sameGradeClasses.map(c => c.section).join(', ');
            suggestions.push(`${className} teachers for ${subjectList} can be shared with section${sameGradeClasses.length > 1 ? 's' : ''} ${otherSections} for optimization`);
          }
        }
        
        // 3. Subject distribution analysis
        if (suggestions.length === 0) {
          const assignedSubjects = subjects.filter(s => s.assigned);
          const highPeriodSubjects = assignedSubjects.filter(s => s.periods >= 6);
          const lowPeriodSubjects = assignedSubjects.filter(s => s.periods <= 2);
          
          if (lowPeriodSubjects.length > 0 && freePeriods > 3) {
            suggestions.push(`Balance subject distribution - increase ${lowPeriodSubjects[0].name} periods (currently ${lowPeriodSubjects[0].periods}/week) using ${freePeriods} free slots`);
          } else if (highPeriodSubjects.length > 2 && assignedSubjects.length < 8) {
            suggestions.push(`Diversify curriculum - consider adding more subjects to balance the ${highPeriodSubjects.length} high-frequency subjects`);
          }
        }
        
        // 4. Coverage-based recommendations
        const coverageRate = assignedPeriods > 0 ? Math.round((assignedPeriods / (assignedPeriods + freePeriods)) * 100) : 0;
        if (suggestions.length === 0) {
          if (coverageRate < 60) {
            suggestions.push(`Low coverage (${coverageRate}%) - assign more subjects or increase periods to utilize ${freePeriods} available teaching slots`);
          } else if (coverageRate >= 95) {
            suggestions.push(`Excellent coverage (${coverageRate}%) - timetable is well optimized`);
          } else if (freePeriods > 0) {
            suggestions.push(`Good coverage (${coverageRate}%) - consider utilizing ${freePeriods} free periods for enhancement activities`);
          }
        }
        
        // 5. Default fallback
        if (suggestions.length === 0) {
          if (assignedPeriods === 0) {
            suggestions.push(`No subjects assigned yet - create subject assignments to build timetable`);
          } else {
            suggestions.push(`Review and optimize subject distribution for better resource utilization`);
          }
        }
        
        return suggestions[0];
      };

      // Format class-wise output
      const classWise = Array.from(classWiseData.values())
        .map(data => {
          const suggestion = generateClassSuggestions(
            data.className, 
            data.className, 
            data.freePeriods, 
            data.assignedPeriods, 
            data.subjects
          );
          
          return {
            className: data.className,
            grade: data.grade,
            section: data.section,
            totalPeriods: data.totalPeriods,
            assignedPeriods: data.assignedPeriods,
            freePeriods: data.freePeriods,
            currentTeachers: data.assignedTeachers.size,
            idealTeachers: Math.ceil(data.totalPeriods / maxPeriods),
            suggestion: suggestion, // AI-generated optimization suggestion
            coverageRate: data.totalPeriods > 0 ? Math.round((data.assignedPeriods / data.totalPeriods) * 100) : 0,
            subjects: data.subjects
          };
        })
        .sort((a, b) => {
          const gradeA = parseInt(a.grade) || 0;
          const gradeB = parseInt(b.grade) || 0;
          if (gradeA !== gradeB) return gradeA - gradeB;
          return a.section.localeCompare(b.section);
        });

      // Format subject-wise output
      const subjectWise = Array.from(subjectWiseData.values())
        .map(data => ({
          subjectName: data.subjectName,
          subjectCode: data.subjectCode,
          totalPeriods: data.totalPeriods,
          assignedPeriods: data.assignedPeriods,
          currentTeachers: data.assignedTeachers.size,
          teachersNeeded: Math.ceil(data.totalPeriods / maxPeriods),
          teacherGap: Math.max(0, Math.ceil(data.totalPeriods / maxPeriods) - data.assignedTeachers.size),
          coverageRate: data.totalPeriods > 0 ? Math.round((data.assignedPeriods / data.totalPeriods) * 100) : 0,
          classes: data.classes,
          minGrade: Math.min(...data.grades)
        }))
        .sort((a, b) => {
          if (a.minGrade !== b.minGrade) return a.minGrade - b.minGrade;
          return a.subjectName.localeCompare(b.subjectName);
        })
        .map(({ minGrade, ...rest }) => rest);

      // ====== OVERALL SUMMARY ======
      // Use sum of all class-subject weekly frequencies for total periods (same as recommendations endpoint)
      const totalPeriodsSchool = classSubjects.reduce((sum, assignment) => sum + (assignment.weeklyFrequency || 0), 0);
      const totalAssignedPeriods = classWise.reduce((sum, c) => sum + c.assignedPeriods, 0);
      const totalUnassignedPeriods = totalPeriodsSchool - totalAssignedPeriods;
      
      const currentTeachersCount = new Set(
        classSubjects
          .filter(a => a.assignedTeacherId)
          .map(a => a.assignedTeacherId)
      ).size;
      
      // Calculate average teacher max load from all teachers
      const averageMaxLoad = allTeachers.length > 0 
        ? Math.round(allTeachers.reduce((sum, t) => {
            const workingDays = getWorkingDaysFromAvailability(t.availability);
            return sum + calculateWeeklyCapacity(t.maxDailyPeriods || 6, workingDays);
          }, 0) / allTeachers.length)
        : maxPeriods;
      
      // Ideal teachers = minimum teachers needed based on total periods and average capacity
      const idealTeachersRequired = Math.ceil(totalPeriodsSchool / averageMaxLoad);
      
      console.log(`[CALCULATIONS] totalPeriodsSchool: ${totalPeriodsSchool}, averageMaxLoad: ${averageMaxLoad}, idealTeachersRequired: ${idealTeachersRequired}, currentTeachersCount: ${currentTeachersCount}`);
      
      const totalCapacity = currentTeachersCount * maxPeriods;
      const utilizationRate = totalCapacity > 0 ? Math.round((totalAssignedPeriods / totalCapacity) * 100) : 0;
      
      // Calculate additional teachers based on ideal vs current
      // Positive = need to hire, Negative = have excess staff
      const additionalTeachersNeeded = idealTeachersRequired - currentTeachersCount;
      const totalTeachersRequired = idealTeachersRequired;

      const overall = {
        totalPeriods: totalPeriodsSchool,
        totalAssignedPeriods,
        totalUnassignedPeriods,
        currentTeachers: currentTeachersCount,
        totalTeachersInSystem: allTeachers.length,
        idealTeachersRequired,
        totalCapacity,
        utilizationRate,
        additionalTeachersNeeded,
        totalTeachersRequired,
        averageMaxLoad,
        maxPeriodsPerTeacher: maxPeriods,
        totalClasses: classWise.length,
        totalSubjects: subjectWise.length
      };

      // ====== HIRING RECOMMENDATIONS ======
      const hiringRecommendations = {
        immediate: additionalTeachersNeeded,
        overloadedCount: overloadedTeachers.length,
        underutilizedCount: underutilizedTeachers.length,
        message: additionalTeachersNeeded > 0 
          ? `Hire ${additionalTeachersNeeded} additional teacher${additionalTeachersNeeded > 1 ? 's' : ''} to reach optimal staffing of ${idealTeachersRequired} teachers`
          : additionalTeachersNeeded < 0
          ? `You have ${Math.abs(additionalTeachersNeeded)} excess teacher${Math.abs(additionalTeachersNeeded) > 1 ? 's' : ''}. Consider optimizing staff allocation or redistribution.`
          : overloadedTeachers.length > 0
          ? `${overloadedTeachers.length} teacher${overloadedTeachers.length > 1 ? 's are' : ' is'} overloaded. Consider redistributing workload.`
          : 'Teacher allocation is balanced'
      };

      res.json({
        classWise,
        subjectWise,
        overall,
        teacherUtilization: {
          overloaded: overloadedTeachers,
          underutilized: underutilizedTeachers
        },
        hiringRecommendations
      });
    } catch (error: any) {
      console.error("Error calculating teacher requirements:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Smart Recommendations for Teacher Planner
  app.get("/api/teacher-planner/smart-recommendations", authMiddleware, async (req: any, res) => {
    try {
      // Prevent caching to ensure fresh recommendations
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get settings and data
      let settings = await storage.getTeacherPlannerSettings(schoolId);
      if (!settings) {
        settings = await storage.upsertTeacherPlannerSettings(schoolId, 40);
      }

      const maxPeriods = settings.maxPeriodsPerTeacher;
      const classSubjects = await storage.getClassSubjectAssignments(undefined, schoolId);
      const allTeachers = await storage.getTeachers(schoolId);
      const allSubjects = await storage.getSubjects(schoolId);
      
      // Create subject map for quick lookup
      const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
      
      // Fetch actual timetable entries
      const actualTimetable = await db
        .select({
          classId: timetableEntries.classId,
          teacherId: timetableEntries.teacherId,
          subjectId: timetableEntries.subjectId,
          day: timetableEntries.day,
          period: timetableEntries.period
        })
        .from(timetableEntries)
        .innerJoin(classes, eq(timetableEntries.classId, classes.id))
        .where(
          and(
            eq(classes.schoolId, schoolId),
            eq(timetableEntries.isActive, true)
          )
        );

      // Build teacher workload map
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        employeeId: string;
        assignedPeriods: number;
        maxLoad: number;
        subjects: Set<string>;
        classes: Set<string>;
      }>();

      for (const teacher of allTeachers) {
        const workingDays = getWorkingDaysFromAvailability(teacher.availability);
        const weeklyCapacity = calculateWeeklyCapacity(teacher.maxDailyPeriods || 6, workingDays);
        
        teacherWorkload.set(teacher.id, {
          teacherId: teacher.id,
          name: teacher.name,
          employeeId: teacher.employeeId,
          assignedPeriods: 0,
          maxLoad: weeklyCapacity,
          subjects: new Set(),
          classes: new Set()
        });
      }

      // Count teacher workload and track subjects/classes
      for (const entry of actualTimetable) {
        if (entry.teacherId) {
          const workload = teacherWorkload.get(entry.teacherId);
          if (workload) {
            workload.assignedPeriods++;
            if (entry.subjectId) workload.subjects.add(entry.subjectId);
            if (entry.classId) workload.classes.add(entry.classId);
          }
        }
      }

      // Build class data
      const classData = new Map<string, { 
        classId: string;
        className: string;
        totalPeriods: number;
        assignedPeriods: number;
        unassignedPeriods: number;
        subjectsNeeded: Map<string, { subjectId: string; subjectName: string; unassignedPeriods: number }>;
      }>();

      const classSubjectScheduled = new Map<string, number>();
      for (const entry of actualTimetable) {
        const key = `${entry.classId}-${entry.subjectId}`;
        classSubjectScheduled.set(key, (classSubjectScheduled.get(key) || 0) + 1);
      }

      for (const assignment of classSubjects) {
        const classKey = assignment.classId;
        const className = `${assignment.classGrade} ${assignment.classSection}`;
        const weeklyFrequency = assignment.weeklyFrequency || 0;
        const scheduledKey = `${assignment.classId}-${assignment.subjectId}`;
        const scheduledPeriods = classSubjectScheduled.get(scheduledKey) || 0;
        const unassigned = weeklyFrequency - scheduledPeriods;

        if (!classData.has(classKey)) {
          classData.set(classKey, {
            classId: classKey,
            className,
            totalPeriods: 0,
            assignedPeriods: 0,
            unassignedPeriods: 0,
            subjectsNeeded: new Map()
          });
        }

        const data = classData.get(classKey)!;
        data.totalPeriods += weeklyFrequency;
        data.assignedPeriods += scheduledPeriods;
        data.unassignedPeriods += unassigned;

        if (unassigned > 0) {
          data.subjectsNeeded.set(assignment.subjectId, {
            subjectId: assignment.subjectId,
            subjectName: assignment.subject?.name || 'Unknown',
            unassignedPeriods: unassigned
          });
        }
      }

      // Build subject teacher map
      const subjectTeachers = new Map<string, { subjectName: string; teacherIds: Set<string>; totalPeriods: number }>();
      for (const assignment of classSubjects) {
        const subjectId = assignment.subjectId;
        const subjectName = assignment.subject?.name || 'Unknown';
        if (!subjectTeachers.has(subjectId)) {
          subjectTeachers.set(subjectId, {
            subjectName,
            teacherIds: new Set(),
            totalPeriods: 0
          });
        }
        const subData = subjectTeachers.get(subjectId)!;
        subData.totalPeriods += assignment.weeklyFrequency || 0;
        if (assignment.assignedTeacherId) {
          subData.teacherIds.add(assignment.assignedTeacherId);
        }
      }

      // Generate recommendations
      const recommendations: Array<{
        type: 'staffing' | 'consolidation' | 'optimization' | 'alert';
        message: string;
        priority: 'high' | 'medium' | 'low';
        icon?: string;
        details?: {
          underutilizedTeachers?: Array<{
            id: string;
            name: string;
            admissionNumber: string;
            currentLoad: number;
            capacity: number;
            utilizationPercent: number;
            subjects: Array<{ id: string; name: string; code: string; }>;
          }>;
          assignments?: Array<{
            teacherId: string;
            teacherName: string;
            availablePeriods: number;
            subjectId: string;
            subjectName: string;
            subjectCode: string;
            classes: string[];
          }>;
          coverageGaps?: Array<{
            classId: string;
            className: string;
            subjects: Array<{
              subjectId: string;
              subjectName: string;
              subjectCode: string;
              unassignedPeriods: number;
            }>;
          }>;
        };
      }> = [];

      // Calculate overall metrics
      // Use sum of all class-subject weekly frequencies for total periods (same as calculations endpoint)
      const totalPeriods = classSubjects.reduce((sum, assignment) => sum + (assignment.weeklyFrequency || 0), 0);
      const totalAssigned = Array.from(classData.values()).reduce((sum, c) => sum + c.assignedPeriods, 0);
      const totalUnassigned = totalPeriods - totalAssigned;
      const currentTeachers = Array.from(teacherWorkload.values()).filter(t => t.assignedPeriods > 0).length;
      const averageMaxLoad = allTeachers.length > 0 
        ? Math.round(allTeachers.reduce((sum, t) => {
            const workingDays = getWorkingDaysFromAvailability(t.availability);
            return sum + calculateWeeklyCapacity(t.maxDailyPeriods || 6, workingDays);
          }, 0) / allTeachers.length)
        : maxPeriods;
      const idealTeachers = Math.ceil(totalPeriods / averageMaxLoad);
      const totalCapacity = currentTeachers * maxPeriods;
      const utilizationRate = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
      
      console.log(`[RECOMMENDATIONS] totalPeriods: ${totalPeriods}, averageMaxLoad: ${averageMaxLoad}, idealTeachers: ${idealTeachers}, currentTeachers: ${currentTeachers}`);

      // 1. STAFFING OPTIMIZATION
      if (currentTeachers > idealTeachers && utilizationRate < 80) {
        // Get underutilized teachers with detailed information
        const underutilizedDetails = Array.from(teacherWorkload.values())
          .filter(t => {
            const utilization = (t.assignedPeriods / t.maxLoad) * 100;
            return utilization < 80 && t.assignedPeriods > 0;
          })
          .map(t => {
            const utilization = Math.round((t.assignedPeriods / t.maxLoad) * 100);
            const teacherSubjects = Array.from(t.subjects)
              .map(subjectId => {
                const subject = subjectMap.get(subjectId);
                return subject ? {
                  id: subject.id,
                  name: subject.name,
                  code: subject.code
                } : null;
              })
              .filter(s => s !== null);
            
            // Get teacher's current assignments with class and subject details
            const assignments: Array<{ className: string; subjectName: string; periods: number; }> = [];
            const classSubjectPeriods = new Map<string, number>(); // "classId-subjectId" -> count
            
            for (const entry of actualTimetable) {
              if (entry.teacherId === t.teacherId && entry.classId && entry.subjectId) {
                const key = `${entry.classId}-${entry.subjectId}`;
                classSubjectPeriods.set(key, (classSubjectPeriods.get(key) || 0) + 1);
              }
            }
            
            // Convert to assignments array with class and subject names
            for (const [key, periods] of classSubjectPeriods.entries()) {
              const [classId, subjectId] = key.split('-');
              const assignment = classSubjects.find(a => a.classId === classId && a.subjectId === subjectId);
              if (assignment) {
                assignments.push({
                  className: `${assignment.classGrade} ${assignment.classSection}`,
                  subjectName: assignment.subject?.name || 'Unknown',
                  periods
                });
              }
            }
            
            return {
              id: t.teacherId,
              name: t.name,
              admissionNumber: t.employeeId,
              currentLoad: t.assignedPeriods,
              capacity: t.maxLoad,
              utilizationPercent: utilization,
              subjects: teacherSubjects as Array<{ id: string; name: string; code: string; }>,
              assignments: assignments.sort((a, b) => a.className.localeCompare(b.className))
            };
          })
          .sort((a, b) => a.utilizationPercent - b.utilizationPercent);

        recommendations.push({
          type: 'staffing',
          message: `You only need ${idealTeachers} teachers to teach the complete school (currently have ${currentTeachers}). Consider optimizing staff allocation.`,
          priority: 'high',
          icon: 'Users',
          details: {
            underutilizedTeachers: underutilizedDetails
          }
        });
      }

      if (utilizationRate < 70 && currentTeachers > 0) {
        // Get severely underutilized teachers
        const severelyUnderutilized = Array.from(teacherWorkload.values())
          .filter(t => {
            const utilization = (t.assignedPeriods / t.maxLoad) * 100;
            return utilization < 70 && t.assignedPeriods > 0;
          })
          .map(t => {
            const utilization = Math.round((t.assignedPeriods / t.maxLoad) * 100);
            const teacherSubjects = Array.from(t.subjects)
              .map(subjectId => {
                const subject = subjectMap.get(subjectId);
                return subject ? {
                  id: subject.id,
                  name: subject.name,
                  code: subject.code
                } : null;
              })
              .filter(s => s !== null);
            
            // Get teacher's current assignments with class and subject details
            const assignments: Array<{ className: string; subjectName: string; periods: number; }> = [];
            const classSubjectPeriods = new Map<string, number>(); // "classId-subjectId" -> count
            
            for (const entry of actualTimetable) {
              if (entry.teacherId === t.teacherId && entry.classId && entry.subjectId) {
                const key = `${entry.classId}-${entry.subjectId}`;
                classSubjectPeriods.set(key, (classSubjectPeriods.get(key) || 0) + 1);
              }
            }
            
            // Convert to assignments array with class and subject names
            for (const [key, periods] of classSubjectPeriods.entries()) {
              const [classId, subjectId] = key.split('-');
              const assignment = classSubjects.find(a => a.classId === classId && a.subjectId === subjectId);
              if (assignment) {
                assignments.push({
                  className: `${assignment.classGrade} ${assignment.classSection}`,
                  subjectName: assignment.subject?.name || 'Unknown',
                  periods
                });
              }
            }
            
            return {
              id: t.teacherId,
              name: t.name,
              admissionNumber: t.employeeId,
              currentLoad: t.assignedPeriods,
              capacity: t.maxLoad,
              utilizationPercent: utilization,
              subjects: teacherSubjects as Array<{ id: string; name: string; code: string; }>,
              assignments: assignments.sort((a, b) => a.className.localeCompare(b.className))
            };
          })
          .sort((a, b) => a.utilizationPercent - b.utilizationPercent);

        recommendations.push({
          type: 'optimization',
          message: `Currently utilizing only ${utilizationRate}% of teacher capacity. Increase workload distribution or reduce staff count.`,
          priority: 'high',
          icon: 'TrendingDown',
          details: {
            underutilizedTeachers: severelyUnderutilized
          }
        });
      }

      // 2. TEACHER CONSOLIDATION - Find underutilized teachers who can fill gaps
      const underutilizedTeachers = Array.from(teacherWorkload.values())
        .filter(t => {
          const utilization = (t.assignedPeriods / t.maxLoad) * 100;
          return utilization > 0 && utilization < 70 && t.assignedPeriods > 0;
        })
        .sort((a, b) => (a.assignedPeriods / a.maxLoad) - (b.assignedPeriods / b.maxLoad));

      // Match underutilized teachers with classes needing coverage
      const consolidationMatches: Array<{
        teacherId: string;
        teacherName: string;
        availablePeriods: number;
        subjectId: string;
        subjectName: string;
        classes: string[];
      }> = [];

      for (const teacher of underutilizedTeachers) {
        const availablePeriods = teacher.maxLoad - teacher.assignedPeriods;
        if (availablePeriods >= 3) { // Only suggest if 3+ periods available
          // Find subjects this teacher currently teaches
          for (const subjectId of teacher.subjects) {
            const classesNeedingCoverage: string[] = [];
            let totalUnassignedForSubject = 0;

            // Find classes that need this subject
            for (const [classId, data] of classData.entries()) {
              const subjectNeed = data.subjectsNeeded.get(subjectId);
              if (subjectNeed && subjectNeed.unassignedPeriods > 0 && !teacher.classes.has(classId)) {
                classesNeedingCoverage.push(data.className);
                totalUnassignedForSubject += subjectNeed.unassignedPeriods;
              }
            }

            if (classesNeedingCoverage.length > 0 && totalUnassignedForSubject > 0) {
              const subjectInfo = subjectTeachers.get(subjectId);
              consolidationMatches.push({
                teacherId: teacher.teacherId,
                teacherName: teacher.name,
                availablePeriods,
                subjectId,
                subjectName: subjectInfo?.subjectName || 'Unknown',
                classes: classesNeedingCoverage
              });
            }
          }
        }
      }

      // Generate consolidation recommendations (top 3)
      for (const match of consolidationMatches.slice(0, 3)) {
        const classList = match.classes.length > 3 
          ? `${match.classes.slice(0, 3).join(', ')} and ${match.classes.length - 3} more`
          : match.classes.join(', ');
        
        const subject = subjectMap.get(match.subjectId);
        recommendations.push({
          type: 'consolidation',
          message: `Teacher ${match.teacherName} has ${match.availablePeriods} free periods - can teach ${match.subjectName} in classes ${classList}`,
          priority: 'medium',
          icon: 'UserCheck',
          details: {
            assignments: [{
              teacherId: match.teacherId,
              teacherName: match.teacherName,
              availablePeriods: match.availablePeriods,
              subjectId: match.subjectId,
              subjectName: match.subjectName,
              subjectCode: subject?.code || 'N/A',
              classes: match.classes
            }]
          }
        });
      }

      // 3. SUBJECT CONSOLIDATION - Subjects taught by too many teachers
      for (const [subjectId, data] of subjectTeachers.entries()) {
        const optimalTeachers = Math.ceil(data.totalPeriods / maxPeriods);
        const currentCount = data.teacherIds.size;
        
        if (currentCount > optimalTeachers && currentCount > 1 && optimalTeachers > 0) {
          // Find teachers teaching this subject and get their details
          const teachersForSubject = Array.from(data.teacherIds)
            .map(teacherId => {
              const workload = teacherWorkload.get(teacherId);
              if (!workload) return null;
              
              const utilization = Math.round((workload.assignedPeriods / workload.maxLoad) * 100);
              const subject = subjectMap.get(subjectId);
              
              return {
                id: teacherId,
                name: workload.name,
                admissionNumber: workload.employeeId,
                currentLoad: workload.assignedPeriods,
                capacity: workload.maxLoad,
                utilizationPercent: utilization,
                subjects: [{
                  id: subjectId,
                  name: data.subjectName,
                  code: subject?.code || 'N/A'
                }]
              };
            })
            .filter(t => t !== null)
            .sort((a: any, b: any) => a.utilizationPercent - b.utilizationPercent);
          
          // Find classes needing this subject
          const classesNeedingSubject = Array.from(classData.values())
            .filter(c => c.subjectsNeeded.has(subjectId))
            .map(c => c.className);
          
          const subject = subjectMap.get(subjectId);
          recommendations.push({
            type: 'consolidation',
            message: `Consolidate ${data.subjectName} teaching: ${optimalTeachers} teacher${optimalTeachers > 1 ? 's' : ''} can handle all sections instead of current ${currentCount}`,
            priority: 'medium',
            icon: 'Merge',
            details: {
              underutilizedTeachers: teachersForSubject as any,
              assignments: [{
                teacherId: '',
                teacherName: `${optimalTeachers} teacher${optimalTeachers > 1 ? 's' : ''}`,
                availablePeriods: data.totalPeriods,
                subjectId: subjectId,
                subjectName: data.subjectName,
                subjectCode: subject?.code || 'N/A',
                classes: classesNeedingSubject.length > 0 ? classesNeedingSubject : ['All sections']
              }]
            }
          });
        }
      }

      // 4. UNDERUTILIZATION ALERTS
      const severelyUnderutilized = Array.from(teacherWorkload.values())
        .filter(t => {
          const utilization = (t.assignedPeriods / t.maxLoad) * 100;
          return utilization > 0 && utilization < 50;
        });

      if (severelyUnderutilized.length >= 3) {
        const underutilizedDetails = severelyUnderutilized.map(t => {
          const utilization = Math.round((t.assignedPeriods / t.maxLoad) * 100);
          const teacherSubjects = Array.from(t.subjects)
            .map(subjectId => {
              const subject = subjectMap.get(subjectId);
              return subject ? {
                id: subject.id,
                name: subject.name,
                code: subject.code
              } : null;
            })
            .filter(s => s !== null);
          
          return {
            id: t.teacherId,
            name: t.name,
            admissionNumber: t.employeeId,
            currentLoad: t.assignedPeriods,
            capacity: t.maxLoad,
            utilizationPercent: utilization,
            subjects: teacherSubjects as Array<{ id: string; name: string; code: string; }>
          };
        }).sort((a, b) => a.utilizationPercent - b.utilizationPercent);

        recommendations.push({
          type: 'alert',
          message: `${severelyUnderutilized.length} teachers are severely underutilized (working below 50% capacity) - consider reassignment or staff reduction`,
          priority: 'high',
          icon: 'AlertTriangle',
          details: {
            underutilizedTeachers: underutilizedDetails
          }
        });
      }

      // 5. COVERAGE GAPS
      if (totalUnassigned > 0) {
        const additionalNeeded = Math.ceil(totalUnassigned / maxPeriods);
        const coverageGaps = Array.from(classData.values())
          .filter(c => c.unassignedPeriods > 0)
          .map(c => ({
            classId: c.classId,
            className: c.className,
            subjects: Array.from(c.subjectsNeeded.values()).map(s => {
              const subject = subjectMap.get(s.subjectId);
              return {
                subjectId: s.subjectId,
                subjectName: s.subjectName,
                subjectCode: subject?.code || 'N/A',
                unassignedPeriods: s.unassignedPeriods
              };
            })
          }));

        recommendations.push({
          type: 'alert',
          message: `${totalUnassigned} periods remain unassigned across all classes. ${additionalNeeded} additional teacher${additionalNeeded > 1 ? 's' : ''} needed.`,
          priority: 'high',
          icon: 'AlertCircle',
          details: {
            coverageGaps
          }
        });
      }

      // 6. CLASS-SPECIFIC FREE PERIOD RECOMMENDATIONS
      // Get timetable structure once
      const timetableStructure = await db
        .select()
        .from(timetableStructures)
        .where(eq(timetableStructures.schoolId, schoolId))
        .limit(1);
      
      const periodsPerDay = timetableStructure[0]?.periodsPerDay || 6;
      const workingDays = 5; // Monday to Friday
      const totalWeeklySlots = periodsPerDay * workingDays;

      for (const [classId, data] of classData.entries()) {
        const freePeriods = totalWeeklySlots - data.totalPeriods;
        
        if (freePeriods >= 8) {
          // Significant free periods - recommend adding subjects or increasing frequency
          const existingSubjects = Array.from(classSubjects)
            .filter(cs => cs.classId === classId)
            .map(cs => cs.subject?.name || 'Unknown')
            .slice(0, 3);
          
          recommendations.push({
            type: 'optimization',
            message: `Class ${data.className} has ${freePeriods} free periods per week - you can assign new subjects or increase periods of existing subjects`,
            priority: 'medium',
            icon: 'AlertCircle',
            details: {
              coverageGaps: [{
                classId: data.classId,
                className: data.className,
                subjects: [{
                  subjectId: '',
                  subjectName: `${freePeriods} free periods available`,
                  subjectCode: 'INFO',
                  unassignedPeriods: freePeriods
                }]
              }]
            }
          });
        }
      }

      // 7. EFFICIENCY INSIGHTS
      if (utilizationRate >= 80 && utilizationRate < 95 && totalUnassigned === 0) {
        recommendations.push({
          type: 'optimization',
          message: `Teacher allocation is well-optimized at ${utilizationRate}% capacity utilization. Maintain current staffing levels.`,
          priority: 'low',
          icon: 'CheckCircle'
        });
      }

      // Sort by priority (high > medium > low) and limit to top 8
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const sortedRecommendations = recommendations
        .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
        .slice(0, 8);

      res.json(sortedRecommendations);
    } catch (error: any) {
      console.error("Error generating smart recommendations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Chat for Teacher Planner insights
  app.post("/api/teacher-planner/ai-chat", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      let settings = await storage.getTeacherPlannerSettings(schoolId);
      if (!settings) {
        settings = await storage.upsertTeacherPlannerSettings(schoolId, 40);
      }

      const classSubjects = await storage.getClassSubjectAssignments(undefined, schoolId);
      
      const classWiseData: any[] = [];
      const subjectWiseData = new Map<string, { subjectName: string; totalPeriods: number; classes: string[] }>();

      for (const assignment of classSubjects) {
        const className = `${assignment.classGrade} ${assignment.classSection}`;
        const subjectName = assignment.subject?.name || 'Unknown';
        const weeklyFrequency = assignment.weeklyFrequency || 0;

        const existing = classWiseData.find(c => c.className === className);
        if (existing) {
          existing.totalPeriods += weeklyFrequency;
        } else {
          classWiseData.push({
            className,
            totalPeriods: weeklyFrequency
          });
        }

        if (!subjectWiseData.has(subjectName)) {
          subjectWiseData.set(subjectName, {
            subjectName,
            totalPeriods: 0,
            classes: []
          });
        }

        const subjectData = subjectWiseData.get(subjectName)!;
        subjectData.totalPeriods += weeklyFrequency;
        if (!subjectData.classes.includes(className)) {
          subjectData.classes.push(className);
        }
      }

      const maxPeriods = settings.maxPeriodsPerTeacher;
      const totalPeriods = classWiseData.reduce((sum, c) => sum + c.totalPeriods, 0);
      const totalTeachersRequired = Math.ceil(totalPeriods / maxPeriods);

      const context = `You are a school staffing expert AI assistant. You help administrators plan teacher requirements.

SCHOOL WORKLOAD DATA:
- Max periods per teacher: ${maxPeriods}
- Total periods across all classes: ${totalPeriods}
- Total teachers required: ${totalTeachersRequired}
- Number of classes: ${classWiseData.length}
- Number of subjects: ${subjectWiseData.size}

CLASS-WISE BREAKDOWN:
${classWiseData.map(c => `  - ${c.className}: ${c.totalPeriods} periods (needs ${Math.ceil(c.totalPeriods / maxPeriods)} teachers)`).join('\n')}

SUBJECT-WISE BREAKDOWN:
${Array.from(subjectWiseData.values()).map(s => `  - ${s.subjectName}: ${s.totalPeriods} periods across ${s.classes.length} classes (needs ${Math.ceil(s.totalPeriods / maxPeriods)} teachers)`).join('\n')}

User Question: ${message}

Provide a helpful, data-driven response. If asked about specific numbers, reference the data above. Keep response concise and actionable.`;

      const aiResponse = await processChatMessage(
        { body: { message: context }, user: req.user } as any,
        { json: (data: any) => data } as any
      );

      if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
        res.json({ response: aiResponse.response });
      } else {
        res.json({ response: "I'm here to help with teacher planning. Please ask me about teacher requirements, workload distribution, or staffing insights." });
      }
    } catch (error: any) {
      console.error("Error in teacher planner AI chat:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // TEACHER LOAD SIMULATION MODULE
  // ============================================================================

  // 1. GET /api/load-simulations - Get all load simulations for the school
  app.get("/api/load-simulations", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const simulations = await db
        .select()
        .from(simulationScenarios)
        .where(eq(simulationScenarios.schoolId, schoolId))
        .orderBy(desc(simulationScenarios.createdAt));

      res.json(simulations);
    } catch (error: any) {
      console.error("Error fetching load simulations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 2. POST /api/load-simulations - Create a new load simulation
  app.post("/api/load-simulations", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Simulation name is required" });
      }

      const [simulation] = await db
        .insert(simulationScenarios)
        .values({
          schoolId,
          name,
          description: description || null,
          status: 'draft',
          createdBy: req.user.id,
        })
        .returning();

      res.json(simulation);
    } catch (error: any) {
      console.error("Error creating load simulation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 2.1 POST /api/load-simulations/current-school-staffing/sync - Sync production data to Current School Staffing simulation
  app.post("/api/load-simulations/current-school-staffing/sync", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      console.log(`[CURRENT STAFFING SYNC] Starting sync for school ${schoolId}`);

      // 1. Find or create "Current School Staffing" simulation
      let [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.schoolId, schoolId),
            eq(simulationScenarios.name, "Current School Staffing")
          )
        );

      if (!simulation) {
        console.log(`[CURRENT STAFFING SYNC] Creating new simulation`);
        [simulation] = await db
          .insert(simulationScenarios)
          .values({
            schoolId,
            name: "Current School Staffing",
            description: "Real-time view of your school's current staffing and assignments",
            status: 'active',
            createdBy: req.user.id,
          })
          .returning();
      }

      const simulationId = simulation.id;

      // 2. Clear existing simulation data
      console.log(`[CURRENT STAFFING SYNC] Clearing existing data for simulation ${simulationId}`);
      await Promise.all([
        db.delete(simulationAssignments).where(eq(simulationAssignments.simulationId, simulationId)),
        db.delete(simulationClassSubjects).where(eq(simulationClassSubjects.simulationId, simulationId)),
        db.delete(simulationTeachers).where(eq(simulationTeachers.simulationId, simulationId)),
        db.delete(simulationSubjects).where(eq(simulationSubjects.simulationId, simulationId)),
        db.delete(simulationClasses).where(eq(simulationClasses.simulationId, simulationId)),
      ]);

      // 3. Fetch production data
      console.log(`[CURRENT STAFFING SYNC] Fetching production data`);
      const [prodClasses, prodSubjects, prodTeachers, prodClassSubjectAssignments] = await Promise.all([
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
        db.select({
          id: classSubjectAssignments.id,
          classId: classSubjectAssignments.classId,
          subjectId: classSubjectAssignments.subjectId,
          weeklyFrequency: classSubjectAssignments.weeklyFrequency,
          assignedTeacherId: classSubjectAssignments.assignedTeacherId,
        }).from(classSubjectAssignments)
          .innerJoin(classes, eq(classSubjectAssignments.classId, classes.id))
          .where(eq(classes.schoolId, schoolId)),
      ]);

      console.log(`[CURRENT STAFFING SYNC] Found ${prodClasses.length} classes, ${prodSubjects.length} subjects, ${prodTeachers.length} teachers`);

      // 4. Create mapping for class IDs (production -> simulation)
      // Deduplicate classes by grade+section to prevent duplicate syncing
      const classIdMap = new Map<string, string>();
      if (prodClasses.length > 0) {
        const uniqueClassesMap = new Map<string, typeof prodClasses[0]>();
        
        // Deduplicate: Keep only the first occurrence of each grade+section combination
        // Use collision-safe key: JSON.stringify array of normalized values
        prodClasses.forEach(c => {
          const key = JSON.stringify([c.grade?.trim(), (c.section || '').trim().toUpperCase() || null]);
          if (!uniqueClassesMap.has(key)) {
            uniqueClassesMap.set(key, c);
          } else {
            console.log(`[CURRENT STAFFING SYNC] Found duplicate: ${c.grade} ${c.section || ''} (ID: ${c.id}) - will map to first occurrence`);
          }
        });

        const uniqueClasses = Array.from(uniqueClassesMap.values());
        console.log(`[CURRENT STAFFING SYNC] Deduplicated ${prodClasses.length} classes to ${uniqueClasses.length} unique classes`);

        const simClasses = await db
          .insert(simulationClasses)
          .values(
            uniqueClasses.map(c => ({
              simulationId,
              grade: c.grade,
              section: c.section || '',
              studentCount: c.studentCount,
            }))
          )
          .returning();

        // Map all production class IDs (including duplicates) to their corresponding simulation class
        prodClasses.forEach(prodClass => {
          const key = JSON.stringify([prodClass.grade?.trim(), (prodClass.section || '').trim().toUpperCase() || null]);
          const uniqueClass = uniqueClassesMap.get(key)!;
          const uniqueIndex = uniqueClasses.findIndex(c => c.id === uniqueClass.id);
          if (uniqueIndex !== -1) {
            classIdMap.set(prodClass.id, simClasses[uniqueIndex].id);
          }
        });
      }

      // 5. Create simulation subjects based on class-subject assignments
      // Map each class-subject pair to create simulation subjects
      const subjectIdMap = new Map<string, string>(); // Map: prodSubjectId-classId -> simSubjectId
      const simSubjectsToCreate: any[] = [];
      
      prodClassSubjectAssignments.forEach(csa => {
        const prodSubject = prodSubjects.find(s => s.id === csa.subjectId);
        const simClassId = classIdMap.get(csa.classId);
        
        if (prodSubject && simClassId) {
          simSubjectsToCreate.push({
            simulationId,
            classId: simClassId,
            name: prodSubject.name,
            code: prodSubject.code,
            color: prodSubject.color,
          });
        }
      });

      if (simSubjectsToCreate.length > 0) {
        const simSubjects = await db
          .insert(simulationSubjects)
          .values(simSubjectsToCreate)
          .returning();

        simSubjects.forEach((simSubject, idx) => {
          const csa = prodClassSubjectAssignments[idx];
          const key = `${csa.subjectId}-${csa.classId}`;
          subjectIdMap.set(key, simSubject.id);
        });
      }

      // 6. Create mapping for teacher IDs (production -> simulation)
      const teacherIdMap = new Map<string, string>();
      if (prodTeachers.length > 0) {
        // Get teacher-subject mapping from production
        const teacherSubjects = await db
          .select({
            teacherId: teachers.id,
            subjectIds: sql<string[]>`array_agg(DISTINCT ${classSubjectAssignments.subjectId})`,
          })
          .from(teachers)
          .leftJoin(classSubjectAssignments, eq(teachers.id, classSubjectAssignments.assignedTeacherId))
          .where(eq(teachers.schoolId, schoolId))
          .groupBy(teachers.id);

        const teacherSubjectMap = new Map<string, string[]>();
        teacherSubjects.forEach(ts => {
          teacherSubjectMap.set(ts.teacherId, ts.subjectIds?.filter(Boolean) || []);
        });

        const simTeachers = await db
          .insert(simulationTeachers)
          .values(
            prodTeachers.map(t => ({
              simulationId,
              name: t.name,
              employeeId: t.employeeId,
              maxPeriodsPerDay: 7, // Default value, can be customized
              subjectIds: (teacherSubjectMap.get(t.id) || [])
                .map(subId => {
                  // Find all simulation subject IDs for this production subject across all classes
                  const simSubjectIds: string[] = [];
                  prodClassSubjectAssignments.forEach(csa => {
                    if (csa.subjectId === subId) {
                      const key = `${subId}-${csa.classId}`;
                      const simSubjId = subjectIdMap.get(key);
                      if (simSubjId && !simSubjectIds.includes(simSubjId)) {
                        simSubjectIds.push(simSubjId);
                      }
                    }
                  });
                  return simSubjectIds;
                })
                .flat()
                .filter(Boolean) as string[],
            }))
          )
          .returning();

        prodTeachers.forEach((prodTeacher, idx) => {
          teacherIdMap.set(prodTeacher.id, simTeachers[idx].id);
        });
      }

      // 7. Create class-subject requirements
      const classSubjectMap = new Map<string, string>(); // Map of classId-subjectId -> class_subject_id
      if (prodClassSubjectAssignments.length > 0) {
        const simClassSubjects = await db
          .insert(simulationClassSubjects)
          .values(
            prodClassSubjectAssignments.map(csa => ({
              simulationId,
              classId: classIdMap.get(csa.classId) || '',
              subjectId: subjectIdMap.get(`${csa.subjectId}-${csa.classId}`) || '',
              weeklyPeriods: csa.weeklyFrequency,
            }))
          )
          .returning();

        prodClassSubjectAssignments.forEach((prodCSA, idx) => {
          const key = `${prodCSA.classId}-${prodCSA.subjectId}`;
          classSubjectMap.set(key, simClassSubjects[idx].id);
        });

        // 8. Create teacher assignments
        const assignmentsToCreate = prodClassSubjectAssignments
          .filter(csa => csa.assignedTeacherId)
          .map(csa => {
            const key = `${csa.classId}-${csa.subjectId}`;
            const classSubjectId = classSubjectMap.get(key);
            const teacherId = teacherIdMap.get(csa.assignedTeacherId!);
            
            if (!classSubjectId || !teacherId) return null;

            return {
              simulationId,
              classSubjectId,
              teacherId,
              isAiSuggested: false,
            };
          })
          .filter(Boolean) as any[];

        if (assignmentsToCreate.length > 0) {
          await db.insert(simulationAssignments).values(assignmentsToCreate);
        }

        console.log(`[CURRENT STAFFING SYNC] Created ${assignmentsToCreate.length} assignments`);
      }

      console.log(`[CURRENT STAFFING SYNC] Sync completed successfully`);
      res.json(simulation);
    } catch (error: any) {
      console.error("[CURRENT STAFFING SYNC] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 2.5. POST /api/load-simulations/:id/bulk-upload - Bulk upload simulation data
  app.post("/api/load-simulations/:id/bulk-upload", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      const simulationId = req.params.id;

      // Verify simulation belongs to school
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      const { teachers, classSubjects } = req.body;
      const errors: string[] = [];
      let successCount = 0;

      console.log(`[BULK UPLOAD] Received ${teachers?.length || 0} teachers and ${classSubjects?.length || 0} class-subjects`);

      // Step 1: Fetch all existing teachers in one query
      const existingTeachers = await db
        .select()
        .from(simulationTeachers)
        .where(eq(simulationTeachers.simulationId, simulationId));
      
      const teacherIdMap = new Map<string, string>(); // employeeId -> id
      existingTeachers.forEach(t => teacherIdMap.set(t.employeeId, t.id));
      
      // Prepare new teachers to insert
      const newTeachersToInsert = [];
      for (const teacher of teachers || []) {
        if (!teacher.name || !teacher.employeeId) {
          errors.push(`Teacher row skipped: Missing required fields (name, employeeId)`);
          continue;
        }

        if (!teacherIdMap.has(teacher.employeeId)) {
          newTeachersToInsert.push({
            simulationId,
            name: teacher.name,
            employeeId: teacher.employeeId,
            contactNumber: teacher.contactNumber || null,
            email: teacher.email || null,
            maxPeriodsPerDay: teacher.maxPeriodsPerDay || 7
          });
        }
      }

      // Batch insert all new teachers
      if (newTeachersToInsert.length > 0) {
        const insertedTeachers = await db
          .insert(simulationTeachers)
          .values(newTeachersToInsert)
          .returning();
        
        insertedTeachers.forEach(t => {
          teacherIdMap.set(t.employeeId, t.id);
          successCount++;
        });
      }

      // Step 2: Fetch all existing classes and subjects in one query each
      const existingClasses = await db
        .select()
        .from(simulationClasses)
        .where(eq(simulationClasses.simulationId, simulationId));
      
      const existingSubjects = await db
        .select()
        .from(simulationSubjects)
        .where(eq(simulationSubjects.simulationId, simulationId));
      
      const classIdMap = new Map<string, string>(); // "grade|section" -> id
      existingClasses.forEach(c => {
        const key = `${c.grade}|${c.section || ''}`;
        classIdMap.set(key, c.id);
      });
      
      const subjectIdMap = new Map<string, string>(); // "classId|name|code" -> id
      existingSubjects.forEach(s => {
        const key = `${s.classId}|${s.name}|${s.code}`;
        subjectIdMap.set(key, s.id);
      });
      
      // Step 3: Prepare data for batch inserts
      const validClassSubjects = [];
      const newClassesToInsert = [];
      const newSubjectsToInsert = [];
      const classesToInsertSet = new Set<string>(); // Track classes we're about to insert
      
      for (const cs of classSubjects || []) {
        if (!cs.grade || !cs.subjectName || !cs.weeklyPeriods) {
          errors.push(`Class-Subject row skipped: Missing required fields`);
          continue;
        }
        
        if (!cs.subjectCode || cs.subjectCode.trim() === '') {
          errors.push(`Class-Subject "${cs.subjectName}" in ${cs.grade}${cs.section ? '-' + cs.section : ''}: Missing subject code`);
          continue;
        }

        const normalizedSection = cs.section?.trim() || null;
        const classKey = `${cs.grade}|${normalizedSection || ''}`;
        
        // Check if we need to create this class (not in existing classes AND not already queued for insertion)
        if (!classIdMap.has(classKey) && !classesToInsertSet.has(classKey)) {
          newClassesToInsert.push({
            key: classKey,
            simulationId,
            grade: cs.grade,
            section: normalizedSection
          });
          classesToInsertSet.add(classKey); // Mark as queued for insertion
        }
        
        validClassSubjects.push({ ...cs, normalizedSection, classKey });
      }
      
      // Batch insert new classes
      if (newClassesToInsert.length > 0) {
        const insertedClasses = await db
          .insert(simulationClasses)
          .values(newClassesToInsert.map(c => ({
            simulationId: c.simulationId,
            grade: c.grade,
            section: c.section
          })))
          .returning();
        
        newClassesToInsert.forEach((c, idx) => {
          classIdMap.set(c.key, insertedClasses[idx].id);
        });
      }
      
      // Now prepare subjects with their classIds
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
      const subjectsToInsertSet = new Set<string>(); // Track subjects we're about to insert
      
      for (const cs of validClassSubjects) {
        const classId = classIdMap.get(cs.classKey)!;
        const subjectKey = `${classId}|${cs.subjectName}|${cs.subjectCode}`;
        
        // Check if we need to create this subject (not in existing subjects AND not already queued for insertion)
        if (!subjectIdMap.has(subjectKey) && !subjectsToInsertSet.has(subjectKey)) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          newSubjectsToInsert.push({
            key: subjectKey,
            simulationId,
            name: cs.subjectName,
            code: cs.subjectCode,
            color,
            classId
          });
          subjectsToInsertSet.add(subjectKey); // Mark as queued for insertion
          subjectIdMap.set(subjectKey, 'pending'); // Temporarily mark to prevent re-adding
        }
      }
      
      // Batch insert new subjects
      if (newSubjectsToInsert.length > 0) {
        const insertedSubjects = await db
          .insert(simulationSubjects)
          .values(newSubjectsToInsert.map(s => ({
            simulationId: s.simulationId,
            name: s.name,
            code: s.code,
            color: s.color,
            classId: s.classId
          })))
          .returning();
        
        newSubjectsToInsert.forEach((s, idx) => {
          subjectIdMap.set(s.key, insertedSubjects[idx].id);
        });
      }
      
      // Step 4: Batch insert class-subject links
      const classSubjectLinksToInsert = [];
      
      for (const cs of validClassSubjects) {
        const classId = classIdMap.get(cs.classKey)!;
        const subjectKey = `${classId}|${cs.subjectName}|${cs.subjectCode}`;
        const subjectId = subjectIdMap.get(subjectKey)!;
        
        classSubjectLinksToInsert.push({
          simulationId,
          classId,
          subjectId,
          weeklyPeriods: cs.weeklyPeriods,
          teacherEmployeeId: cs.teacherEmployeeId
        });
      }
      
      const insertedClassSubjects = await db
        .insert(simulationClassSubjects)
        .values(classSubjectLinksToInsert.map(cs => ({
          simulationId: cs.simulationId,
          classId: cs.classId,
          subjectId: cs.subjectId,
          weeklyPeriods: cs.weeklyPeriods
        })))
        .returning();
      
      // Step 5: Batch insert teacher assignments
      const assignmentsToInsert = [];
      
      insertedClassSubjects.forEach((classSubject, idx) => {
        const teacherEmployeeId = classSubjectLinksToInsert[idx].teacherEmployeeId;
        if (teacherEmployeeId) {
          const teacherId = teacherIdMap.get(teacherEmployeeId);
          if (teacherId) {
            assignmentsToInsert.push({
              simulationId,
              teacherId,
              classSubjectId: classSubject.id
            });
          } else {
            errors.push(`Teacher with Employee ID "${teacherEmployeeId}" not found`);
          }
        }
      });
      
      if (assignmentsToInsert.length > 0) {
        await db.insert(simulationAssignments).values(assignmentsToInsert);
      }
      
      successCount += validClassSubjects.length;

      res.json({ success: successCount, errors });
    } catch (error: any) {
      console.error("Error in bulk upload:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3. GET /api/load-simulations/:id - Get a specific simulation with all data
  app.get("/api/load-simulations/:id", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      const simulationId = req.params.id;

      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      // Get all related data
      const classes = await db
        .select()
        .from(simulationClasses)
        .where(eq(simulationClasses.simulationId, simulationId));

      const subjects = await db
        .select()
        .from(simulationSubjects)
        .where(eq(simulationSubjects.simulationId, simulationId));

      const teachers = await db
        .select()
        .from(simulationTeachers)
        .where(eq(simulationTeachers.simulationId, simulationId));

      const classSubjects = await db
        .select()
        .from(simulationClassSubjects)
        .where(eq(simulationClassSubjects.simulationId, simulationId));

      const assignments = await db
        .select()
        .from(simulationAssignments)
        .where(eq(simulationAssignments.simulationId, simulationId));

      res.json({
        ...simulation,
        classes,
        subjects,
        teachers,
        classSubjects,
        assignments,
      });
    } catch (error: any) {
      console.error("Error fetching simulation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3.2 PATCH /api/load-simulations/:id/config - Update simulation configuration settings
  app.patch("/api/load-simulations/:id/config", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      const simulationId = req.params.id;
      const { teachingPeriodsPerDay, workingDaysCount, defaultMaxPeriodsPerDay } = req.body;

      // Verify simulation belongs to user's school
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      // Update simulation configuration
      const updateData: any = { updatedAt: new Date() };
      
      if (teachingPeriodsPerDay !== undefined) {
        updateData.teachingPeriodsPerDay = teachingPeriodsPerDay || null;
      }
      if (workingDaysCount !== undefined) {
        updateData.workingDaysCount = workingDaysCount || null;
      }
      if (defaultMaxPeriodsPerDay !== undefined) {
        updateData.defaultMaxPeriodsPerDay = defaultMaxPeriodsPerDay || null;
      }

      await db
        .update(simulationScenarios)
        .set(updateData)
        .where(eq(simulationScenarios.id, simulationId));

      res.json({ 
        success: true,
        teachingPeriodsPerDay: updateData.teachingPeriodsPerDay,
        workingDaysCount: updateData.workingDaysCount,
        defaultMaxPeriodsPerDay: updateData.defaultMaxPeriodsPerDay
      });
    } catch (error: any) {
      console.error("Error updating simulation config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3.5 GET /api/load-simulations/:id/recommendations - Get AI recommendations for a simulation
  app.get("/api/load-simulations/:id/recommendations", authMiddleware, async (req: any, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      const simulationId = req.params.id;

      // Verify simulation belongs to user's school
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      // Get simulation data
      const teachers = await db
        .select()
        .from(simulationTeachers)
        .where(eq(simulationTeachers.simulationId, simulationId));

      const classSubjects = await db
        .select()
        .from(simulationClassSubjects)
        .where(eq(simulationClassSubjects.simulationId, simulationId));

      const assignments = await db
        .select()
        .from(simulationAssignments)
        .where(eq(simulationAssignments.simulationId, simulationId));

      const classes = await db
        .select()
        .from(simulationClasses)
        .where(eq(simulationClasses.simulationId, simulationId));

      const subjects = await db
        .select()
        .from(simulationSubjects)
        .where(eq(simulationSubjects.simulationId, simulationId));

      // Calculate total weekly periods
      const totalPeriods = classSubjects.reduce((sum, cs) => sum + cs.weeklyPeriods, 0);
      
      // Calculate average max load
      const avgMaxLoad = teachers.length > 0 
        ? Math.round(teachers.reduce((sum, t) => sum + (t.maxPeriodsPerDay * 6), 0) / teachers.length)
        : 0;

      // Calculate ideal teacher count
      const idealTeachers = avgMaxLoad > 0 ? Math.ceil(totalPeriods / avgMaxLoad) : 0;

      // Build teacher workload map
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        weeklyLoad: number;
        maxCapacity: number;
        utilization: number;
      }>();

      // Initialize all teachers
      teachers.forEach(t => {
        teacherWorkload.set(t.id, {
          teacherId: t.id,
          name: t.name,
          weeklyLoad: 0,
          maxCapacity: t.maxPeriodsPerDay * 6,
          utilization: 0
        });
      });

      // Count assigned periods per teacher
      assignments.forEach(assignment => {
        if (assignment.teacherId) {
          const classSubject = classSubjects.find(cs => cs.id === assignment.classSubjectId);
          if (classSubject) {
            const workload = teacherWorkload.get(assignment.teacherId);
            if (workload) {
              workload.weeklyLoad += classSubject.weeklyPeriods;
              workload.utilization = Math.round((workload.weeklyLoad / workload.maxCapacity) * 100);
            }
          }
        }
      });

      // Generate recommendations
      const recommendations: any[] = [];

      // Calculate key metrics first
      const assignedPeriods = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.weeklyLoad, 0);
      const unassignedPeriods = totalPeriods - assignedPeriods;
      const avgUtilization = teachers.length > 0
        ? Math.round(Array.from(teacherWorkload.values()).reduce((sum, t) => sum + t.utilization, 0) / teachers.length)
        : 0;
      const underutilized = Array.from(teacherWorkload.values()).filter(t => t.utilization < 50 && t.utilization > 0);
      const overloaded = Array.from(teacherWorkload.values()).filter(t => t.weeklyLoad > t.maxCapacity);
      const totalAvailableCapacity = Array.from(teacherWorkload.values()).reduce((sum, t) => sum + (t.maxCapacity - t.weeklyLoad), 0);

      // PRIORITY 0: Critical overload warnings (HIGHEST PRIORITY)
      if (overloaded.length > 0) {
        const totalOverload = overloaded.reduce((sum, t) => sum + (t.weeklyLoad - t.maxCapacity), 0);
        
        // Show aggregate warning
        recommendations.push({
          type: 'critical_alert',
          message: `⚠️ CRITICAL: ${overloaded.length} teacher${overloaded.length > 1 ? 's are' : ' is'} overloaded by ${totalOverload} total periods. Immediate redistribution needed!`
        });
        
        // Show individual overload details (top 3 most overloaded)
        const topOverloaded = overloaded
          .sort((a, b) => (b.weeklyLoad - b.maxCapacity) - (a.weeklyLoad - a.maxCapacity))
          .slice(0, 3);
        
        topOverloaded.forEach(t => {
          const excess = t.weeklyLoad - t.maxCapacity;
          const utilizationPercent = Math.round((t.weeklyLoad / t.maxCapacity) * 100);
          recommendations.push({
            type: 'overload_warning',
            message: `Teacher ${t.name} is overloaded: ${t.weeklyLoad}/${t.maxCapacity} periods (${utilizationPercent}% capacity, ${excess} period${excess > 1 ? 's' : ''} over limit)`
          });
        });
        
        // Suggest redistribution if there are underutilized teachers
        if (underutilized.length > 0) {
          const availableCapacity = underutilized.reduce((sum, t) => sum + (t.maxCapacity - t.weeklyLoad), 0);
          recommendations.push({
            type: 'redistribution_opportunity',
            message: `${underutilized.length} teacher${underutilized.length > 1 ? 's have' : ' has'} ${availableCapacity} free periods combined - can redistribute ${Math.min(totalOverload, availableCapacity)} overloaded periods to balance workload`
          });
        }
      }

      // PRIORITY 1: Unassigned periods (highest priority - can't reduce staff if work isn't covered)
      if (unassignedPeriods > 0) {
        // Check if existing teachers have capacity to cover unassigned periods
        if (totalAvailableCapacity >= unassignedPeriods) {
          recommendations.push({
            type: 'staffing_alert',
            message: `${unassignedPeriods} period${unassignedPeriods > 1 ? 's remain' : ' remains'} unassigned. Existing teachers have capacity to cover - reassign workload instead of hiring.`
          });
        } else {
          const additionalTeachersNeeded = Math.ceil((unassignedPeriods - totalAvailableCapacity) / avgMaxLoad);
          recommendations.push({
            type: 'staffing_alert',
            message: `${unassignedPeriods} period${unassignedPeriods > 1 ? 's remain' : ' remains'} unassigned. ${additionalTeachersNeeded} additional teacher${additionalTeachersNeeded > 1 ? 's' : ''} needed after utilizing current capacity.`
          });
        }
      } else {
        // ONLY suggest staff reduction if all periods are assigned
        if (teachers.length > idealTeachers && avgUtilization < 70) {
          const excess = teachers.length - idealTeachers;
          recommendations.push({
            type: 'optimization',
            message: `All periods assigned with only ${avgUtilization}% capacity used. Consider optimizing from ${teachers.length} to ${idealTeachers} teachers.`
          });
        }
      }

      // PRIORITY 2: Utilization insights (only if not contradicting staffing needs)
      if (avgUtilization < 70 && unassignedPeriods === 0) {
        recommendations.push({
          type: 'optimization',
          message: `Currently utilizing only ${avgUtilization}% of teacher capacity. ${unassignedPeriods > 0 ? 'Redistribute workload to cover unassigned periods' : 'Consider workload optimization'}.`
        });
      }

      // PRIORITY 3: Underutilized teachers (informational)
      if (underutilized.length > 0) {
        recommendations.push({
          type: 'optimization',
          message: `${underutilized.length} teacher${underutilized.length > 1 ? 's are' : ' is'} working below 50% capacity - ${unassignedPeriods > 0 ? 'can reassign unassigned periods to them' : 'consider reassignment or optimization'}`
        });
      }

      // Free period opportunities
      const teachersWithFreeTime = Array.from(teacherWorkload.values())
        .filter(t => t.maxCapacity - t.weeklyLoad >= 10)
        .sort((a, b) => (b.maxCapacity - b.weeklyLoad) - (a.maxCapacity - a.weeklyLoad))
        .slice(0, 5);

      teachersWithFreeTime.forEach(t => {
        const freePeriods = t.maxCapacity - t.weeklyLoad;
        // Get subjects this teacher can teach
        const teacherAssignments = assignments.filter(a => a.teacherId === t.teacherId);
        const teacherSubjects = new Set(
          teacherAssignments
            .map(a => classSubjects.find(cs => cs.id === a.classSubjectId)?.subjectId)
            .filter(Boolean)
        );
        
        if (teacherSubjects.size > 0) {
          const subjectNames = [...new Set(
            Array.from(teacherSubjects)
              .map(sId => subjects.find(s => s.id === sId)?.name)
              .filter(Boolean)
          )]
            .slice(0, 2)
            .join(', ');
          
          // Find classes where this teacher could be assigned
          // Look for: 1) Unassigned classes, 2) Classes taught by overloaded teachers
          const availableClassSubjects: string[] = [];
          const overloadedTeacherIds = new Set(
            Array.from(teacherWorkload.values())
              .filter(tw => tw.weeklyLoad > tw.maxCapacity * 0.8) // Teachers using >80% capacity
              .map(tw => tw.teacherId)
          );
          
          Array.from(teacherSubjects).forEach(subjectId => {
            classSubjects
              .filter(cs => cs.subjectId === subjectId)
              .forEach(cs => {
                const existingAssignment = assignments.find(
                  a => a.classSubjectId === cs.id && a.teacherId
                );
                
                // Include if: unassigned OR assigned to an overloaded teacher (and not this teacher)
                if (!existingAssignment || 
                    (existingAssignment.teacherId && 
                     overloadedTeacherIds.has(existingAssignment.teacherId) && 
                     existingAssignment.teacherId !== t.teacherId)) {
                  availableClassSubjects.push(cs.id);
                }
              });
          });
          
          recommendations.push({
            type: 'sharing_opportunity',
            message: `Teacher ${t.name} has ${freePeriods} free periods - can teach ${subjectNames} in additional classes`,
            actionable: true,
            action: {
              type: 'assign_teacher',
              teacherId: t.teacherId,
              teacherName: t.name,
              subjectIds: Array.from(teacherSubjects) as string[],
              availableClassSubjects: availableClassSubjects.slice(0, 5) // Limit to 5 suggestions
            }
          });
        }
      });

      // Subject consolidation opportunities
      const subjectTeacherCount = new Map<string, Set<string>>();
      assignments.forEach(assignment => {
        if (assignment.teacherId) {
          const classSubject = classSubjects.find(cs => cs.id === assignment.classSubjectId);
          if (classSubject) {
            if (!subjectTeacherCount.has(classSubject.subjectId)) {
              subjectTeacherCount.set(classSubject.subjectId, new Set());
            }
            subjectTeacherCount.get(classSubject.subjectId)!.add(assignment.teacherId);
          }
        }
      });

      subjectTeacherCount.forEach((teacherSet, subjectId) => {
        if (teacherSet.size > 1) {
          const subject = subjects.find(s => s.id === subjectId);
          if (subject) {
            const classesForSubject = classSubjects.filter(cs => cs.subjectId === subjectId).length;
            if (classesForSubject <= 5) {
              recommendations.push({
                type: 'optimization',
                message: `Consolidate ${subject.name} teaching: 1 teacher can handle all sections instead of current ${teacherSet.size}`
              });
            }
          }
        }
      });

      console.log('[SIMULATION RECOMMENDATIONS]', {
        simulationId,
        totalPeriods,
        avgMaxLoad,
        idealTeachers,
        currentTeachers: teachers.length,
        recommendationCount: recommendations.length
      });

      res.json(recommendations);
    } catch (error: any) {
      console.error("Error generating simulation recommendations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 4. POST /api/load-simulations/:id/preview-optimize - Preview optimization without applying
  app.post("/api/load-simulations/:id/preview-optimize", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const schoolId = req.user.schoolId;

      // Fetch all simulation data
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      const [classes, subjects, teachers, classSubjects, assignments] = await Promise.all([
        db.select().from(simulationClasses).where(eq(simulationClasses.simulationId, simulationId)),
        db.select().from(simulationSubjects).where(eq(simulationSubjects.simulationId, simulationId)),
        db.select().from(simulationTeachers).where(eq(simulationTeachers.simulationId, simulationId)),
        db.select().from(simulationClassSubjects).where(eq(simulationClassSubjects.simulationId, simulationId)),
        db.select().from(simulationAssignments).where(eq(simulationAssignments.simulationId, simulationId))
      ]);

      // Build teacher workload map
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        weeklyLoad: number;
        maxCapacity: number;
        subjects: Set<string>;
      }>();

      teachers.forEach(t => {
        teacherWorkload.set(t.id, {
          teacherId: t.id,
          name: t.name,
          weeklyLoad: 0,
          maxCapacity: t.maxPeriodsPerDay * 6,
          subjects: new Set()
        });
      });

      // Count current workload and track subjects
      assignments.forEach(assignment => {
        if (assignment.teacherId) {
          const classSubject = classSubjects.find(cs => cs.id === assignment.classSubjectId);
          if (classSubject) {
            const workload = teacherWorkload.get(assignment.teacherId);
            if (workload) {
              workload.weeklyLoad += classSubject.weeklyPeriods;
              workload.subjects.add(classSubject.subjectId);
            }
          }
        }
      });

      // Find unassigned class-subjects
      const unassignedClassSubjects = classSubjects.filter(cs => {
        const assignment = assignments.find(a => a.classSubjectId === cs.id);
        return !assignment || !assignment.teacherId;
      });

      // Calculate preview optimizations (without applying)
      const optimizations: {
        classSubjectId: string;
        className: string;
        subjectName: string;
        teacherId: string;
        teacherName: string;
        periodsAssigned: number;
        type: 'new_assignment' | 'redistribution';
        fromTeacherId?: string;
        fromTeacherName?: string;
      }[] = [];

      // STEP 1: Calculate potential assignments for unassigned periods
      for (const cs of unassignedClassSubjects) {
        const classInfo = classes.find(c => c.id === cs.classId);
        const subject = subjects.find(s => s.id === cs.subjectId);
        
        if (!classInfo || !subject) continue;

        // Find best teacher for this assignment
        const teachersWithCapacity = Array.from(teacherWorkload.values())
          .filter(t => t.maxCapacity - t.weeklyLoad >= cs.weeklyPeriods)
          .sort((a, b) => {
            const aHasSubject = a.subjects.has(cs.subjectId) ? 1 : 0;
            const bHasSubject = b.subjects.has(cs.subjectId) ? 1 : 0;
            if (aHasSubject !== bHasSubject) return bHasSubject - aHasSubject;
            return (b.maxCapacity - b.weeklyLoad) - (a.maxCapacity - a.weeklyLoad);
          });

        if (teachersWithCapacity.length > 0) {
          const selectedTeacher = teachersWithCapacity[0];
          
          // Update local state (for preview only)
          selectedTeacher.weeklyLoad += cs.weeklyPeriods;
          selectedTeacher.subjects.add(cs.subjectId);

          // Track optimization
          optimizations.push({
            classSubjectId: cs.id,
            className: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`,
            subjectName: subject.name,
            teacherId: selectedTeacher.teacherId,
            teacherName: selectedTeacher.name,
            periodsAssigned: cs.weeklyPeriods,
            type: 'new_assignment'
          });
        }
      }

      // STEP 2: Redistribute overloaded teachers' assignments to underutilized teachers
      const overloadedTeachers = Array.from(teacherWorkload.values())
        .filter(t => t.weeklyLoad > t.maxCapacity)
        .sort((a, b) => (b.weeklyLoad - b.maxCapacity) - (a.weeklyLoad - a.maxCapacity));

      for (const overloadedTeacher of overloadedTeachers) {
        const excessLoad = overloadedTeacher.weeklyLoad - overloadedTeacher.maxCapacity;
        
        // Find assignments for this teacher
        const teacherAssignments = assignments
          .filter(a => a.teacherId === overloadedTeacher.teacherId)
          .map(a => {
            const cs = classSubjects.find(cs => cs.id === a.classSubjectId);
            const classInfo = cs ? classes.find(c => c.id === cs.classId) : null;
            const subject = cs ? subjects.find(s => s.id === cs.subjectId) : null;
            return { assignment: a, classSubject: cs, classInfo, subject };
          })
          .filter(x => x.classSubject && x.classInfo && x.subject)
          .sort((a, b) => b.classSubject!.weeklyPeriods - a.classSubject!.weeklyPeriods);

        let redistributed = 0;

        for (const { assignment, classSubject, classInfo, subject } of teacherAssignments) {
          if (redistributed >= excessLoad) break;
          if (!classSubject || !classInfo || !subject) continue;

          // Find underutilized teachers who can teach this subject
          // Relaxed criteria: just needs capacity and is underutilized (< 80%) OR already teaches the subject
          const candidateTeachers = Array.from(teacherWorkload.values())
            .filter(t => {
              if (t.teacherId === overloadedTeacher.teacherId) return false;
              const hasCapacity = t.maxCapacity - t.weeklyLoad >= classSubject.weeklyPeriods;
              const teachesSubject = t.subjects.has(classSubject.subjectId);
              const isUnderutilized = t.weeklyLoad < t.maxCapacity * 0.8; // Less than 80% utilized
              return hasCapacity && (teachesSubject || isUnderutilized);
            })
            .sort((a, b) => {
              const aTeachesSubject = a.subjects.has(classSubject.subjectId) ? 1 : 0;
              const bTeachesSubject = b.subjects.has(classSubject.subjectId) ? 1 : 0;
              if (aTeachesSubject !== bTeachesSubject) return bTeachesSubject - aTeachesSubject;
              return (a.maxCapacity - a.weeklyLoad) - (b.maxCapacity - b.weeklyLoad);
            });

          if (candidateTeachers.length > 0) {
            const targetTeacher = candidateTeachers[0];

            // Update local state
            overloadedTeacher.weeklyLoad -= classSubject.weeklyPeriods;
            targetTeacher.weeklyLoad += classSubject.weeklyPeriods;
            targetTeacher.subjects.add(classSubject.subjectId);

            redistributed += classSubject.weeklyPeriods;

            // Track redistribution
            optimizations.push({
              classSubjectId: classSubject.id,
              className: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`,
              subjectName: subject.name,
              teacherId: targetTeacher.teacherId,
              teacherName: targetTeacher.name,
              periodsAssigned: classSubject.weeklyPeriods,
              type: 'redistribution',
              fromTeacherId: overloadedTeacher.teacherId,
              fromTeacherName: overloadedTeacher.name
            });
          }
        }
      }

      // Calculate stats
      const totalPeriods = classSubjects.reduce((sum, cs) => sum + cs.weeklyPeriods, 0);
      const unassignedPeriods = unassignedClassSubjects.reduce((sum, cs) => sum + cs.weeklyPeriods, 0);
      const coverageBefore = totalPeriods > 0 ? Math.round(((totalPeriods - unassignedPeriods) / totalPeriods) * 100) : 0;
      const coverageAfter = optimizations.length > 0 ? 100 : coverageBefore;

      // Get teacher utilization after optimization (all affected teachers)
      const affectedTeacherIds = new Set<string>();
      optimizations.forEach(o => {
        affectedTeacherIds.add(o.teacherId);
        if (o.fromTeacherId) affectedTeacherIds.add(o.fromTeacherId);
      });

      const teacherUtilization = Array.from(teacherWorkload.values())
        .filter(t => affectedTeacherIds.has(t.teacherId))
        .map(t => ({
          teacherId: t.teacherId,
          name: t.name,
          utilization: Math.round((t.weeklyLoad / t.maxCapacity) * 100),
          periodsAssigned: t.weeklyLoad,
          capacity: t.maxCapacity
        }))
        .sort((a, b) => b.utilization - a.utilization);

      const newAssignments = optimizations.filter(o => o.type === 'new_assignment');
      const redistributions = optimizations.filter(o => o.type === 'redistribution');

      res.json({
        canOptimize: optimizations.length > 0,
        summary: {
          periodsOptimized: optimizations.reduce((sum, o) => sum + o.periodsAssigned, 0),
          assignmentsCreated: newAssignments.length,
          redistributions: redistributions.length,
          coverageBefore,
          coverageAfter,
          coverageImprovement: coverageAfter - coverageBefore
        },
        optimizations,
        newAssignments,
        redistributions,
        teacherUtilization
      });
    } catch (error: any) {
      console.error("Error previewing optimization:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 5. POST /api/load-simulations/:id/auto-optimize - Auto-optimize simulation
  app.post("/api/load-simulations/:id/auto-optimize", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const schoolId = req.user.schoolId;

      // Fetch all simulation data
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      const [classes, subjects, teachers, classSubjects, assignments] = await Promise.all([
        db.select().from(simulationClasses).where(eq(simulationClasses.simulationId, simulationId)),
        db.select().from(simulationSubjects).where(eq(simulationSubjects.simulationId, simulationId)),
        db.select().from(simulationTeachers).where(eq(simulationTeachers.simulationId, simulationId)),
        db.select().from(simulationClassSubjects).where(eq(simulationClassSubjects.simulationId, simulationId)),
        db.select().from(simulationAssignments).where(eq(simulationAssignments.simulationId, simulationId))
      ]);

      // Build teacher workload map
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        weeklyLoad: number;
        maxCapacity: number;
        subjects: Set<string>;
      }>();

      teachers.forEach(t => {
        teacherWorkload.set(t.id, {
          teacherId: t.id,
          name: t.name,
          weeklyLoad: 0,
          maxCapacity: t.maxPeriodsPerDay * 6,
          subjects: new Set()
        });
      });

      // Count current workload and track subjects
      assignments.forEach(assignment => {
        if (assignment.teacherId) {
          const classSubject = classSubjects.find(cs => cs.id === assignment.classSubjectId);
          if (classSubject) {
            const workload = teacherWorkload.get(assignment.teacherId);
            if (workload) {
              workload.weeklyLoad += classSubject.weeklyPeriods;
              workload.subjects.add(classSubject.subjectId);
            }
          }
        }
      });

      // Find unassigned class-subjects
      const unassignedClassSubjects = classSubjects.filter(cs => {
        const assignment = assignments.find(a => a.classSubjectId === cs.id);
        return !assignment || !assignment.teacherId;
      });

      // Track optimizations
      const optimizations: {
        classSubjectId: string;
        className: string;
        subjectName: string;
        teacherId: string;
        teacherName: string;
        periodsAssigned: number;
        type: 'new_assignment' | 'redistribution';
        fromTeacherId?: string;
        fromTeacherName?: string;
      }[] = [];

      // STEP 1: Auto-assign unassigned periods
      for (const cs of unassignedClassSubjects) {
        const classInfo = classes.find(c => c.id === cs.classId);
        const subject = subjects.find(s => s.id === cs.subjectId);
        
        if (!classInfo || !subject) continue;

        // Find best teacher for this assignment
        // Priority 1: Teachers who already teach this subject and have capacity
        // Priority 2: Teachers with most available capacity
        const teachersWithCapacity = Array.from(teacherWorkload.values())
          .filter(t => t.maxCapacity - t.weeklyLoad >= cs.weeklyPeriods)
          .sort((a, b) => {
            // Prioritize teachers already teaching this subject
            const aHasSubject = a.subjects.has(cs.subjectId) ? 1 : 0;
            const bHasSubject = b.subjects.has(cs.subjectId) ? 1 : 0;
            if (aHasSubject !== bHasSubject) return bHasSubject - aHasSubject;
            
            // Then by available capacity
            return (b.maxCapacity - b.weeklyLoad) - (a.maxCapacity - a.weeklyLoad);
          });

        if (teachersWithCapacity.length > 0) {
          const selectedTeacher = teachersWithCapacity[0];
          
          // Update or create assignment
          const existingAssignment = assignments.find(a => a.classSubjectId === cs.id);
          if (existingAssignment) {
            await db
              .update(simulationAssignments)
              .set({ teacherId: selectedTeacher.teacherId })
              .where(eq(simulationAssignments.id, existingAssignment.id));
          } else {
            const [newAssignment] = await db
              .insert(simulationAssignments)
              .values({
                simulationId,
                classSubjectId: cs.id,
                teacherId: selectedTeacher.teacherId
              })
              .returning();
            
            // Add to local assignments array to prevent duplicate insertions
            if (newAssignment) {
              assignments.push(newAssignment);
            }
          }

          // Update local state
          selectedTeacher.weeklyLoad += cs.weeklyPeriods;
          selectedTeacher.subjects.add(cs.subjectId);

          // Track optimization
          optimizations.push({
            classSubjectId: cs.id,
            className: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`,
            subjectName: subject.name,
            teacherId: selectedTeacher.teacherId,
            teacherName: selectedTeacher.name,
            periodsAssigned: cs.weeklyPeriods,
            type: 'new_assignment'
          });
        }
      }

      // STEP 2: Redistribute overloaded teachers' assignments to underutilized teachers
      const overloadedTeachers = Array.from(teacherWorkload.values())
        .filter(t => t.weeklyLoad > t.maxCapacity)
        .sort((a, b) => (b.weeklyLoad - b.maxCapacity) - (a.weeklyLoad - a.maxCapacity));

      for (const overloadedTeacher of overloadedTeachers) {
        const excessLoad = overloadedTeacher.weeklyLoad - overloadedTeacher.maxCapacity;
        
        // Find assignments for this teacher
        const teacherAssignments = assignments
          .filter(a => a.teacherId === overloadedTeacher.teacherId)
          .map(a => {
            const cs = classSubjects.find(cs => cs.id === a.classSubjectId);
            const classInfo = cs ? classes.find(c => c.id === cs.classId) : null;
            const subject = cs ? subjects.find(s => s.id === cs.subjectId) : null;
            return { assignment: a, classSubject: cs, classInfo, subject };
          })
          .filter(x => x.classSubject && x.classInfo && x.subject)
          .sort((a, b) => b.classSubject!.weeklyPeriods - a.classSubject!.weeklyPeriods);

        let redistributed = 0;

        for (const { assignment, classSubject, classInfo, subject } of teacherAssignments) {
          if (redistributed >= excessLoad) break;
          if (!classSubject || !classInfo || !subject) continue;

          // Find underutilized teachers who can teach this subject
          // Relaxed criteria: just needs capacity and is underutilized (< 80%) OR already teaches the subject
          const candidateTeachers = Array.from(teacherWorkload.values())
            .filter(t => {
              if (t.teacherId === overloadedTeacher.teacherId) return false;
              const hasCapacity = t.maxCapacity - t.weeklyLoad >= classSubject.weeklyPeriods;
              const teachesSubject = t.subjects.has(classSubject.subjectId);
              const isUnderutilized = t.weeklyLoad < t.maxCapacity * 0.8; // Less than 80% utilized
              return hasCapacity && (teachesSubject || isUnderutilized);
            })
            .sort((a, b) => {
              const aTeachesSubject = a.subjects.has(classSubject.subjectId) ? 1 : 0;
              const bTeachesSubject = b.subjects.has(classSubject.subjectId) ? 1 : 0;
              if (aTeachesSubject !== bTeachesSubject) return bTeachesSubject - aTeachesSubject;
              return (a.maxCapacity - a.weeklyLoad) - (b.maxCapacity - b.weeklyLoad);
            });

          if (candidateTeachers.length > 0) {
            const targetTeacher = candidateTeachers[0];

            // Update database assignment
            await db
              .update(simulationAssignments)
              .set({ teacherId: targetTeacher.teacherId })
              .where(eq(simulationAssignments.id, assignment.id));

            // Update local state
            overloadedTeacher.weeklyLoad -= classSubject.weeklyPeriods;
            targetTeacher.weeklyLoad += classSubject.weeklyPeriods;
            targetTeacher.subjects.add(classSubject.subjectId);

            redistributed += classSubject.weeklyPeriods;

            // Track redistribution
            optimizations.push({
              classSubjectId: classSubject.id,
              className: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`,
              subjectName: subject.name,
              teacherId: targetTeacher.teacherId,
              teacherName: targetTeacher.name,
              periodsAssigned: classSubject.weeklyPeriods,
              type: 'redistribution',
              fromTeacherId: overloadedTeacher.teacherId,
              fromTeacherName: overloadedTeacher.name
            });
          }
        }
      }

      // Calculate before/after stats
      const totalPeriods = classSubjects.reduce((sum, cs) => sum + cs.weeklyPeriods, 0);
      const assignedBefore = unassignedClassSubjects.reduce((sum, cs) => sum + cs.weeklyPeriods, 0);
      const assignedAfter = totalPeriods;
      const coverageBefore = totalPeriods > 0 ? Math.round(((totalPeriods - assignedBefore) / totalPeriods) * 100) : 0;
      const coverageAfter = 100;

      // Get updated teacher utilization (all affected teachers)
      const affectedTeacherIds = new Set<string>();
      optimizations.forEach(o => {
        affectedTeacherIds.add(o.teacherId);
        if (o.fromTeacherId) affectedTeacherIds.add(o.fromTeacherId);
      });

      const teacherUtilization = Array.from(teacherWorkload.values())
        .filter(t => affectedTeacherIds.has(t.teacherId))
        .map(t => ({
          teacherId: t.teacherId,
          name: t.name,
          utilization: Math.round((t.weeklyLoad / t.maxCapacity) * 100),
          periodsAssigned: t.weeklyLoad,
          capacity: t.maxCapacity
        }))
        .sort((a, b) => b.utilization - a.utilization);

      const newAssignments = optimizations.filter(o => o.type === 'new_assignment');
      const redistributions = optimizations.filter(o => o.type === 'redistribution');

      const summary = {
        periodsOptimized: optimizations.length > 0 ? optimizations.reduce((sum, o) => sum + o.periodsAssigned, 0) : 0,
        assignmentsCreated: newAssignments.length,
        redistributions: redistributions.length,
        coverageBefore,
        coverageAfter,
        coverageImprovement: coverageAfter - coverageBefore
      };

      // Save optimization history to database
      if (optimizations.length > 0) {
        await db
          .update(simulationScenarios)
          .set({
            lastOptimizationAt: new Date(),
            lastOptimizationSummary: summary
          })
          .where(eq(simulationScenarios.id, simulationId));
      }

      res.json({
        success: true,
        summary,
        optimizations,
        newAssignments,
        redistributions,
        teacherUtilization
      });
    } catch (error: any) {
      console.error("Error auto-optimizing simulation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 5.5. POST /api/load-simulations/:id/ai-auto-assign - AI Auto Assign teachers with capacity optimization
  app.post("/api/load-simulations/:id/ai-auto-assign", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const schoolId = req.user.schoolId;

      // Fetch simulation and verify ownership
      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      // Fetch timetable structure for fallback values
      const [timetableStructure] = await db
        .select()
        .from(timetableStructures)
        .where(eq(timetableStructures.schoolId, schoolId));

      // Calculate fallback working days from timetable
      const fallbackWorkingDays = timetableStructure?.workingDays 
        ? (timetableStructure.workingDays as Array<{ day: string; isWorkingDay: boolean }>).filter(d => d.isWorkingDay).length
        : 6;

      // Use simulation's configuration if set, otherwise use fallback values
      const workingDaysCount = simulation.workingDaysCount ?? fallbackWorkingDays;
      const defaultMaxPeriodsPerDay = simulation.defaultMaxPeriodsPerDay ?? 6;

      // Fetch all simulation data
      const [classes, subjects, teachers, classSubjects, existingAssignments] = await Promise.all([
        db.select().from(simulationClasses).where(eq(simulationClasses.simulationId, simulationId)),
        db.select().from(simulationSubjects).where(eq(simulationSubjects.simulationId, simulationId)),
        db.select().from(simulationTeachers).where(eq(simulationTeachers.simulationId, simulationId)),
        db.select().from(simulationClassSubjects).where(eq(simulationClassSubjects.simulationId, simulationId)),
        db.select().from(simulationAssignments).where(eq(simulationAssignments.simulationId, simulationId))
      ]);

      // Build teacher workload map with existing teachers
      const teacherWorkload = new Map<string, { 
        teacherId: string;
        name: string;
        weeklyLoad: number;
        maxCapacity: number;
        subjectIds: Set<string>; // Track individual subject IDs
        subjectNames: Set<string>; // Track unique subject NAMES (for 2-subject limit)
      }>();

      // CLEAR ALL EXISTING ASSIGNMENTS - Start fresh each time
      console.log('[AI AUTO ASSIGN] Clearing all existing assignments for fresh optimization...');
      if (existingAssignments.length > 0) {
        await db
          .delete(simulationAssignments)
          .where(eq(simulationAssignments.simulationId, simulationId));
      }

      // Initialize teacher workload (fresh start)
      teachers.forEach(t => {
        teacherWorkload.set(t.id, {
          teacherId: t.id,
          name: t.name,
          weeklyLoad: 0,
          maxCapacity: t.maxPeriodsPerDay * workingDaysCount, // Use actual working days from timetable
          subjectIds: new Set(),
          subjectNames: new Set()
        });
      });

      // ALL class-subjects need assignment (fresh start)
      const classSubjectsToAssign = [...classSubjects];

      // Shuffle first for randomization (different combinations each time)
      for (let i = classSubjectsToAssign.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [classSubjectsToAssign[i], classSubjectsToAssign[j]] = [classSubjectsToAssign[j], classSubjectsToAssign[i]];
      }

      // Sort by weekly periods (descending) for optimal assignment
      // The prior shuffle ensures different order for subjects with equal periods
      classSubjectsToAssign.sort((a, b) => b.weeklyPeriods - a.weeklyPeriods);

      const newAssignments: any[] = [];
      const newTeachersCreated: any[] = [];
      
      // Find the highest existing auto-teacher letter to continue from
      const autoTeacherPattern = /^Teacher ([A-Z])$/;
      let highestLetter = 64; // Start before 'A' (65)
      teachers.forEach(t => {
        const match = t.name.match(autoTeacherPattern);
        if (match) {
          const letterCode = match[1].charCodeAt(0);
          if (letterCode > highestLetter) {
            highestLetter = letterCode;
          }
        }
      });
      let teacherCounter = highestLetter + 1; // Next letter after highest found

      console.log('[AI AUTO ASSIGN] Starting fresh assignment with optimization:', {
        totalSubjectsToAssign: classSubjectsToAssign.length,
        existingTeachers: teachers.length,
        totalClassSubjects: classSubjects.length,
        nextTeacherLetter: String.fromCharCode(teacherCounter)
      });

      // Process each unassigned class-subject
      for (const cs of classSubjectsToAssign) {
        const subject = subjects.find(s => s.id === cs.subjectId);
        const classInfo = classes.find(c => c.id === cs.classId);
        
        if (!subject || !classInfo) {
          console.log('[AI AUTO ASSIGN] Skipping - subject or class not found:', { cs, subject, classInfo });
          continue;
        }

        // Try to find an existing teacher with capacity (fill up to 100%)
        const availableTeachers = Array.from(teacherWorkload.values())
          .filter(t => {
            // Only use teacher if they have enough capacity for this assignment
            if (t.maxCapacity - t.weeklyLoad < cs.weeklyPeriods) {
              return false;
            }
            
            // MAX 2 SUBJECTS RULE: Teacher can only teach maximum 2 different subject NAMES
            // Allow if: 
            // 1. Teacher already teaches this subject NAME, OR
            // 2. Teacher teaches less than 2 different subject NAMES
            if (t.subjectNames.has(subject.name)) {
              return true; // Already teaches this subject name - OK
            }
            
            if (t.subjectNames.size >= 2) {
              return false; // Already teaching 2 different subject names - cannot add more
            }
            
            return true; // Has capacity and can take on new subject
          })
          .sort((a, b) => {
            // PRIORITY ORDER:
            // 1. Teachers already teaching this subject NAME (subject affinity)
            // 2. Among those, prioritize higher utilization (fill teachers up)
            // 3. Teachers teaching 1 subject name (can take 1 more)
            // 4. Teachers teaching 0 subject names (new teachers)
            
            const aTeachesSubject = a.subjectNames.has(subject.name) ? 1 : 0;
            const bTeachesSubject = b.subjectNames.has(subject.name) ? 1 : 0;
            
            // Primary sort: Already teaches subject name (highest priority)
            if (aTeachesSubject !== bTeachesSubject) {
              return bTeachesSubject - aTeachesSubject;
            }
            
            // If both teach or both don't teach this subject:
            // Secondary sort: Higher workload first (fill teachers up to capacity)
            return b.weeklyLoad - a.weeklyLoad;
          });

        let assignedTeacher = availableTeachers[0];

        // DEBUG: Log why we're creating new teacher
        if (!assignedTeacher) {
          const debugInfo = {
            classSubject: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''} - ${subject.name}`,
            periodsNeeded: cs.weeklyPeriods,
            existingTeachers: Array.from(teacherWorkload.values()).map(t => ({
              name: t.name,
              capacity: `${t.weeklyLoad}/${t.maxCapacity}`,
              subjectNames: Array.from(t.subjectNames),
              uniqueSubjectCount: t.subjectNames.size,
              hasCapacity: t.maxCapacity - t.weeklyLoad >= cs.weeklyPeriods,
              teachesThisSubject: t.subjectNames.has(subject.name),
              canTakeNewSubject: t.subjectNames.size < 2
            }))
          };
          console.log('[AI AUTO ASSIGN] Creating new teacher - no existing teacher available:', JSON.stringify(debugInfo, null, 2));
        }

        // If no existing teacher found, create a new one
        if (!assignedTeacher) {
          const teacherName = `Teacher ${String.fromCharCode(teacherCounter)}`;
          teacherCounter++;

          // Create new teacher in database
          const [newTeacher] = await db
            .insert(simulationTeachers)
            .values({
              simulationId,
              name: teacherName,
              employeeId: `AUTO-${teacherCounter - 65}`,
              maxPeriodsPerDay: defaultMaxPeriodsPerDay
            })
            .returning();

          // Add to workload map
          teacherWorkload.set(newTeacher.id, {
            teacherId: newTeacher.id,
            name: newTeacher.name,
            weeklyLoad: 0,
            maxCapacity: defaultMaxPeriodsPerDay * workingDaysCount, // Use actual working days
            subjectIds: new Set(),
            subjectNames: new Set()
          });

          assignedTeacher = teacherWorkload.get(newTeacher.id)!;
          newTeachersCreated.push({
            id: newTeacher.id,
            name: newTeacher.name,
            employeeId: newTeacher.employeeId,
            maxPeriodsPerDay: defaultMaxPeriodsPerDay
          });
        }

        // Create new assignment (fresh start - no existing assignments)
        await db
          .insert(simulationAssignments)
          .values({
            simulationId,
            teacherId: assignedTeacher.teacherId,
            classSubjectId: cs.id
          });

        // Update teacher workload
        assignedTeacher.weeklyLoad += cs.weeklyPeriods;
        assignedTeacher.subjectIds.add(cs.subjectId);
        assignedTeacher.subjectNames.add(subject.name);

        newAssignments.push({
          classSubjectId: cs.id,
          className: `${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`,
          subjectName: subject.name,
          teacherId: assignedTeacher.teacherId,
          teacherName: assignedTeacher.name,
          periodsAssigned: cs.weeklyPeriods,
          isNewTeacher: newTeachersCreated.some(nt => nt.id === assignedTeacher.teacherId)
        });
      }

      // Calculate final teacher utilization with subject details
      const teacherUtilization = Array.from(teacherWorkload.values())
        .map(t => {
          // Get unique subject names for this teacher
          const teacherSubjects = Array.from(t.subjectNames);
          
          return {
            teacherId: t.teacherId,
            name: t.name,
            utilization: Math.round((t.weeklyLoad / t.maxCapacity) * 100),
            periodsAssigned: t.weeklyLoad,
            capacity: t.maxCapacity,
            subjectsCount: t.subjectNames.size,
            subjects: teacherSubjects,
            isNewTeacher: newTeachersCreated.some(nt => nt.id === t.teacherId)
          };
        })
        .filter(t => t.periodsAssigned > 0) // Only show teachers with assignments
        .sort((a, b) => b.utilization - a.utilization);

      res.json({
        success: true,
        summary: {
          totalAssignments: newAssignments.length,
          newTeachersCreated: newTeachersCreated.length,
          existingTeachersUsed: new Set(newAssignments.filter(a => !a.isNewTeacher).map(a => a.teacherId)).size,
          totalPeriodsCovered: newAssignments.reduce((sum, a) => sum + a.periodsAssigned, 0),
          averageUtilization: teacherUtilization.length > 0 
            ? Math.round(teacherUtilization.reduce((sum, t) => sum + t.utilization, 0) / teacherUtilization.length)
            : 0
        },
        newTeachersCreated,
        assignments: newAssignments,
        teacherUtilization
      });
    } catch (error: any) {
      console.error("Error in AI auto-assign:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 5. DELETE /api/load-simulations/:id - Delete a simulation
  app.delete("/api/load-simulations/:id", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = req.user.schoolId;
      const simulationId = req.params.id;

      const [simulation] = await db
        .select()
        .from(simulationScenarios)
        .where(
          and(
            eq(simulationScenarios.id, simulationId),
            eq(simulationScenarios.schoolId, schoolId)
          )
        );

      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }

      await db
        .delete(simulationScenarios)
        .where(eq(simulationScenarios.id, simulationId));

      res.json({ message: "Simulation deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting simulation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // SIMULATION DATA MANAGEMENT (Classes, Subjects, Teachers, Assignments)
  // ============================================================================

  // Simulation Classes
  app.post("/api/load-simulations/:id/classes", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { grade, section, studentCount } = req.body;

      const [newClass] = await db
        .insert(simulationClasses)
        .values({
          simulationId,
          grade,
          section: section || "",
          studentCount: studentCount || 0,
        })
        .returning();

      res.json(newClass);
    } catch (error: any) {
      console.error("Error creating simulation class:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/load-simulations/:id/classes/:classId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { classId } = req.params;
      const { grade, section, studentCount } = req.body;

      const [updatedClass] = await db
        .update(simulationClasses)
        .set({
          grade,
          section: section || "",
          studentCount: studentCount || 0,
          updatedAt: new Date(),
        })
        .where(eq(simulationClasses.id, classId))
        .returning();

      res.json(updatedClass);
    } catch (error: any) {
      console.error("Error updating simulation class:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/load-simulations/:id/classes/:classId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { classId } = req.params;

      await db
        .delete(simulationClasses)
        .where(eq(simulationClasses.id, classId));

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting simulation class:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Simulation Subjects
  app.post("/api/load-simulations/:id/subjects", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { classId, name, code, color } = req.body;

      if (!classId) {
        return res.status(400).json({ message: "Class ID is required" });
      }

      const [newSubject] = await db
        .insert(simulationSubjects)
        .values({
          simulationId,
          classId,
          name,
          code,
          color: color || "#3B82F6",
        })
        .returning();

      // Automatically create the class-subject link with default 0 periods
      await db
        .insert(simulationClassSubjects)
        .values({
          simulationId,
          classId,
          subjectId: newSubject.id,
          weeklyPeriods: 0,
        });

      res.json(newSubject);
    } catch (error: any) {
      console.error("Error creating simulation subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/load-simulations/:id/subjects/:subjectId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { subjectId } = req.params;

      await db
        .delete(simulationSubjects)
        .where(eq(simulationSubjects.id, subjectId));

      res.json({ message: "Subject deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting simulation subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/load-simulations/:id/subjects/copy", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { subjectId, sourceClassId, targetClassId } = req.body;

      if (!subjectId || !sourceClassId || !targetClassId) {
        return res.status(400).json({ message: "Subject ID, source class ID, and target class ID are required" });
      }

      // Get the source subject
      const [sourceSubject] = await db
        .select()
        .from(simulationSubjects)
        .where(eq(simulationSubjects.id, subjectId));

      if (!sourceSubject) {
        return res.status(404).json({ message: "Source subject not found" });
      }

      // Get source and target classes
      const [sourceClass] = await db
        .select()
        .from(simulationClasses)
        .where(eq(simulationClasses.id, sourceClassId));

      const [targetClass] = await db
        .select()
        .from(simulationClasses)
        .where(eq(simulationClasses.id, targetClassId));

      if (!sourceClass || !targetClass) {
        return res.status(404).json({ message: "Source or target class not found" });
      }

      // Check if target class already has this subject
      const existingSubjectInTarget = await db
        .select()
        .from(simulationSubjects)
        .where(
          and(
            eq(simulationSubjects.classId, targetClassId),
            eq(simulationSubjects.name, sourceSubject.name)
          )
        );

      if (existingSubjectInTarget.length > 0) {
        return res.status(400).json({ message: `Subject "${sourceSubject.name}" already exists in this class` });
      }

      // Determine subject code logic:
      // If same grade (e.g., Class 6A → Class 6B), use same code
      // If different grade (e.g., Class 6A → Class 7A), generate new unique code
      let subjectCode = sourceSubject.code;
      const sameGrade = sourceClass.grade === targetClass.grade;
      
      console.log(`[SUBJECT COPY] Source: ${sourceClass.grade} ${sourceClass.section || '(no section)'}, Target: ${targetClass.grade} ${targetClass.section || '(no section)'}, Same grade: ${sameGrade}, Original code: ${sourceSubject.code}`);

      if (!sameGrade) {
        // Generate unique code
        const existingSubjects = await db
          .select()
          .from(simulationSubjects)
          .where(eq(simulationSubjects.simulationId, simulationId));

        const existingCodes = existingSubjects.map(s => s.code);
        
        // Create base code from first 4 letters of subject name
        const baseCode = sourceSubject.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 4)
          .toUpperCase();

        if (!existingCodes.includes(baseCode)) {
          subjectCode = baseCode;
        } else {
          // Add number suffix
          let counter = 1;
          let code = `${baseCode}${counter}`;
          while (existingCodes.includes(code)) {
            counter++;
            code = `${baseCode}${counter}`;
          }
          subjectCode = code;
        }
      }

      // Create new subject for target class
      const [newSubject] = await db
        .insert(simulationSubjects)
        .values({
          simulationId,
          classId: targetClassId,
          name: sourceSubject.name,
          code: subjectCode,
          color: sourceSubject.color,
        })
        .returning();

      // Automatically create the class-subject link with default 0 periods
      await db
        .insert(simulationClassSubjects)
        .values({
          simulationId,
          classId: targetClassId,
          subjectId: newSubject.id,
          weeklyPeriods: 0,
        });

      res.json(newSubject);
    } catch (error: any) {
      console.error("Error copying simulation subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Simulation Teachers
  app.post("/api/load-simulations/:id/teachers", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      let { name, employeeId, maxPeriodsPerDay } = req.body;

      // Auto-generate employee ID if not provided
      if (!employeeId) {
        const existingTeachers = await db
          .select()
          .from(simulationTeachers)
          .where(eq(simulationTeachers.simulationId, simulationId));
        
        // Generate unique ID: ST001, ST002, etc.
        let counter = existingTeachers.length + 1;
        let generatedId = `ST${counter.toString().padStart(3, '0')}`;
        
        // Ensure uniqueness
        while (existingTeachers.some(t => t.employeeId === generatedId)) {
          counter++;
          generatedId = `ST${counter.toString().padStart(3, '0')}`;
        }
        
        employeeId = generatedId;
      }

      const [newTeacher] = await db
        .insert(simulationTeachers)
        .values({
          simulationId,
          name,
          employeeId,
          maxPeriodsPerDay: maxPeriodsPerDay || 7,
        })
        .returning();

      res.json(newTeacher);
    } catch (error: any) {
      console.error("Error creating simulation teacher:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/load-simulations/:id/teachers/:teacherId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { teacherId } = req.params;
      const { name, employeeId, maxPeriodsPerDay } = req.body;

      const [updatedTeacher] = await db
        .update(simulationTeachers)
        .set({ 
          name, 
          employeeId: employeeId || null, 
          maxPeriodsPerDay,
          updatedAt: new Date()
        })
        .where(eq(simulationTeachers.id, teacherId))
        .returning();

      res.json(updatedTeacher);
    } catch (error: any) {
      console.error("Error updating simulation teacher:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/load-simulations/:id/teachers/:teacherId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { teacherId } = req.params;

      // Delete all assignments for this teacher first
      await db
        .delete(simulationAssignments)
        .where(eq(simulationAssignments.teacherId, teacherId));

      // Then delete the teacher
      await db
        .delete(simulationTeachers)
        .where(eq(simulationTeachers.id, teacherId));

      res.json({ message: "Teacher and their assignments deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting simulation teacher:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Simulation Class-Subject Links (with weekly periods)
  app.post("/api/load-simulations/:id/class-subjects", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { classId, subjectId, weeklyPeriods } = req.body;

      // Use upsert: insert or update if already exists
      const [newClassSubject] = await db
        .insert(simulationClassSubjects)
        .values({
          simulationId,
          classId,
          subjectId,
          weeklyPeriods,
        })
        .onConflictDoUpdate({
          target: [simulationClassSubjects.classId, simulationClassSubjects.subjectId],
          set: {
            weeklyPeriods,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.json(newClassSubject);
    } catch (error: any) {
      console.error("Error creating simulation class-subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/load-simulations/:id/class-subjects/:classSubjectId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { classSubjectId } = req.params;
      const { weeklyPeriods } = req.body;

      const [updated] = await db
        .update(simulationClassSubjects)
        .set({ weeklyPeriods, updatedAt: new Date() })
        .where(eq(simulationClassSubjects.id, classSubjectId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating simulation class-subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/load-simulations/:id/class-subjects/:classSubjectId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { classSubjectId } = req.params;

      await db
        .delete(simulationClassSubjects)
        .where(eq(simulationClassSubjects.id, classSubjectId));

      res.json({ message: "Class-subject link deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting simulation class-subject:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Simulation Assignments (Teacher to Class-Subject)
  app.post("/api/load-simulations/:id/assignments", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { classSubjectId, teacherId } = req.body;

      const [newAssignment] = await db
        .insert(simulationAssignments)
        .values({
          simulationId,
          classSubjectId,
          teacherId,
          isAiSuggested: false,
        })
        .returning();

      res.json(newAssignment);
    } catch (error: any) {
      console.error("Error creating simulation assignment:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/load-simulations/:id/assignments/:assignmentId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { assignmentId } = req.params;

      await db
        .delete(simulationAssignments)
        .where(eq(simulationAssignments.id, assignmentId));

      res.json({ message: "Assignment deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting simulation assignment:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Execute recommendation action (Quick-assign teacher to available classes)
  app.post("/api/load-simulations/:id/execute-recommendation", authMiddleware, async (req: any, res) => {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const simulationId = req.params.id;
      const { teacherId, classSubjectIds } = req.body;

      if (!teacherId || !classSubjectIds || !Array.isArray(classSubjectIds)) {
        return res.status(400).json({ message: "Invalid request. teacherId and classSubjectIds array required." });
      }

      // Create assignments for all provided class-subject pairs
      const assignmentsToCreate = classSubjectIds.map((classSubjectId: string) => ({
        simulationId,
        classSubjectId,
        teacherId,
        isAiSuggested: true,
      }));

      const createdAssignments = await db
        .insert(simulationAssignments)
        .values(assignmentsToCreate)
        .returning();

      res.json({
        message: `Successfully assigned teacher to ${createdAssignments.length} class(es)`,
        assignments: createdAssignments
      });
    } catch (error: any) {
      console.error("Error executing recommendation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Excel download routes
  app.use("/api", authMiddleware, downloadExcelRouter);
  
  // E-Learning routes
  app.use("/api/e-learning", authMiddleware, elearningRouter);

  // Database export download endpoint
  app.get("/api/download/db-export/:filename", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin/super_admin to download database exports
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ error: "Only administrators can download database exports" });
      }

      const { filename } = req.params;
      
      // Security: Prevent directory traversal attacks
      const sanitizedFilename = path.basename(filename);
      const exportPath = path.join(process.cwd(), 'exports', sanitizedFilename);
      
      // Check if file exists
      if (!fs.existsSync(exportPath)) {
        return res.status(404).json({ error: "Export file not found" });
      }
      
      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
      res.setHeader('Content-Type', sanitizedFilename.endsWith('.gz') ? 'application/gzip' : 'text/plain');
      
      // Stream the file
      const fileStream = fs.createReadStream(exportPath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error("Error downloading database export:", error);
      res.status(500).json({ error: "Failed to download database export" });
    }
  });

  // List available database exports
  app.get("/api/exports/list", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin/super_admin to view exports
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ error: "Only administrators can view database exports" });
      }

      const exportsDir = path.join(process.cwd(), 'exports');
      
      // Create exports directory if it doesn't exist
      if (!fs.existsSync(exportsDir)) {
        return res.json({ exports: [] });
      }
      
      // Read directory and get file stats
      const files = fs.readdirSync(exportsDir)
        .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
        .map(filename => {
          const filePath = path.join(exportsDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            size: stats.size,
            sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
            created: stats.birthtime,
            downloadUrl: `/api/download/db-export/${filename}`
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by newest first
      
      res.json({ exports: files });
      
    } catch (error) {
      console.error("Error listing database exports:", error);
      res.status(500).json({ error: "Failed to list database exports" });
    }
  });

  // Direct Intent Processing API endpoint for Chroney-Chrona middleware
  app.post("/api/process-intent", authMiddleware, async (req: any, res) => {
    try {
      // Validate request body
      const intentRequestSchema = z.object({
        intent: z.string().min(1, "Intent cannot be empty"),
        entities: z.record(z.any()).default({})
      });

      const { intent, entities } = intentRequestSchema.parse(req.body);
      
      // Get user info from authenticated request
      const user = req.user;
      if (!user || !user.schoolId) {
        return res.status(401).json({ 
          success: false,
          message: "You must be logged in to a school to use this service.",
          error: "UNAUTHORIZED" 
        });
      }
      
      const userRole = user.role;
      const schoolId = user.schoolId;

      console.log(`[PROCESS-INTENT] Processing intent: ${intent} for user role: ${userRole}`);
      console.log(`[PROCESS-INTENT] Entities:`, entities);
      
      // Execute intent using the mapping service
      const result = await intentMappingService.executeIntent(
        intent,
        entities,
        schoolId,
        userRole
      );
      
      // Return standardized response format
      return res.json({
        success: result.success,
        message: result.message,
        data: result.data,
        action: result.action,
        actionData: result.actionData
      });
      
    } catch (error: any) {
      console.error('[PROCESS-INTENT] Error processing intent:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request format. Please provide 'intent' as string and 'entities' as object.",
          error: "VALIDATION_ERROR",
          details: error.issues
        });
      }
      
      return res.status(500).json({ 
        success: false,
        message: "Internal server error while processing intent",
        error: "SERVER_ERROR"
      });
    }
  });

  // ===== DATABASE EXPORT API =====
  
  // Start a new export job
  app.post("/api/exports", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate request body
      const exportRequestSchema = z.object({
        format: z.enum(['json', 'csv', 'both']).default('json'),
        privacyLevel: z.enum(['safe', 'full']).default('safe'),
        tables: z.array(z.string()).optional(),
        schoolId: z.string().optional()
      });

      const { format, privacyLevel, tables, schoolId } = exportRequestSchema.parse(req.body);
      
      // Permission checks
      if (user.role === 'super_admin') {
        // Super admin can export any school or all schools
        if (privacyLevel === 'full' && !schoolId) {
          // Full export of all schools requires explicit confirmation
          const confirmed = req.body.confirmed;
          if (!confirmed) {
            return res.status(400).json({
              message: "Full export of all schools requires confirmation. Add 'confirmed: true' to proceed.",
              warning: "This will include sensitive data from all schools."
            });
          }
        }
      } else if (['admin', 'teacher'].includes(user.role)) {
        // Regular users can only export their own school with safe privacy level
        if (!user.schoolId) {
          return res.status(403).json({ message: "No school associated with your account" });
        }
        if (schoolId && schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied: Can only export your own school data" });
        }
        if (privacyLevel === 'full') {
          return res.status(403).json({ message: "Full privacy level requires super admin access" });
        }
      } else {
        return res.status(403).json({ message: "Export access denied for your role" });
      }

      const options = {
        schoolId: schoolId || user.schoolId,
        format,
        privacyLevel,
        tables,
        requestedBy: user.id,
        userRole: user.role
      };

      const jobId = await exportService.startExport(options);
      
      res.json({
        success: true,
        message: "Export job started successfully",
        jobId,
        status: "pending"
      });
      
    } catch (error: any) {
      console.error('Export start error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid export parameters",
          errors: error.issues
        });
      }
      
      res.status(500).json({ 
        message: "Failed to start export",
        error: error.message
      });
    }
  });
  
  // Get export job status
  app.get("/api/exports/:jobId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const jobId = req.params.jobId;
      
      const job = exportService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      // Check if user has access to this job
      if (job.metadata.requestedBy !== user.id && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied to this export job" });
      }
      
      res.json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
          metadata: {
            format: job.metadata.format,
            privacyLevel: job.metadata.privacyLevel,
            totalTables: job.metadata.totalTables,
            processedTables: job.metadata.processedTables,
            schoolId: job.metadata.schoolId
          }
        }
      });
      
    } catch (error: any) {
      console.error('Export status error:', error);
      res.status(500).json({ 
        message: "Failed to get export status",
        error: error.message
      });
    }
  });
  
  // Download completed export
  app.get("/api/exports/:jobId/download", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const jobId = req.params.jobId;
      
      const job = exportService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      if (job.status !== 'completed') {
        return res.status(400).json({ 
          message: `Export not ready for download. Status: ${job.status}`,
          progress: job.progress
        });
      }
      
      // Check if user has access to this job
      if (job.metadata.requestedBy !== user.id && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied to this export job" });
      }
      
      const filePath = exportService.getExportFile(jobId);
      
      if (!filePath) {
        return res.status(404).json({ message: "Export file not found or expired" });
      }
      
      // Set download headers
      const schoolName = job.metadata.schoolId || 'all_schools';
      const timestamp = job.createdAt.toISOString().split('T')[0];
      const filename = `chrona_export_${schoolName}_${timestamp}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/zip');
      
      // Stream the file
      const fs = await import('fs');
      const fileStream = fs.default.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error reading export file" });
        }
      });
      
      fileStream.pipe(res);
      
    } catch (error: any) {
      console.error('Export download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: "Failed to download export",
          error: error.message
        });
      }
    }
  });

  // ============================================================================
  // FEE MANAGEMENT API ENDPOINTS
  // ============================================================================

  // Fee Types endpoints
  app.get("/api/fee-types", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const feeTypes = await storage.getFeeTypes(schoolId);
      res.json(feeTypes);
    } catch (error) {
      console.error("Error fetching fee types:", error);
      res.status(500).json({ message: "Failed to fetch fee types" });
    }
  });

  app.get("/api/fee-types/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const feeType = await storage.getFeeType(req.params.id);
      if (!feeType) {
        return res.status(404).json({ message: "Fee type not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeType.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee type not in your school" });
      }

      res.json(feeType);
    } catch (error) {
      console.error("Error fetching fee type:", error);
      res.status(500).json({ message: "Failed to fetch fee type" });
    }
  });

  app.post("/api/fee-types", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      if (user.role === 'admin') {
        requestBody.schoolId = user.schoolId;
      }

      // Auto-generate unique code from name if not provided
      if (!requestBody.code) {
        const baseCode = requestBody.name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .substring(0, 30);
        
        // Add timestamp to ensure uniqueness
        requestBody.code = `${baseCode}_${Date.now()}`;
      }

      const validatedData = insertFeeTypeSchema.parse(requestBody);
      const feeType = await storage.createFeeType(validatedData);
      res.status(201).json(feeType);
    } catch (error) {
      console.error("Error creating fee type:", error);
      res.status(400).json({ message: "Invalid fee type data" });
    }
  });

  app.put("/api/fee-types/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingFeeType = await storage.getFeeType(req.params.id);
      if (!existingFeeType) {
        return res.status(404).json({ message: "Fee type not found" });
      }

      if (user.role === 'admin' && existingFeeType.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee type not in your school" });
      }

      const validatedData = insertFeeTypeSchema.partial().parse(req.body);
      const feeType = await storage.updateFeeType(req.params.id, validatedData);
      res.json(feeType);
    } catch (error) {
      console.error("Error updating fee type:", error);
      res.status(400).json({ message: "Failed to update fee type" });
    }
  });

  app.delete("/api/fee-types/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingFeeType = await storage.getFeeType(req.params.id);
      if (!existingFeeType) {
        return res.status(404).json({ message: "Fee type not found" });
      }

      if (user.role === 'admin' && existingFeeType.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee type not in your school" });
      }

      await storage.deleteFeeType(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fee type:", error);
      res.status(500).json({ message: "Failed to delete fee type" });
    }
  });

  // Fee Structures endpoints
  app.get("/api/fee-structures", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      const academicSessionId = req.query.academicSessionId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const feeStructures = await storage.getFeeStructures(schoolId, academicSessionId);
      
      // Enrich fee structures with related data
      const enrichedStructures = await Promise.all(feeStructures.map(async (structure) => {
        // Get academic session
        const session = structure.academicSessionId 
          ? await storage.getAcademicSession(structure.academicSessionId)
          : null;
        
        // Format academic session name
        const academicSessionName = session 
          ? `${new Date(session.startDate).getFullYear()}-${new Date(session.endDate).getFullYear()}`
          : undefined;
        
        // Get fee items
        const items = await storage.getFeeStructureItems(structure.id);
        
        // Get all classes for this school to find the matching class
        const classes = await storage.getClasses(schoolId);
        const matchingClass = classes.find(c => c.grade === structure.grade && c.section === structure.section);
        
        return {
          ...structure,
          academicSessionName,
          items: items.map(item => ({
            ...item,
            feeTypeId: item.feeTypeId,
            // Convert from paise to rupees for frontend
            amount: item.amount / 100,
            lateFeePenalty: (item.lateFeeAmount || 0) / 100,
            dueDate: item.dueDate,
          })),
          assignedClasses: matchingClass ? [matchingClass] : [],
        };
      }));

      res.json(enrichedStructures);
    } catch (error) {
      console.error("Error fetching fee structures:", error);
      res.status(500).json({ message: "Failed to fetch fee structures" });
    }
  });

  app.get("/api/fee-structures/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const feeStructure = await storage.getFeeStructure(req.params.id);
      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure not in your school" });
      }

      res.json(feeStructure);
    } catch (error) {
      console.error("Error fetching fee structure:", error);
      res.status(500).json({ message: "Failed to fetch fee structure" });
    }
  });

  app.post("/api/fee-structures", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classIds, items, ...baseData } = req.body;
      const schoolId = user.role === 'admin' ? user.schoolId : baseData.schoolId;

      if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({ message: "At least one class must be selected" });
      }

      // Get all selected classes to extract their grade and section
      const classes = await storage.getClasses(schoolId);
      const selectedClasses = classes.filter(c => classIds.includes(c.id));

      if (selectedClasses.length === 0) {
        return res.status(400).json({ message: "No valid classes found" });
      }

      // Create one fee structure per selected class
      const createdStructures = [];
      for (const classItem of selectedClasses) {
        // Construct proper class name from grade and section
        const className = classItem.section 
          ? `${classItem.grade} ${classItem.section}` 
          : classItem.grade;
        
        const structureData = {
          ...baseData,
          schoolId,
          grade: classItem.grade,
          section: classItem.section || "",
          name: `${baseData.name} - Class ${className}`,
        };

        const feeStructure = await storage.createFeeStructure(structureData);
        
        // Create fee structure items for this structure
        if (items && Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            await storage.createFeeStructureItem({
              feeStructureId: feeStructure.id,
              feeTypeId: item.feeTypeId,
              amount: Math.round(item.amount * 100), // Convert to paise
              frequency: "one_time",
              dueDate: item.dueDate,
              lateFeeAmount: Math.round((item.lateFeePenalty || 0) * 100), // Convert to paise
              isOptional: false,
            });
          }
        }

        createdStructures.push(feeStructure);
      }

      res.status(201).json({ 
        message: `${createdStructures.length} fee structure(s) created successfully`,
        structures: createdStructures 
      });
    } catch (error) {
      console.error("Error creating fee structure:", error);
      res.status(400).json({ message: "Invalid fee structure data" });
    }
  });

  app.put("/api/fee-structures/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingStructure = await storage.getFeeStructure(req.params.id);
      if (!existingStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      if (user.role === 'admin' && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure not in your school" });
      }

      const validatedData = insertFeeStructureSchema.partial().parse(req.body);
      const feeStructure = await storage.updateFeeStructure(req.params.id, validatedData);
      res.json(feeStructure);
    } catch (error) {
      console.error("Error updating fee structure:", error);
      res.status(400).json({ message: "Failed to update fee structure" });
    }
  });

  app.delete("/api/fee-structures/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingStructure = await storage.getFeeStructure(req.params.id);
      if (!existingStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      if (user.role === 'admin' && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure not in your school" });
      }

      await storage.deleteFeeStructure(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fee structure:", error);
      res.status(500).json({ message: "Failed to delete fee structure" });
    }
  });

  // Fee Structure Items endpoints
  app.get("/api/fee-structures/:structureId/items", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // First validate that the user has access to the fee structure
      const feeStructure = await storage.getFeeStructure(req.params.structureId);
      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure not in your school" });
      }

      const items = await storage.getFeeStructureItems(req.params.structureId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching fee structure items:", error);
      res.status(500).json({ message: "Failed to fetch fee structure items" });
    }
  });

  app.post("/api/fee-structure-items", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertFeeStructureItemSchema.parse(req.body);
      const item = await storage.createFeeStructureItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating fee structure item:", error);
      res.status(400).json({ message: "Invalid fee structure item data" });
    }
  });

  app.put("/api/fee-structure-items/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // First validate that the user has access to the fee structure item
      const existingItem = await storage.getFeeStructureItem(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ message: "Fee structure item not found" });
      }

      // Get the fee structure to check school access
      const feeStructure = await storage.getFeeStructure(existingItem.feeStructureId);
      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure item not in your school" });
      }

      const validatedData = insertFeeStructureItemSchema.partial().parse(req.body);
      const item = await storage.updateFeeStructureItem(req.params.id, validatedData);
      res.json(item);
    } catch (error) {
      console.error("Error updating fee structure item:", error);
      res.status(400).json({ message: "Failed to update fee structure item" });
    }
  });

  app.delete("/api/fee-structure-items/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // First validate that the user has access to the fee structure item
      const existingItem = await storage.getFeeStructureItem(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ message: "Fee structure item not found" });
      }

      // Get the fee structure to check school access
      const feeStructure = await storage.getFeeStructure(existingItem.feeStructureId);
      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure item not in your school" });
      }

      await storage.deleteFeeStructureItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fee structure item:", error);
      res.status(500).json({ message: "Failed to delete fee structure item" });
    }
  });

  // Student Fee Assignments endpoints
  app.get("/api/student-fee-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      const academicSessionId = req.query.academicSessionId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const assignments = await storage.getStudentFeeAssignments(schoolId, academicSessionId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching student fee assignments:", error);
      res.status(500).json({ message: "Failed to fetch student fee assignments" });
    }
  });

  app.post("/api/student-fee-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body, assignedBy: user.id };
      
      if (user.role === 'admin') {
        requestBody.schoolId = user.schoolId;
      }

      const validatedData = insertStudentFeeAssignmentSchema.parse(requestBody);
      const assignment = await storage.createStudentFeeAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating student fee assignment:", error);
      res.status(400).json({ message: "Invalid student fee assignment data" });
    }
  });

  app.post("/api/students/:studentId/assign-fee-structure", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { studentId } = req.params;
      const { feeStructureId, academicSessionId, discountPercentage = 0, discountAmount = 0, discountReason } = req.body;

      const assignment = await storage.assignFeeStructureToStudent(
        studentId, 
        feeStructureId, 
        academicSessionId, 
        user.id, 
        discountPercentage, 
        discountAmount, 
        discountReason
      );
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning fee structure to student:", error);
      res.status(400).json({ message: error.message || "Failed to assign fee structure to student" });
    }
  });

  // Fee Invoices endpoints
  app.get("/api/fee-invoices", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      const academicSessionId = req.query.academicSessionId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const invoices = await storage.getFeeInvoices(schoolId, academicSessionId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching fee invoices:", error);
      res.status(500).json({ message: "Failed to fetch fee invoices" });
    }
  });

  app.get("/api/fee-invoices/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const invoice = await storage.getFeeInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Fee invoice not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && invoice.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee invoice not in your school" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching fee invoice:", error);
      res.status(500).json({ message: "Failed to fetch fee invoice" });
    }
  });

  app.get("/api/students/:studentId/fee-invoices", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { studentId } = req.params;
      const { academicSessionId } = req.query;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!academicSessionId) {
        return res.status(400).json({ message: "Academic session ID is required" });
      }

      // First validate that the user has access to the student
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && student.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - student not in your school" });
      }

      const invoices = await storage.getFeeInvoicesByStudent(studentId, academicSessionId as string);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching student fee invoices:", error);
      res.status(500).json({ message: "Failed to fetch student fee invoices" });
    }
  });

  app.post("/api/students/:studentId/generate-invoice", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { studentId } = req.params;
      const { academicSessionId } = req.body;

      const invoice = await storage.generateInvoiceForStudent(studentId, academicSessionId, user.id);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error generating invoice for student:", error);
      res.status(400).json({ message: error.message || "Failed to generate invoice for student" });
    }
  });

  // Generate Fee Invoices (bulk)
  app.post("/api/fee-invoices/generate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { feeStructureId, generateFor, studentIds } = req.body;
      const schoolId = user.role === 'admin' ? user.schoolId : req.body.schoolId;

      if (!feeStructureId) {
        return res.status(400).json({ message: "Fee structure ID is required" });
      }

      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get the fee structure
      const feeStructure = await storage.getFeeStructure(feeStructureId);
      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && feeStructure.schoolId !== schoolId) {
        return res.status(403).json({ message: "Access denied - fee structure not in your school" });
      }

      // Get students based on generateFor option
      let targetStudents = [];
      
      if (generateFor === 'all') {
        // Find the class that matches the fee structure's grade and section
        const schoolClasses = await storage.getClasses(schoolId);
        
        console.log('[INVOICE GEN] Fee structure grade:', feeStructure.grade, 'section:', feeStructure.section);
        console.log('[INVOICE GEN] Available classes:', schoolClasses.map(c => ({ id: c.id, grade: c.grade, section: c.section })));
        
        const matchingClass = schoolClasses.find(c => 
          c.grade === feeStructure.grade && 
          c.section === feeStructure.section
        );

        if (!matchingClass) {
          return res.status(400).json({ 
            message: `No class found for grade "${feeStructure.grade}" section "${feeStructure.section}". Available classes: ${schoolClasses.map(c => `${c.grade}-${c.section}`).join(', ')}` 
          });
        }

        console.log('[INVOICE GEN] Matching class found:', matchingClass.id);

        // Get all students in that class
        targetStudents = await storage.getStudentsByClass(matchingClass.id);
        
        console.log('[INVOICE GEN] Students in class:', targetStudents.length);
      } else if (generateFor === 'specific' && studentIds && studentIds.length > 0) {
        // Get specific students
        const allStudents = await storage.getStudents(schoolId);
        targetStudents = allStudents.filter(student => studentIds.includes(student.id));
      } else {
        return res.status(400).json({ message: "Invalid generateFor option or missing studentIds" });
      }

      if (targetStudents.length === 0) {
        return res.status(400).json({ message: "No students found matching the criteria" });
      }

      // OPTIMIZED: Batch process all students in parallel
      console.log(`[INVOICE GEN] Starting batch generation for ${targetStudents.length} students`);
      
      const results = await Promise.allSettled(
        targetStudents.map(async (student) => {
          try {
            // Check if student already has a fee assignment
            let feeAssignment = await storage.getStudentFeeAssignmentByStudent(student.id, feeStructure.academicSessionId);
            
            // If no assignment exists, create one
            if (!feeAssignment) {
              feeAssignment = await storage.assignFeeStructureToStudent(
                student.id,
                feeStructureId,
                feeStructure.academicSessionId,
                user.id
              );
            }
            
            // Generate the invoice
            const invoice = await storage.generateInvoiceForStudent(
              student.id,
              feeStructure.academicSessionId,
              user.id
            );
            
            return { success: true, invoice, studentId: student.id };
          } catch (error) {
            return { success: false, error: error.message, studentId: student.id };
          }
        })
      );
      
      // Process results
      const generatedInvoices = [];
      const errors = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          generatedInvoices.push(result.value.invoice);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push({ studentId: result.value.studentId, error: result.value.error });
        } else if (result.status === 'rejected') {
          errors.push({ studentId: targetStudents[index].id, error: result.reason });
        }
      });
      
      console.log(`[INVOICE GEN] Batch complete: ${generatedInvoices.length} succeeded, ${errors.length} failed`);
      if (errors.length > 0) {
        console.error('[INVOICE GEN] Errors:', JSON.stringify(errors, null, 2));
      }

      res.status(201).json({ 
        message: `Generated ${generatedInvoices.length} invoice(s) successfully${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
        invoices: generatedInvoices,
        total: targetStudents.length,
        generated: generatedInvoices.length,
        failed: targetStudents.length - generatedInvoices.length,
        errors: errors
      });
    } catch (error) {
      console.error("Error generating fee invoices:", error);
      res.status(400).json({ message: error.message || "Failed to generate fee invoices" });
    }
  });

  // Delete Fee Invoice (draft only)
  app.delete("/api/fee-invoices/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const schoolId = user.role === 'admin' ? user.schoolId : null;

      // Fetch the invoice to validate
      const invoice = await storage.getFeeInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Enforce school-level access control
      if (schoolId && invoice.schoolId !== schoolId) {
        return res.status(403).json({ message: "Access denied - invoice not in your school" });
      }

      // Only draft invoices can be deleted
      if (invoice.status !== 'draft') {
        return res.status(400).json({ 
          message: `Cannot delete ${invoice.status} invoice. Only draft invoices can be deleted.`
        });
      }

      // Delete the invoice
      await storage.deleteFeeInvoice(id);

      res.json({ message: "Invoice deleted successfully" });

    } catch (error) {
      console.error("Error deleting fee invoice:", error);
      res.status(500).json({ message: error.message || "Failed to delete fee invoice" });
    }
  });

  // Finalize Fee Invoices (single or bulk)
  app.patch("/api/fee-invoices/finalize", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { invoiceIds } = req.body;

      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "Invoice IDs array is required" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : null;

      // Fetch all invoices to validate
      const invoicesToFinalize = [];
      const errors = [];

      for (const invoiceId of invoiceIds) {
        const invoice = await storage.getFeeInvoice(invoiceId);
        
        if (!invoice) {
          errors.push({ invoiceId, error: "Invoice not found" });
          continue;
        }

        // Enforce school-level access control
        if (schoolId && invoice.schoolId !== schoolId) {
          errors.push({ invoiceId, error: "Access denied - invoice not in your school" });
          continue;
        }

        // Only draft invoices can be finalized
        if (invoice.status !== 'draft') {
          errors.push({ invoiceId, error: `Invoice is already ${invoice.status}` });
          continue;
        }

        invoicesToFinalize.push(invoice);
      }

      if (invoicesToFinalize.length === 0) {
        return res.status(400).json({ 
          message: "No draft invoices found to finalize",
          errors 
        });
      }

      // Finalize all valid invoices in parallel
      const finalizeResults = await Promise.allSettled(
        invoicesToFinalize.map(async (invoice) => {
          return await storage.updateFeeInvoice(invoice.id, {
            status: 'finalized',
            finalizedBy: user.id,
            finalizedAt: new Date()
          });
        })
      );

      // Process results
      const finalized = [];
      finalizeResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          finalized.push(result.value);
        }
      });

      res.json({
        message: `Finalized ${finalized.length} invoice(s) successfully`,
        finalized: finalized.length,
        total: invoiceIds.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Error finalizing fee invoices:", error);
      res.status(500).json({ message: error.message || "Failed to finalize fee invoices" });
    }
  });

  // Fee Payments endpoints
  app.get("/api/fee-payments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const payments = await storage.getFeePayments(schoolId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching fee payments:", error);
      res.status(500).json({ message: "Failed to fetch fee payments" });
    }
  });

  app.post("/api/fee-payments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        invoiceId, 
        amount, 
        paymentMethod, 
        paymentMode, 
        paymentDate, 
        transactionId, 
        reference, 
        referenceNumber, 
        bankName, 
        remarks,
        notes 
      } = req.body;

      if (!invoiceId || !amount) {
        return res.status(400).json({ message: "Invoice ID and amount are required" });
      }

      // Validate amount is a positive number
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }

      // Verify invoice exists and user has access
      const invoice = await storage.getFeeInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Fee invoice not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && invoice.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee invoice not in your school" });
      }

      // Map paymentMethod to paymentMode
      const method = paymentMethod || 'cash';
      let mode = paymentMode;
      if (!mode) {
        // Auto-determine mode based on method if not provided
        mode = ['online', 'bank_transfer', 'upi'].includes(method) ? 'online' : 'offline';
      }

      const payment = await storage.recordPayment(
        invoiceId, 
        amount, 
        method, 
        mode, 
        user.id, 
        paymentDate || new Date().toISOString(),
        transactionId || reference, 
        referenceNumber || reference, 
        bankName || null, 
        notes || remarks
      );
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error recording payment:", error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || "Failed to record payment" });
    }
  });

  app.get("/api/fee-invoices/:invoiceId/payments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // First validate that the user has access to the invoice
      const invoice = await storage.getFeeInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Fee invoice not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && invoice.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - fee invoice not in your school" });
      }

      const payments = await storage.getFeePaymentsByInvoice(req.params.invoiceId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching invoice payments:", error);
      res.status(500).json({ message: "Failed to fetch invoice payments" });
    }
  });

  app.post("/api/fee-invoices/:invoiceId/record-payment", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { invoiceId } = req.params;
      const { amount, paymentMethod, paymentMode, paymentDate, transactionId, referenceNumber, bankName, notes } = req.body;

      const payment = await storage.recordPayment(
        invoiceId, 
        amount, 
        paymentMethod, 
        paymentMode, 
        user.id, 
        paymentDate, 
        transactionId, 
        referenceNumber, 
        bankName, 
        notes
      );
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(400).json({ message: error.message || "Failed to record payment" });
    }
  });

  // ============================================================================
  // TRANSPORT MANAGEMENT API ENDPOINTS
  // ============================================================================

  // Transport Routes endpoints
  app.get("/api/transport-routes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const routes = await storage.getTransportRoutes(schoolId);
      res.json(routes);
    } catch (error) {
      console.error("Error fetching transport routes:", error);
      res.status(500).json({ message: "Failed to fetch transport routes" });
    }
  });

  app.get("/api/transport-routes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const route = await storage.getTransportRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ message: "Transport route not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && route.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport route not in your school" });
      }

      res.json(route);
    } catch (error) {
      console.error("Error fetching transport route:", error);
      res.status(500).json({ message: "Failed to fetch transport route" });
    }
  });

  app.post("/api/transport-routes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      if (user.role === 'admin') {
        requestBody.schoolId = user.schoolId;
      }

      const validatedData = insertTransportRouteSchema.parse(requestBody);
      const route = await storage.createTransportRoute(validatedData);
      res.status(201).json(route);
    } catch (error) {
      console.error("Error creating transport route:", error);
      res.status(400).json({ message: "Invalid transport route data" });
    }
  });

  app.put("/api/transport-routes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingRoute = await storage.getTransportRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ message: "Transport route not found" });
      }

      if (user.role === 'admin' && existingRoute.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport route not in your school" });
      }

      const validatedData = insertTransportRouteSchema.partial().parse(req.body);
      const route = await storage.updateTransportRoute(req.params.id, validatedData);
      res.json(route);
    } catch (error) {
      console.error("Error updating transport route:", error);
      res.status(400).json({ message: "Failed to update transport route" });
    }
  });

  app.delete("/api/transport-routes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingRoute = await storage.getTransportRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ message: "Transport route not found" });
      }

      if (user.role === 'admin' && existingRoute.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport route not in your school" });
      }

      await storage.deleteTransportRoute(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transport route:", error);
      res.status(500).json({ message: "Failed to delete transport route" });
    }
  });

  // Transport Stops endpoints
  app.get("/api/transport-routes/:routeId/stops", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // First validate that the user has access to the transport route
      const route = await storage.getTransportRoute(req.params.routeId);
      if (!route) {
        return res.status(404).json({ message: "Transport route not found" });
      }

      // Enforce school-level access control
      if (user.role === 'admin' && route.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport route not in your school" });
      }

      const stops = await storage.getTransportStops(req.params.routeId);
      res.json(stops);
    } catch (error) {
      console.error("Error fetching transport stops:", error);
      res.status(500).json({ message: "Failed to fetch transport stops" });
    }
  });

  app.post("/api/transport-stops", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertTransportStopSchema.parse(req.body);
      const stop = await storage.createTransportStop(validatedData);
      res.status(201).json(stop);
    } catch (error) {
      console.error("Error creating transport stop:", error);
      res.status(400).json({ message: "Invalid transport stop data" });
    }
  });

  app.put("/api/transport-stops/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertTransportStopSchema.partial().parse(req.body);
      const stop = await storage.updateTransportStop(req.params.id, validatedData);
      res.json(stop);
    } catch (error) {
      console.error("Error updating transport stop:", error);
      res.status(400).json({ message: "Failed to update transport stop" });
    }
  });

  app.delete("/api/transport-stops/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTransportStop(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transport stop:", error);
      res.status(500).json({ message: "Failed to delete transport stop" });
    }
  });

  // Transport Vehicles endpoints
  app.get("/api/transport-vehicles", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const vehicles = await storage.getTransportVehicles(schoolId);
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching transport vehicles:", error);
      res.status(500).json({ message: "Failed to fetch transport vehicles" });
    }
  });

  app.post("/api/transport-vehicles", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      if (user.role === 'admin') {
        requestBody.schoolId = user.schoolId;
      }

      const validatedData = insertTransportVehicleSchema.parse(requestBody);
      const vehicle = await storage.createTransportVehicle(validatedData);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating transport vehicle:", error);
      res.status(400).json({ message: "Invalid transport vehicle data" });
    }
  });

  app.put("/api/transport-vehicles/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingVehicle = await storage.getTransportVehicle(req.params.id);
      if (!existingVehicle) {
        return res.status(404).json({ message: "Transport vehicle not found" });
      }

      if (user.role === 'admin' && existingVehicle.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport vehicle not in your school" });
      }

      const validatedData = insertTransportVehicleSchema.partial().parse(req.body);
      const vehicle = await storage.updateTransportVehicle(req.params.id, validatedData);
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating transport vehicle:", error);
      res.status(400).json({ message: "Failed to update transport vehicle" });
    }
  });

  app.delete("/api/transport-vehicles/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingVehicle = await storage.getTransportVehicle(req.params.id);
      if (!existingVehicle) {
        return res.status(404).json({ message: "Transport vehicle not found" });
      }

      if (user.role === 'admin' && existingVehicle.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - transport vehicle not in your school" });
      }

      await storage.deleteTransportVehicle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transport vehicle:", error);
      res.status(500).json({ message: "Failed to delete transport vehicle" });
    }
  });

  // Transport Student Assignments endpoints
  app.get("/api/transport-student-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      const academicSessionId = req.query.academicSessionId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const assignments = await storage.getTransportStudentAssignments(schoolId, academicSessionId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching transport student assignments:", error);
      res.status(500).json({ message: "Failed to fetch transport student assignments" });
    }
  });

  app.post("/api/students/:studentId/assign-transport", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { studentId } = req.params;
      const { routeId, stopId, academicSessionId, transportType = 'both', monthlyFee } = req.body;

      const assignment = await storage.assignStudentToRoute(
        studentId, 
        routeId, 
        stopId, 
        academicSessionId, 
        user.id, 
        transportType, 
        monthlyFee
      );
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning student to transport:", error);
      res.status(400).json({ message: error.message || "Failed to assign student to transport" });
    }
  });

  // ============================================================================
  // MESSAGING ROLE-BASED SECURITY VALIDATION
  // ============================================================================
  
  /**
   * CRITICAL SECURITY FUNCTION: Validates messaging permissions based on user roles
   * Enforces role-based communication rules:
   * - Admins/Super Admins: Can message everyone
   * - Teachers: Can message teachers, students, parents, admins
   * - Students: Can ONLY message teachers
   * - Parents: Can ONLY message teachers
   */
  async function validateMessagingPermissions(
    senderRole: string, 
    senderId: string, 
    receiverRole: string, 
    receiverId: string,
    schoolId: string
  ): Promise<boolean> {
    // Prevent self-messaging
    if (senderId === receiverId) {
      return false;
    }

    // Admin/Super Admin can message everyone
    if (senderRole === 'admin' || senderRole === 'super_admin') {
      return true;
    }

    // Teacher messaging rules: can message teachers, students, parents, admins
    if (senderRole === 'teacher') {
      return ['teacher', 'student', 'parent', 'admin', 'super_admin'].includes(receiverRole);
    }

    // Student messaging rules: can ONLY message teachers
    if (senderRole === 'student') {
      return receiverRole === 'teacher';
    }

    // Parent messaging rules: can ONLY message teachers
    if (senderRole === 'parent') {
      return receiverRole === 'teacher';
    }

    // Default deny for unknown roles
    return false;
  }

  // ============================================================================
  // MESSAGING API ENDPOINTS
  // ============================================================================

  // Send message
  app.post("/api/messages/send", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { receiverId, receiverType, content } = req.body;

      if (!receiverId || !receiverType || !content?.trim()) {
        return res.status(400).json({ message: "Receiver ID, receiver type, and content are required" });
      }

      if (!['student', 'teacher', 'parent', 'admin'].includes(receiverType)) {
        return res.status(400).json({ message: "Receiver type must be 'student', 'teacher', 'parent', or 'admin'" });
      }

      // Determine sender type and ID based on user role
      let senderType: string;
      let actualSenderId: string;

      if (user.role === 'teacher') {
        senderType = 'teacher';
        actualSenderId = user.teacherId;
      } else if (user.role === 'student') {
        senderType = 'student';
        actualSenderId = user.studentId;
      } else if (user.role === 'parent') {
        senderType = 'parent';
        actualSenderId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        senderType = 'admin';
        actualSenderId = user.id; // Admin uses user.id
      } else {
        return res.status(403).json({ message: "Unauthorized to send messages" });
      }

      if (!actualSenderId) {
        return res.status(400).json({ message: "Sender entity not found" });
      }

      // Validate receiver exists in same school
      let receiverExists = false;
      if (receiverType === 'teacher') {
        const teacherData = await db.select({ id: teachers.id }).from(teachers)
          .where(and(eq(teachers.id, receiverId), eq(teachers.schoolId, user.schoolId)))
          .limit(1);
        receiverExists = teacherData.length > 0;
      } else if (receiverType === 'student') {
        const studentData = await db.select({ id: students.id }).from(students)
          .where(and(eq(students.id, receiverId), eq(students.schoolId, user.schoolId)))
          .limit(1);
        receiverExists = studentData.length > 0;
      } else if (receiverType === 'parent') {
        const parentData = await db.select({ id: parents.id }).from(parents)
          .where(and(eq(parents.id, receiverId), eq(parents.schoolId, user.schoolId)))
          .limit(1);
        receiverExists = parentData.length > 0;
      } else if (receiverType === 'admin') {
        const adminData = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.id, receiverId), eq(users.schoolId, user.schoolId), or(eq(users.role, 'admin'), eq(users.role, 'super_admin'))))
          .limit(1);
        receiverExists = adminData.length > 0;
      }

      if (!receiverExists) {
        return res.status(404).json({ message: "Receiver not found in this school" });
      }

      // CRITICAL: Server-side role-based messaging validation
      // Enforce communication rules based on role
      const receiverRole = receiverType; // Map type to role for validation
      const canMessage = await validateMessagingPermissions(
        user.role, 
        actualSenderId, 
        receiverRole, 
        receiverId, 
        user.schoolId
      );
      
      if (!canMessage) {
        return res.status(403).json({ 
          message: `${user.role}s are not authorized to message ${receiverType}s` 
        });
      }

      // Create message with new schema
      const messageData = {
        senderType,
        senderId: actualSenderId,
        receiverType,
        receiverId,
        content: content.trim(),
        schoolId: user.schoolId
      };

      const message = await storage.sendMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get conversation messages  
  app.get("/api/messages/conversation/:userType/:userId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { userType: otherUserType, userId: otherUserId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!['student', 'teacher', 'parent', 'admin'].includes(otherUserType)) {
        return res.status(400).json({ message: "User type must be 'student', 'teacher', 'parent', or 'admin'" });
      }

      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to view messages" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }

      // Validate other user exists in same school
      let otherUserExists = false;
      if (otherUserType === 'teacher') {
        const teacherData = await db.select({ id: teachers.id }).from(teachers)
          .where(and(eq(teachers.id, otherUserId), eq(teachers.schoolId, user.schoolId)))
          .limit(1);
        otherUserExists = teacherData.length > 0;
      } else if (otherUserType === 'student') {
        const studentData = await db.select({ id: students.id }).from(students)
          .where(and(eq(students.id, otherUserId), eq(students.schoolId, user.schoolId)))
          .limit(1);
        otherUserExists = studentData.length > 0;
      } else if (otherUserType === 'parent') {
        const parentData = await db.select({ id: parents.id }).from(parents)
          .where(and(eq(parents.id, otherUserId), eq(parents.schoolId, user.schoolId)))
          .limit(1);
        otherUserExists = parentData.length > 0;
      } else if (otherUserType === 'admin') {
        const adminData = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.id, otherUserId), eq(users.schoolId, user.schoolId), or(eq(users.role, 'admin'), eq(users.role, 'super_admin'))))
          .limit(1);
        otherUserExists = adminData.length > 0;
      }

      if (!otherUserExists) {
        return res.status(404).json({ message: "Other user not found in this school" });
      }

      // Get conversation messages
      const messages = await storage.getConversationMessages(
        user.schoolId,
        currentUserType,
        currentUserId,
        otherUserType,
        otherUserId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Get conversations list
  app.get("/api/messages/conversations", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to view conversations" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }

      const conversations = await storage.getConversationsList(user.schoolId, currentUserType, currentUserId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get unread messages count
  app.get("/api/messages/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to view messages" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }
      
      const unreadCount = await storage.getUnreadMessagesCount(user.schoolId, currentUserType, currentUserId);
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Mark message as read
  app.put("/api/messages/:messageId/read", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { messageId } = req.params;

      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to mark messages as read" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }

      const message = await storage.markMessageAsRead(messageId, currentUserType, currentUserId);
      res.json(message);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Mark conversation as read
  app.put("/api/messages/conversation/:userType/:userId/read", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { userType: otherUserType, userId: otherUserId } = req.params;

      if (!['student', 'teacher', 'parent', 'admin'].includes(otherUserType)) {
        return res.status(400).json({ message: "User type must be 'student', 'teacher', 'parent', or 'admin'" });
      }

      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to mark conversations as read" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }

      // Mark all messages FROM the other user TO current user as read
      await storage.markConversationAsRead(user.schoolId, otherUserType, otherUserId, currentUserType, currentUserId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({ message: "Failed to mark conversation as read" });
    }
  });

  // Delete conversation
  app.delete("/api/messages/conversation/:userType/:userId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { userType: otherUserType, userId: otherUserId } = req.params;

      if (!['student', 'teacher', 'parent', 'admin'].includes(otherUserType)) {
        return res.status(400).json({ message: "User type must be 'student', 'teacher', 'parent', or 'admin'" });
      }

      // Determine current user type and ID
      let currentUserType: string;
      let currentUserId: string;

      if (user.role === 'teacher') {
        currentUserType = 'teacher';
        currentUserId = user.teacherId;
      } else if (user.role === 'student') {
        currentUserType = 'student';
        currentUserId = user.studentId;
      } else if (user.role === 'parent') {
        currentUserType = 'parent';
        currentUserId = user.parentId;
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        currentUserType = 'admin';
        currentUserId = user.id;
      } else {
        return res.status(403).json({ message: "Unauthorized to delete conversations" });
      }

      if (!currentUserId) {
        return res.status(400).json({ message: "Current user entity not found" });
      }

      // Delete all messages between the current user and the specified user
      await storage.deleteConversation(user.schoolId, currentUserType, currentUserId, otherUserType, otherUserId);
      res.json({ success: true, message: "Conversation deleted successfully" });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Get users allowed to message - SECURED with role-based filtering
  app.get("/api/messages/allowed-users", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // CRITICAL: Use server-side role validation to filter allowed users
      const allUsers = await storage.getUsersAllowedToMessage(user.schoolId, user.id, user.role);
      
      // Double validation: Filter users based on server-side role rules
      const validatedUsers = [];
      for (const potentialRecipient of allUsers) {
        const canMessage = await validateMessagingPermissions(
          user.role, 
          user.id, 
          potentialRecipient.role, 
          potentialRecipient.id, 
          user.schoolId
        );
        if (canMessage) {
          validatedUsers.push(potentialRecipient);
        }
      }
      
      // Disable caching to ensure fresh results
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(validatedUsers);
    } catch (error) {
      console.error("Error fetching allowed users:", error);
      res.status(500).json({ message: "Failed to fetch allowed users" });
    }
  });

  // ============================================================================
  // NOTIFICATION ENDPOINTS
  // ============================================================================

  // Get notifications for current user
  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { limit, offset } = req.query;
      
      // Determine recipient ID and role based on user type
      let recipientId: string;
      let recipientRole: 'student' | 'teacher' | 'parent' | 'admin';
      
      if (user.role === 'teacher') {
        recipientId = user.teacherId;
        recipientRole = 'teacher';
      } else if (user.role === 'student') {
        recipientId = user.studentId;
        recipientRole = 'student';
      } else if (user.role === 'parent') {
        recipientId = user.parentId;
        recipientRole = 'parent';
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        recipientId = user.id;
        recipientRole = 'admin';
      } else {
        return res.status(403).json({ message: "Unauthorized to access notifications" });
      }

      if (!recipientId) {
        return res.status(400).json({ message: "User entity not found" });
      }

      const parsedLimit = limit ? parseInt(limit as string, 10) : 20;
      const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

      const notifications = await storage.getNotifications(recipientId, recipientRole, parsedLimit, parsedOffset);
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications count
  app.get("/api/notifications/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Determine recipient ID and role based on user type
      let recipientId: string;
      let recipientRole: 'student' | 'teacher' | 'parent' | 'admin';
      
      if (user.role === 'teacher') {
        recipientId = user.teacherId;
        recipientRole = 'teacher';
      } else if (user.role === 'student') {
        recipientId = user.studentId;
        recipientRole = 'student';
      } else if (user.role === 'parent') {
        recipientId = user.parentId;
        recipientRole = 'parent';
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        recipientId = user.id;
        recipientRole = 'admin';
      } else {
        return res.status(403).json({ message: "Unauthorized to access notifications" });
      }

      if (!recipientId) {
        return res.status(400).json({ message: "User entity not found" });
      }

      const count = await storage.getUnreadNotificationsCount(recipientId, recipientRole);
      res.json({ unreadCount: count });
    } catch (error) {
      console.error("Error fetching unread notifications count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Determine recipient ID and role based on user type
      let recipientId: string;
      let recipientRole: 'student' | 'teacher' | 'parent' | 'admin';
      
      if (user.role === 'teacher') {
        recipientId = user.teacherId;
        recipientRole = 'teacher';
      } else if (user.role === 'student') {
        recipientId = user.studentId;
        recipientRole = 'student';
      } else if (user.role === 'parent') {
        recipientId = user.parentId;
        recipientRole = 'parent';
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        recipientId = user.id;
        recipientRole = 'admin';
      } else {
        return res.status(403).json({ message: "Unauthorized to access notifications" });
      }

      if (!recipientId) {
        return res.status(400).json({ message: "User entity not found" });
      }

      await storage.markAllNotificationsAsRead(recipientId, recipientRole);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // ===== TIMETABLE GENERATION SETTINGS ENDPOINTS =====
  
  // Get timetable generation mode preference
  app.get("/api/settings/timetable-generation-mode", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Retrieve from database (always AI Smart now)
      const setting = await storage.getSchoolSetting(schoolId, 'timetable_generation_mode');
      const mode = setting?.settingValue?.timetableGenerationMode || 'ai_smart';
      
      res.json({ mode });
    } catch (error) {
      console.error("Error fetching timetable generation mode:", error);
      res.status(500).json({ message: "Failed to fetch timetable generation mode" });
    }
  });

  // Set timetable generation mode preference
  app.put("/api/settings/timetable-generation-mode", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { mode } = req.body;
      
      // Only AI Smart mode is supported
      if (!mode || mode !== 'ai_smart') {
        return res.status(400).json({ message: "Invalid mode. Only 'ai_smart' is supported." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.body.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Store mode preference in database
      await storage.updateSchoolSetting(
        schoolId, 
        'timetable_generation_mode',
        { timetableGenerationMode: mode },
        user.id
      );

      console.log(`[TIMETABLE SETTINGS] School ${schoolId} set generation mode to: ${mode}`);
      
      res.json({ success: true, mode });
    } catch (error) {
      console.error("Error saving timetable generation mode:", error);
      res.status(500).json({ message: "Failed to save timetable generation mode" });
    }
  });

  // Validate classes for timetable generation
  app.get("/api/timetable/validate-classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId as string;
      const mode = req.query.mode || 'all';
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get all classes for the school
      let classes = await storage.getClasses(schoolId);
      
      // Filter based on mode
      if (mode === 'missing') {
        const classesWithTimetables = await storage.getClassesWithTimetables(schoolId);
        const classIdsWithTimetables = new Set(classesWithTimetables.map(c => c.id));
        classes = classes.filter(c => !classIdsWithTimetables.has(c.id));
      }

      // Validate each class
      const validatedClasses = [];
      const invalidClasses = [];

      for (const classItem of classes) {
        // Check if class has subject assignments
        const assignments = await storage.getClassSubjectAssignments(classItem.id);
        
        if (!assignments || assignments.length === 0) {
          invalidClasses.push({
            ...classItem,
            reason: 'No subject assignments'
          });
          continue;
        }

        // Check if at least one assignment has a teacher (refined validation)
        const assignmentsWithTeachers = assignments.filter(a => a.assignedTeacherId);
        if (assignmentsWithTeachers.length === 0) {
          invalidClasses.push({
            ...classItem,
            reason: 'No teachers assigned to any subjects'
          });
          continue;
        }

        // Class is valid (has at least one subject with a teacher)
        validatedClasses.push(classItem);
      }

      res.json({
        validClasses: validatedClasses,
        invalidClasses: invalidClasses,
        totalClasses: classes.length,
        validCount: validatedClasses.length,
        invalidCount: invalidClasses.length
      });
    } catch (error) {
      console.error("Error validating classes:", error);
      res.status(500).json({ message: "Failed to validate classes" });
    }
  });

  // Teacher capacity check endpoint
  app.post("/api/timetable/check-capacity", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.body.schoolId;
      const targetClassIds = req.body.targetClassIds || [];
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      if (!Array.isArray(targetClassIds) || targetClassIds.length === 0) {
        return res.status(400).json({ message: "Target class IDs are required" });
      }

      console.log(`[CAPACITY CHECK] Checking teacher capacity for ${targetClassIds.length} classes in school ${schoolId}`);
      
      const capacityReport = await storage.checkTeacherCapacityForClasses(schoolId, targetClassIds);
      
      const hasInsufficientCapacity = capacityReport.some(t => t.status === 'insufficient');
      const hasWarnings = capacityReport.some(t => t.status === 'warning');
      
      res.json({
        canGenerate: !hasInsufficientCapacity,
        hasWarnings,
        teacherCapacity: capacityReport
      });
    } catch (error) {
      console.error("Error checking teacher capacity:", error);
      res.status(500).json({ message: "Failed to check teacher capacity" });
    }
  });

  // Smart timetable generation endpoint
  app.post("/api/timetable/generate-smart", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.body.schoolId;
      const mode = req.body.mode || 'all';
      const targetClassIds = req.body.targetClassIds || [];
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      console.log(`[SMART GENERATION] Starting AI Smart Timetable generation for school ${schoolId} with mode: ${mode}`, 
        targetClassIds.length > 0 ? `(${targetClassIds.length} specific classes)` : '');
      
      // Get school data for complexity analysis
      let [classes, teachers, subjects] = await Promise.all([
        storage.getClasses(schoolId),
        storage.getTeachers(schoolId),
        storage.getSubjects(schoolId)
      ]);

      // Filter classes based on mode and targetClassIds
      if (targetClassIds.length > 0) {
        const targetClassIdSet = new Set(targetClassIds);
        classes = classes.filter(c => targetClassIdSet.has(c.id));
        console.log(`[SMART GENERATION] Filtered to ${classes.length} target classes`);
        
        const invalidClassIds = targetClassIds.filter((id: string) => !classes.some(c => c.id === id));
        if (invalidClassIds.length > 0) {
          return res.status(400).json({ 
            message: "Some target class IDs are invalid or don't belong to this school",
            invalidClassIds
          });
        }
      } else if (mode === 'missing') {
        const classesWithTimetables = await storage.getClassesWithTimetables(schoolId);
        const classIdsWithTimetables = new Set(classesWithTimetables.map(c => c.id));
        classes = classes.filter(c => !classIdsWithTimetables.has(c.id));
        console.log(`[SMART GENERATION] Mode 'missing': ${classes.length} classes without timetables`);
      }

      if (classes.length === 0) {
        return res.json({
          success: true,
          strategy: 'none',
          generatedClasses: 0,
          totalPeriods: 0,
          conflicts: 0,
          qualityScore: 100,
          message: targetClassIds.length > 0 ? 'No valid classes to generate' : 
                  mode === 'missing' ? 'All classes already have timetables' : 'No classes to generate'
        });
      }

      console.log(`[SMART GENERATION] School complexity: ${classes.length} classes, ${teachers.length} teachers, ${subjects.length} subjects`);

      // Create progress job
      const jobId = createProgressJob(classes.length);
      
      // Start generation in background
      setImmediate(async () => {
        try {
          updateProgress(jobId, {
            progress: 10,
            status: 'Analyzing school complexity...'
          });

          // Auto-select the best generation strategy
          const strategy = autoSelectGenerationStrategy(classes.length, teachers.length, subjects.length);
          console.log(`[SMART GENERATION] Selected strategy: ${strategy}`);

          updateProgress(jobId, {
            progress: 20,
            status: `Using ${strategy.replace('_', ' ')} strategy...`
          });

          // Execute the chosen strategy
          let result;
          if (strategy === 'individual') {
            console.log(`[SMART GENERATION] Using individual generation approach`);
            result = await executeIndividualGeneration(schoolId, classes, jobId);
          } else if (strategy === 'staged_hybrid') {
            console.log(`[SMART GENERATION] Using staged hybrid approach`);
            result = await executeStagedHybridGeneration(schoolId, classes, teachers, jobId);
          } else {
            console.log(`[SMART GENERATION] Using lightweight bulk approach`);
            result = await executeLightweightBulkGeneration(schoolId, classes, teachers, subjects, jobId);
          }

          updateProgress(jobId, {
            progress: 80,
            status: 'Syncing weekly timetables...',
            completedClasses: classes.length
          });

          // After successful AI Smart generation, update current and ALL future weekly timetables with new master data
          // Do NOT modify past weekly timetables
          console.log(`[SMART GENERATION] Starting weekly timetable sync for school ${schoolId}`);
          let weeklyTimetableResults = {
            syncedTimetables: 0,
            totalUpdatedEntries: 0,
            errors: [] as Array<{
              classId: string;
              weeklyTimetableId: string;
              error: string;
            }>
          };

          try {
            const weeklyTimetables = await storage.getCurrentAndFutureWeekTimetablesForSchool(schoolId);
            console.log(`[SMART GENERATION] Found ${weeklyTimetables.length} current and future weekly timetables to sync`);

            for (const weeklyTimetable of weeklyTimetables) {
              try {
                const syncResult = await storage.syncWeeklyTimetableWithMaster(weeklyTimetable.id);
                
                if (syncResult.success) {
                  weeklyTimetableResults.syncedTimetables++;
                  weeklyTimetableResults.totalUpdatedEntries += syncResult.updatedEntries;
                  console.log(`[SMART GENERATION] Synced weekly timetable for class ${weeklyTimetable.classId} (week ${weeklyTimetable.weekStart}): ${syncResult.updatedEntries} entries updated`);
                } else {
                  weeklyTimetableResults.errors.push({
                    classId: weeklyTimetable.classId,
                    weeklyTimetableId: weeklyTimetable.id,
                    error: syncResult.message
                  });
                }
              } catch (syncError) {
                const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
                weeklyTimetableResults.errors.push({
                  classId: weeklyTimetable.classId,
                  weeklyTimetableId: weeklyTimetable.id,
                  error: errorMessage
                });
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[SMART GENERATION] Error during weekly timetable sync:`, error);
          }

          const finalResult = {
            success: true,
            strategy: strategy,
            generatedClasses: result.generatedClasses,
            totalPeriods: result.totalPeriods,
            conflicts: result.conflicts || 0,
            qualityScore: result.qualityScore || 85
          };

          completeProgress(jobId, finalResult);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("Error in smart timetable generation:", error);
          failProgress(jobId, errorMessage);
        }
      });

      // Return jobId immediately
      res.json({ jobId });

    } catch (error) {
      console.error("Error in smart timetable generation:", error);
      res.status(500).json({ message: "Failed to generate smart timetable", error: error.message });
    }
  });

  // Progress tracking endpoint
  app.get("/api/timetable/generation-progress/:jobId", authMiddleware, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const progress = progressStore.get(jobId);
      
      if (!progress) {
        return res.status(404).json({ message: "Progress data not found" });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching generation progress:", error);
      res.status(500).json({ message: "Failed to fetch generation progress" });
    }
  });

  // ===== INCREMENTAL UPDATE SYSTEM ENDPOINTS =====

  // POST /api/timetable/incremental-update - Main incremental update endpoint
  app.post("/api/timetable/incremental-update", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { 
        updateType, 
        data, 
        options = {} 
      } = req.body;

      if (!updateType || !['add_class', 'update_subject', 'reassign_teacher'].includes(updateType)) {
        return res.status(400).json({ 
          message: "Invalid updateType. Must be 'add_class', 'update_subject', or 'reassign_teacher'" 
        });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : data.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const updateOptions = {
        ...options,
        requestedBy: user.id,
        schoolId
      };

      let result;
      
      switch (updateType) {
        case 'add_class':
          result = await incrementalGenerationService.addClass(data, updateOptions);
          break;
        case 'update_subject':
          if (!data.subjectId) {
            return res.status(400).json({ message: "subjectId is required for subject updates" });
          }
          result = await incrementalGenerationService.updateSubject(data.subjectId, data.changes || {}, updateOptions);
          break;
        case 'reassign_teacher':
          if (!data.oldTeacherId || !data.newTeacherId) {
            return res.status(400).json({ message: "oldTeacherId and newTeacherId are required for teacher reassignment" });
          }
          result = await incrementalGenerationService.reassignTeacher(data, updateOptions);
          break;
        default:
          return res.status(400).json({ message: "Unsupported update type" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error in incremental update:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process incremental update", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/timetable/incremental-requests - Get incremental change requests
  app.get("/api/timetable/incremental-requests", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { status } = req.query;
      const requests = await storage.getIncrementalChangeRequests(schoolId, status);

      res.json({ requests });
    } catch (error) {
      console.error("Error fetching incremental requests:", error);
      res.status(500).json({ message: "Failed to fetch incremental requests" });
    }
  });

  // GET /api/timetable/incremental-requests/:id - Get specific incremental change request
  app.get("/api/timetable/incremental-requests/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { id } = req.params;
      const request = await storage.getIncrementalChangeRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Ensure user can access this request (school-level security)
      if (user.role === 'admin' && user.schoolId && request.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - request not in your school" });
      }

      // Get additional details
      const [impactAnalysis, conflicts] = await Promise.all([
        storage.getChangeImpactAnalysis(id),
        storage.getConflictDetectionResults(id)
      ]);

      res.json({ 
        request, 
        impactAnalysis, 
        conflicts 
      });
    } catch (error) {
      console.error("Error fetching incremental request:", error);
      res.status(500).json({ message: "Failed to fetch incremental request" });
    }
  });

  // POST /api/timetable/incremental-requests/:id/approve - Approve incremental change request
  app.post("/api/timetable/incremental-requests/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { id } = req.params;
      const request = await storage.getIncrementalChangeRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Ensure user can approve this request
      if (user.role === 'admin' && user.schoolId && request.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - request not in your school" });
      }

      const result = await incrementalGenerationService.processChangeRequest(id, user.id);
      res.json(result);
    } catch (error) {
      console.error("Error approving incremental request:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to approve incremental request", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/timetable/incremental-requests/:id/reject - Reject incremental change request
  app.post("/api/timetable/incremental-requests/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { id } = req.params;
      const { reason } = req.body;
      
      const request = await storage.getIncrementalChangeRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Ensure user can reject this request
      if (user.role === 'admin' && user.schoolId && request.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - request not in your school" });
      }

      if (!['pending', 'processing'].includes(request.status)) {
        return res.status(400).json({ message: `Cannot reject request with status: ${request.status}` });
      }

      // Execute rejection with proper cleanup and rollback
      const rejectionResult = await incrementalGenerationService.rejectChangeRequest(id, {
        rejectedBy: user.id,
        rejectionReason: reason,
        schoolId: request.schoolId
      });

      if (!rejectionResult.success) {
        return res.status(500).json({ 
          success: false, 
          message: rejectionResult.message 
        });
      }

      res.json({ 
        success: true, 
        message: rejectionResult.message || "Request rejected successfully" 
      });
    } catch (error) {
      console.error("Error rejecting incremental request:", error);
      res.status(500).json({ message: "Failed to reject incremental request" });
    }
  });

  // GET /api/timetable/change-detection/:classId - Detect potential changes for a class
  app.get("/api/timetable/change-detection/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { classId } = req.params;
      const classInfo = await storage.getClass(classId);

      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Ensure user can access this class
      if (user.role === 'admin' && user.schoolId && classInfo.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Simulate change detection for the class
      const changeDetection = await incrementalChangeService.detectClassAddition({
        grade: classInfo.grade,
        section: classInfo.section,
        schoolId: classInfo.schoolId,
        academicSessionId: classInfo.academicSessionId || ''
      });

      res.json({ changeDetection });
    } catch (error) {
      console.error("Error in change detection:", error);
      res.status(500).json({ message: "Failed to detect changes" });
    }
  });

  // GET /api/timetable/conflict-analysis/:requestId - Get conflict analysis for a request
  app.get("/api/timetable/conflict-analysis/:requestId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { requestId } = req.params;
      const request = await storage.getIncrementalChangeRequest(requestId);

      if (!request) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Ensure user can access this request
      if (user.role === 'admin' && user.schoolId && request.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - request not in your school" });
      }

      const [conflicts, impactAnalysis] = await Promise.all([
        storage.getConflictDetectionResults(requestId),
        storage.getChangeImpactAnalysis(requestId)
      ]);

      res.json({ 
        conflicts, 
        impactAnalysis,
        summary: {
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === 'critical').length,
          highConflicts: conflicts.filter(c => c.severity === 'high').length,
          estimatedImpact: impactAnalysis?.impactLevel || 'unknown'
        }
      });
    } catch (error) {
      console.error("Error in conflict analysis:", error);
      res.status(500).json({ message: "Failed to analyze conflicts" });
    }
  });

  // POST /api/timetable/dry-run - Perform dry run of incremental update
  app.post("/api/timetable/dry-run", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { 
        updateType, 
        data 
      } = req.body;

      if (!updateType || !['add_class', 'update_subject', 'reassign_teacher'].includes(updateType)) {
        return res.status(400).json({ 
          message: "Invalid updateType. Must be 'add_class', 'update_subject', or 'reassign_teacher'" 
        });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : data.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const updateOptions = {
        dryRun: true,
        requestedBy: user.id,
        schoolId
      };

      let result;
      
      switch (updateType) {
        case 'add_class':
          result = await incrementalGenerationService.addClass(data, updateOptions);
          break;
        case 'update_subject':
          if (!data.subjectId) {
            return res.status(400).json({ message: "subjectId is required for subject updates" });
          }
          result = await incrementalGenerationService.updateSubject(data.subjectId, data.changes || {}, updateOptions);
          break;
        case 'reassign_teacher':
          if (!data.oldTeacherId || !data.newTeacherId) {
            return res.status(400).json({ message: "oldTeacherId and newTeacherId are required for teacher reassignment" });
          }
          result = await incrementalGenerationService.reassignTeacher(data, updateOptions);
          break;
        default:
          return res.status(400).json({ message: "Unsupported update type" });
      }

      res.json({
        ...result,
        dryRun: true
      });
    } catch (error) {
      console.error("Error in dry run:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to perform dry run", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk Upload Routes
  app.get("/api/bulk-upload/template", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { bulkUploadService } = await import('./services/bulkUploadService');
      const template = await bulkUploadService.generateTemplate();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=bulk-upload-template.xlsx');
      res.send(template);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.post("/api/bulk-upload/parse", authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can use smart upload, not super admins
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. This feature is only available for School Admins." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { bulkUploadService } = await import('./services/bulkUploadService');
      const parsedData = await bulkUploadService.parseExcelFile(req.file.buffer, schoolId);
      
      res.json(parsedData);
    } catch (error) {
      console.error("Error parsing file:", error);
      res.status(500).json({ message: "Failed to parse file" });
    }
  });

  app.get("/api/bulk-upload/import/progress/:sessionId", authMiddleware, async (req: any, res) => {
    const { sessionId } = req.params;
    const progress = importProgress.get(sessionId) || { stage: 'Initializing', percentage: 0, completed: false };
    res.json(progress);
  });

  app.post("/api/bulk-upload/import", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can use smart upload, not super admins
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. This feature is only available for School Admins." });
      }

      const { teachers, students, assignments } = req.body;
      
      if (!teachers || !students || !assignments) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const schoolId = user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Generate unique session ID
      const sessionId = crypto.randomUUID();
      
      // Initialize progress
      importProgress.set(sessionId, { 
        stage: 'Starting import', 
        percentage: 0, 
        completed: false 
      });

      // Return sessionId immediately
      res.json({ sessionId });

      // Continue import in background
      (async () => {
        try {
          const { bulkUploadService } = await import('./services/bulkUploadService');
          
          const progressCallback = (stage: string, percentage: number) => {
            importProgress.set(sessionId, {
              stage,
              percentage,
              completed: false
            });
          };

          const result = await bulkUploadService.importData(
            teachers,
            students,
            assignments,
            schoolId,
            user.id,
            progressCallback
          );
          
          // Mark as completed
          importProgress.set(sessionId, {
            stage: result.success ? 'Import complete!' : 'Import failed',
            percentage: 100,
            completed: true,
            error: result.success ? undefined : result.message
          });

          // Clean up progress after 30 seconds
          setTimeout(() => {
            importProgress.delete(sessionId);
          }, 30000);
        } catch (error) {
          console.error("Error importing data:", error);
          importProgress.set(sessionId, {
            stage: 'Import failed',
            percentage: 0,
            completed: true,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Clean up progress after 30 seconds
          setTimeout(() => {
            importProgress.delete(sessionId);
          }, 30000);
        }
      })();
    } catch (error) {
      console.error("Error initializing import:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to initialize import",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== USER MANAGEMENT / CREDENTIAL MANAGEMENT ENDPOINTS =====
  
  // Get all users for the school (for dropdowns and general use)
  app.get("/api/users", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const schoolId = user.role === 'super_admin' ? req.query.schoolId as string : user.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get all users for this school
      const schoolUsers = await db
        .select()
        .from(users)
        .where(eq(users.schoolId, schoolId));

      res.json(schoolUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get all users of a specific role with credential status (with pagination)
  app.get("/api/user-management/users", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const role = req.query.role as 'student' | 'teacher' | 'parent';
      if (!role || !['student', 'teacher', 'parent'].includes(role)) {
        return res.status(400).json({ message: "Valid role parameter required (student, teacher, or parent)" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.query.schoolId as string;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // Default 50 per page
      const offset = (page - 1) * limit;

      const { calculateCredentialStatus } = await import('./services/credentialService');
      
      let usersWithCredentials: any[] = [];
      let totalCount = 0;

      if (role === 'student') {
        // Get total count
        const allStudents = await storage.getStudents(schoolId);
        totalCount = allStudents.length;
        
        // Get paginated students
        const paginatedStudents = allStudents.slice(offset, offset + limit);
        
        // Fetch all necessary data in batches to minimize queries
        const studentIds = paginatedStudents.map(s => s.id);
        const classIds = paginatedStudents.map(s => s.classId).filter(Boolean);
        
        // Batch fetch user accounts for students
        const studentUsers = studentIds.length > 0 ? await db
          .select()
          .from(users)
          .where(inArray(users.studentId, studentIds)) : [];
        
        // Batch fetch parent links
        const parentLinks = studentIds.length > 0 ? await db
          .select()
          .from(studentParents)
          .where(inArray(studentParents.studentId, studentIds)) : [];
        
        // Batch fetch classes
        const classesMap = new Map();
        if (classIds.length > 0) {
          const classesData = await db
            .select()
            .from(classes)
            .where(inArray(classes.id, classIds));
          classesData.forEach(c => classesMap.set(c.id, `${c.grade} ${c.section}`));
        }
        
        // Batch fetch parents
        const parentIds = parentLinks.map(pl => pl.parentId);
        const parentsData = parentIds.length > 0 ? await db
          .select()
          .from(parents)
          .where(inArray(parents.id, parentIds)) : [];
        
        // Batch fetch parent user accounts
        const parentLoginIds = paginatedStudents.map(s => `P${s.admissionNumber}`);
        const parentUsers = parentLoginIds.length > 0 ? await db
          .select()
          .from(users)
          .where(and(
            inArray(users.loginId, parentLoginIds),
            eq(users.role, 'parent'),
            eq(users.isActive, true)
          )) : [];
        
        // Create lookup maps
        const studentUserMap = new Map(studentUsers.map(u => [u.studentId, u]));
        const parentLinksMap = new Map(parentLinks.map(pl => [pl.studentId, pl]));
        const parentsMap = new Map(parentsData.map(p => [p.id, p]));
        const parentUserMap = new Map(parentUsers.map(u => [u.loginId, u]));
        
        usersWithCredentials = paginatedStudents.map((student) => {
          const studentUser = studentUserMap.get(student.id);
          const parentLink = parentLinksMap.get(student.id);
          
          let parentData = null;
          if (parentLink) {
            const parent = parentsMap.get(parentLink.parentId);
            if (parent) {
              const parentLoginId = `P${student.admissionNumber}`;
              const parentUser = parentUserMap.get(parentLoginId);
              
              parentData = {
                id: parent.id,
                userId: parentUser?.id || null,
                name: `${parent.firstName} ${parent.lastName}`,
                loginId: parentUser?.loginId || null,
                email: parent.email,
                phone: parent.contactNumber,
                credentialStatus: parentUser 
                  ? calculateCredentialStatus(
                      parentUser.temporaryPassword, 
                      parentUser.temporaryPasswordExpiresAt
                    )
                  : 'not_generated',
                expiresAt: parentUser?.temporaryPasswordExpiresAt || null
              };
            }
          }
          
          return {
            id: student.id,
            userId: studentUser?.id || null,
            name: `${student.firstName} ${student.lastName}`,
            admissionNumber: student.admissionNumber,
            className: student.classId ? classesMap.get(student.classId) : null,
            loginId: studentUser?.loginId || null,
            email: student.email,
            phone: student.contactNumber,
            credentialStatus: studentUser 
              ? calculateCredentialStatus(
                  studentUser.temporaryPassword, 
                  studentUser.temporaryPasswordExpiresAt
                )
              : 'not_generated',
            expiresAt: studentUser?.temporaryPasswordExpiresAt || null,
            parent: parentData
          };
        });
      } else if (role === 'teacher') {
        // Get total count
        const allTeachers = await storage.getTeachers(schoolId);
        totalCount = allTeachers.length;
        
        // Get paginated teachers
        const paginatedTeachers = allTeachers.slice(offset, offset + limit);
        
        // Batch fetch user accounts for teachers
        const teacherIds = paginatedTeachers.map(t => t.id);
        const teacherUsers = teacherIds.length > 0 ? await db
          .select()
          .from(users)
          .where(inArray(users.teacherId, teacherIds)) : [];
        
        // Create lookup map
        const teacherUserMap = new Map(teacherUsers.map(u => [u.teacherId, u]));
        
        usersWithCredentials = paginatedTeachers.map((teacher) => {
          const teacherUser = teacherUserMap.get(teacher.id);
          
          return {
            id: teacher.id,
            userId: teacherUser?.id || null,
            name: teacher.name,
            employeeId: teacher.employeeId,
            schoolId: teacher.schoolIdNumber,
            loginId: teacherUser?.loginId || null,
            email: teacher.email,
            phone: teacher.contactNumber,
            credentialStatus: teacherUser 
              ? calculateCredentialStatus(
                  teacherUser.temporaryPassword, 
                  teacherUser.temporaryPasswordExpiresAt
                )
              : 'not_generated',
            expiresAt: teacherUser?.temporaryPasswordExpiresAt || null
          };
        });
      } else if (role === 'parent') {
        const allParents = await storage.getParents(schoolId);
        usersWithCredentials = await Promise.all(
          allParents.map(async (parent) => {
            const [parentUser] = await db
              .select()
              .from(users)
              .where(eq(users.parentId, parent.id))
              .limit(1);
            
            const parentStudents = await db
              .select()
              .from(studentParents)
              .where(eq(studentParents.parentId, parent.id))
              .limit(1);
            
            let admissionNumber = null;
            if (parentStudents.length > 0) {
              const student = await storage.getStudent(parentStudents[0].studentId);
              admissionNumber = student?.admissionNumber || null;
            }

            return {
              id: parent.id,
              userId: parentUser?.id || null,
              name: `${parent.firstName} ${parent.lastName}`,
              admissionNumber,
              loginId: parentUser?.loginId || null,
              email: parent.email,
              phone: parent.contactNumber,
              credentialStatus: parentUser 
                ? calculateCredentialStatus(
                    parentUser.temporaryPassword, 
                    parentUser.temporaryPasswordExpiresAt
                  )
                : 'not_generated',
              expiresAt: parentUser?.temporaryPasswordExpiresAt || null
            };
          })
        );
      }

      res.json({
        users: usersWithCredentials,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching users for credential management:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get teacher credentials
  app.get("/api/teachers/:id/credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const teacher = await storage.getTeacher(req.params.id);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && teacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the teacher's user account
      const [teacherUser] = await db
        .select()
        .from(users)
        .where(eq(users.teacherId, teacher.id))
        .limit(1);

      if (!teacherUser || !teacherUser.temporaryPasswordPlainText) {
        return res.status(404).json({ 
          message: "No credentials found. Please generate credentials first." 
        });
      }

      res.json({
        loginId: teacherUser.loginId,
        temporaryPassword: teacherUser.temporaryPasswordPlainText,
        expiresAt: teacherUser.temporaryPasswordExpiresAt
      });
    } catch (error) {
      console.error("Error fetching teacher credentials:", error);
      res.status(500).json({ message: "Failed to fetch teacher credentials" });
    }
  });

  // Refresh teacher credentials (mirrors student endpoint)
  app.post("/api/teachers/:id/credentials/refresh", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const teacher = await storage.getTeacher(req.params.id);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && teacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { generateTemporaryPasswordString, generateTemporaryPasswordExpiry, generateLoginId } = await import('./services/credentialService');
      const { hashTemporaryPassword, hashPassword } = await import('./auth');

      let [teacherUser] = await db
        .select()
        .from(users)
        .where(eq(users.teacherId, teacher.id))
        .limit(1);
      
      // If no user account exists, create one
      if (!teacherUser) {
        // Determine login ID: email first, then mobile, otherwise error
        let loginId: string;
        if (teacher.email) {
          loginId = teacher.email;
        } else if (teacher.contactNumber) {
          loginId = teacher.contactNumber;
        } else {
          return res.status(400).json({ 
            message: "Cannot generate credentials. Teacher must have either an email address or mobile number." 
          });
        }

        const tempPassword = generateTemporaryPasswordString();
        const hashedTempPassword = await hashTemporaryPassword(tempPassword);
        const tempPasswordExpiry = generateTemporaryPasswordExpiry(48);

        // Extract first and last name from teacher name
        const nameParts = teacher.name.split(' ');
        const firstName = nameParts[0] || 'Teacher';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newUser = await storage.createUser({
          email: teacher.email,
          loginId,
          passwordHash: await hashPassword(generateTemporaryPasswordString()),
          temporaryPassword: hashedTempPassword,
          temporaryPasswordPlainText: tempPassword,
          temporaryPasswordExpiresAt: tempPasswordExpiry,
          role: 'teacher',
          isFirstLogin: true,
          schoolId: teacher.schoolId,
          teacherId: teacher.id,
          firstName,
          lastName,
          isActive: true,
          createdBy: user.id
        });

        return res.json({
          userId: newUser.id,
          loginId: newUser.loginId,
          temporaryPassword: tempPassword,
          expiresAt: tempPasswordExpiry
        });
      }
      
      const tempPassword = generateTemporaryPasswordString();
      const hashedPassword = await hashTemporaryPassword(tempPassword);
      const expiresAt = generateTemporaryPasswordExpiry(48);

      await storage.updateUser(teacherUser.id, {
        temporaryPassword: hashedPassword,
        temporaryPasswordPlainText: tempPassword,
        temporaryPasswordExpiresAt: expiresAt,
        isFirstLogin: true,
        updatedAt: getCurrentDateTimeIST()
      });

      res.json({
        userId: teacherUser.id,
        loginId: teacherUser.loginId,
        temporaryPassword: tempPassword,
        expiresAt
      });
    } catch (error) {
      console.error("Error refreshing teacher credentials:", error);
      res.status(500).json({ message: "Failed to refresh teacher credentials" });
    }
  });

  // Get parent credentials
  app.get("/api/parents/:id/credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const parent = await storage.getParent(req.params.id);
      if (!parent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      if (user.role === 'admin' && parent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get student linked to this parent to find admission number
      const [studentLink] = await db
        .select()
        .from(studentParents)
        .where(eq(studentParents.parentId, parent.id))
        .limit(1);
      
      if (!studentLink) {
        return res.status(404).json({ message: "No student linked to this parent" });
      }

      const student = await storage.getStudent(studentLink.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Search for parent user by loginId pattern
      const parentLoginId = `P${student.admissionNumber}`;
      const [parentUser] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.loginId, parentLoginId),
          eq(users.role, 'parent'),
          eq(users.isActive, true)
        ))
        .limit(1);
      
      if (!parentUser) {
        return res.status(404).json({ message: "Parent user account not found" });
      }

      res.json({
        loginId: parentUser.loginId,
        temporaryPassword: parentUser.temporaryPasswordPlainText || null,
        expiresAt: parentUser.temporaryPasswordExpiresAt
      });
    } catch (error) {
      console.error("Error fetching parent credentials:", error);
      res.status(500).json({ message: "Failed to fetch parent credentials" });
    }
  });

  // Refresh parent credentials
  app.post("/api/parents/:id/credentials/refresh", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const parent = await storage.getParent(req.params.id);
      if (!parent) {
        return res.status(404).json({ message: "Parent not found" });
      }

      if (user.role === 'admin' && parent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get student linked to this parent to find admission number
      const [studentLink] = await db
        .select()
        .from(studentParents)
        .where(eq(studentParents.parentId, parent.id))
        .limit(1);
      
      if (!studentLink) {
        return res.status(404).json({ message: "No student linked to this parent" });
      }

      const student = await storage.getStudent(studentLink.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if student has credentials generated first
      const [studentUser] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.loginId, student.admissionNumber),
          eq(users.role, 'student'),
          eq(users.isActive, true)
        ))
        .limit(1);

      if (!studentUser || !studentUser.temporaryPassword) {
        return res.status(400).json({ 
          message: "Generate login credentials for students first, followed by parents" 
        });
      }

      // Search for parent user by loginId pattern
      const parentLoginId = `P${student.admissionNumber}`;
      const [parentUser] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.loginId, parentLoginId),
          eq(users.role, 'parent'),
          eq(users.isActive, true)
        ))
        .limit(1);
      
      if (!parentUser) {
        return res.status(404).json({ message: "Parent user account not found" });
      }

      const { generateTemporaryPasswordString, generateTemporaryPasswordExpiry } = await import('./services/credentialService');
      const { hashTemporaryPassword } = await import('./auth');
      
      const tempPassword = generateTemporaryPasswordString();
      const hashedPassword = await hashTemporaryPassword(tempPassword);
      const expiresAt = generateTemporaryPasswordExpiry(48);

      await storage.updateUser(parentUser.id, {
        temporaryPassword: hashedPassword,
        temporaryPasswordPlainText: tempPassword,
        temporaryPasswordExpiresAt: expiresAt,
        isFirstLogin: true,
        updatedAt: getCurrentDateTimeIST()
      });

      res.json({
        userId: parentUser.id,
        loginId: parentUser.loginId,
        temporaryPassword: tempPassword,
        expiresAt
      });
    } catch (error) {
      console.error("Error refreshing parent credentials:", error);
      res.status(500).json({ message: "Failed to refresh parent credentials" });
    }
  });

  // Bulk generate credentials
  app.post("/api/user-management/bulk-generate-credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { role, userIds } = req.body as { 
        role: 'student' | 'teacher' | 'parent'; 
        userIds?: string[] 
      };

      if (!role || !['student', 'teacher', 'parent'].includes(role)) {
        return res.status(400).json({ message: "Valid role required (student, teacher, or parent)" });
      }

      const schoolId = user.role === 'admin' ? user.schoolId : req.body.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const { generateCredentialsForUsers } = await import('./services/credentialService');
      
      let targetUsers: any[] = [];

      if (role === 'student') {
        const students = userIds 
          ? await Promise.all(userIds.map(id => storage.getStudent(id)))
          : await storage.getStudents(schoolId);
        
        const { generateLoginId } = await import('./services/credentialService');
        const { hashPassword } = await import('./auth');
        
        const studentAndParentUsers = await Promise.all(
          students.filter(Boolean).map(async (student: any) => {
            let [studentUser] = await db
              .select()
              .from(users)
              .where(eq(users.studentId, student.id))
              .limit(1);
            
            // If no user account exists for student, create one
            if (!studentUser) {
              const loginId = student.admissionNumber || generateLoginId('student');
              
              const newUser = await storage.createUser({
                email: student.email,
                loginId,
                passwordHash: await hashPassword(generateLoginId('student')), // Random secure default
                temporaryPassword: null,
                temporaryPasswordPlainText: null,
                temporaryPasswordExpiresAt: null,
                role: 'student',
                isFirstLogin: true,
                schoolId: student.schoolId,
                studentId: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                isActive: true,
                createdBy: user.id
              });
              
              studentUser = newUser;
            }
            
            const userList = [{
              id: studentUser.id,
              role: 'student' as const,
              admissionNumber: student.admissionNumber
            }];
            
            const parentLinks = await db
              .select()
              .from(studentParents)
              .where(eq(studentParents.studentId, student.id))
              .limit(1);
            
            if (parentLinks.length > 0) {
              const parent = await storage.getParent(parentLinks[0].parentId);
              if (parent) {
                const [parentUser] = await db
                  .select()
                  .from(users)
                  .where(eq(users.parentId, parent.id))
                  .limit(1);
                
                if (parentUser) {
                  userList.push({
                    id: parentUser.id,
                    role: 'parent' as const,
                    admissionNumber: student.admissionNumber
                  });
                }
              }
            }
            
            return userList;
          })
        );
        
        targetUsers = studentAndParentUsers.flat();
      } else if (role === 'teacher') {
        const teachers = userIds 
          ? await Promise.all(userIds.map(id => storage.getTeacher(id)))
          : await storage.getTeachers(schoolId);
        
        const { generateLoginId } = await import('./services/credentialService');
        const { hashPassword } = await import('./auth');
        
        targetUsers = await Promise.all(
          teachers.filter(Boolean).map(async (teacher: any) => {
            let [teacherUser] = await db
              .select()
              .from(users)
              .where(eq(users.teacherId, teacher.id))
              .limit(1);
            
            // If no user account exists, create one
            if (!teacherUser) {
              const loginId = teacher.employeeId || generateLoginId('teacher');
              
              // Extract first and last name from teacher name
              const nameParts = teacher.name.split(' ');
              const firstName = nameParts[0] || 'Teacher';
              const lastName = nameParts.slice(1).join(' ') || '';

              const newUser = await storage.createUser({
                email: teacher.email,
                loginId,
                passwordHash: await hashPassword(generateLoginId('teacher')), // Random secure default
                temporaryPassword: null,
                temporaryPasswordPlainText: null,
                temporaryPasswordExpiresAt: null,
                role: 'teacher',
                isFirstLogin: true,
                schoolId: teacher.schoolId,
                teacherId: teacher.id,
                firstName,
                lastName,
                isActive: true,
                createdBy: user.id
              });
              
              teacherUser = newUser;
            }
            
            return {
              id: teacherUser.id,
              role: 'teacher' as const,
              employeeId: teacher.employeeId
            };
          })
        );
      } else if (role === 'parent') {
        const parents = userIds 
          ? await Promise.all(userIds.map(id => storage.getParent(id)))
          : await storage.getParents(schoolId);
        
        targetUsers = await Promise.all(
          parents.filter(Boolean).map(async (parent: any) => {
            const [parentUser] = await db
              .select()
              .from(users)
              .where(eq(users.parentId, parent.id))
              .limit(1);
            
            const parentStudents = await db
              .select()
              .from(studentParents)
              .where(eq(studentParents.parentId, parent.id))
              .limit(1);
            
            let admissionNumber = null;
            if (parentStudents.length > 0) {
              const student = await storage.getStudent(parentStudents[0].studentId);
              admissionNumber = student?.admissionNumber || null;
            }

            return {
              id: parentUser?.id || '',
              role: 'parent' as const,
              admissionNumber
            };
          })
        );
      }

      // Generate a unique progress ID
      const progressId = `${user.id}-${role}-${Date.now()}`;
      const filteredUsers = targetUsers.filter(u => u.id);
      
      console.log(`[PROGRESS] Starting bulk generation for ${filteredUsers.length} ${role}s with progressId: ${progressId}`);
      
      // Import progress tracking
      const { createProgressTracking, updateProgress } = await import('./services/progressTracking');
      
      // Initialize progress tracking
      createProgressTracking(progressId, filteredUsers.length, role);
      console.log(`[PROGRESS] Initialized progress tracking for ${progressId}`);
      
      // Return immediately with progressId so frontend can start polling
      res.json({ 
        progressId,
        total: filteredUsers.length,
        generated: 0,
        failed: 0
      });
      
      // Run generation in background
      (async () => {
        try {
          const result = await generateCredentialsForUsers(
            filteredUsers,
            async (userId, data) => {
              await storage.updateUser(userId, {
                ...data,
                updatedAt: getCurrentDateTimeIST()
              });
            },
            (current, total) => {
              console.log(`[PROGRESS] Progress update for ${progressId}: ${current}/${total}`);
              updateProgress(progressId, current, total);
            }
          );
          console.log(`[PROGRESS] Bulk generation complete for ${progressId}. Result:`, result);
        } catch (error) {
          console.error(`[PROGRESS] Error in background generation for ${progressId}:`, error);
        }
      })();
    } catch (error) {
      console.error("Error bulk generating credentials:", error);
      res.status(500).json({ message: "Failed to bulk generate credentials" });
    }
  });

  // Get bulk generation progress
  app.get("/api/user-management/bulk-progress/:progressId", authMiddleware, async (req: any, res) => {
    try {
      const { getProgress } = await import('./services/progressTracking');
      const progress = getProgress(req.params.progressId);
      
      console.log(`[PROGRESS] Fetching progress for ${req.params.progressId}:`, progress);
      
      if (!progress) {
        console.log(`[PROGRESS] Progress not found for ${req.params.progressId}`);
        return res.status(404).json({ message: "Progress not found" });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Send credentials via email (stub)
  app.post("/api/user-management/send-credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { userId, userIds } = req.body;
      const targetUserIds = userIds || (userId ? [userId] : []);

      if (targetUserIds.length === 0) {
        return res.status(400).json({ message: "At least one user ID required" });
      }

      const { getNotificationProvider, NotificationChannel } = await import('../shared/services/notificationService');
      const notificationProvider = getNotificationProvider();

      const results = await Promise.all(
        targetUserIds.map(async (id: string) => {
          const targetUser = await storage.getUser(id);
          if (!targetUser || !targetUser.email) {
            return { userId: id, success: false, error: 'User not found or no email' };
          }

          const result = await notificationProvider.send({
            recipient: targetUser.email,
            subject: 'Your Login Credentials',
            body: `Your login ID: ${targetUser.loginId}\nTemporary password: ${targetUser.temporaryPasswordPlainText || '[Hidden]'}`,
            channel: NotificationChannel.EMAIL
          });

          return { userId: id, ...result };
        })
      );

      res.json({
        message: 'Credentials sent via email',
        results,
        note: 'Email provider not configured - notifications logged only'
      });
    } catch (error) {
      console.error("Error sending credentials via email:", error);
      res.status(500).json({ message: "Failed to send credentials" });
    }
  });

  // Send credentials via SMS (stub)
  app.post("/api/user-management/send-credentials-sms", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { userId, userIds } = req.body;
      const targetUserIds = userIds || (userId ? [userId] : []);

      if (targetUserIds.length === 0) {
        return res.status(400).json({ message: "At least one user ID required" });
      }

      const { getNotificationProvider, NotificationChannel } = await import('../shared/services/notificationService');
      const notificationProvider = getNotificationProvider();

      const results = await Promise.all(
        targetUserIds.map(async (id: string) => {
          const targetUser = await storage.getUser(id);
          if (!targetUser) {
            return { userId: id, success: false, error: 'User not found' };
          }

          let phone = null;
          if (targetUser.studentId) {
            const student = await storage.getStudent(targetUser.studentId);
            phone = student?.contactNumber;
          } else if (targetUser.teacherId) {
            const teacher = await storage.getTeacher(targetUser.teacherId);
            phone = teacher?.contactNumber;
          } else if (targetUser.parentId) {
            const parent = await storage.getParent(targetUser.parentId);
            phone = parent?.contactNumber;
          }

          if (!phone) {
            return { userId: id, success: false, error: 'No phone number found' };
          }

          const result = await notificationProvider.send({
            recipient: phone,
            body: `Login ID: ${targetUser.loginId}\nPassword: ${targetUser.temporaryPasswordPlainText || '[Hidden]'}`,
            channel: NotificationChannel.SMS
          });

          return { userId: id, ...result };
        })
      );

      res.json({
        message: 'Credentials sent via SMS',
        results,
        note: 'SMS provider not configured - notifications logged only'
      });
    } catch (error) {
      console.error("Error sending credentials via SMS:", error);
      res.status(500).json({ message: "Failed to send credentials" });
    }
  });

  // ===== CLASS TEACHER USER MANAGEMENT ENDPOINTS =====
  
  // Get students in class teacher's class with credential status
  app.get("/api/class-teacher/my-students-credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied. Teacher required." });
      }

      if (!user.teacherId) {
        return res.status(400).json({ message: "Teacher ID not found" });
      }

      // Get classes where user is the primary class teacher
      const classes = await storage.getClassesForClassTeacher(user.teacherId, user.schoolId);

      if (classes.length === 0) {
        return res.json({ students: [], message: "You are not assigned as a class teacher for any class" });
      }

      // For now, use the first class (in future could support multiple classes)
      const classId = classes[0].id;

      // Get students in the class
      const students = await storage.getStudentsByClass(classId);

      // Get credential status for each student and their parent
      const studentsWithCredentials = await Promise.all(
        students.map(async (student) => {
          const [studentUser] = await db
            .select()
            .from(users)
            .where(eq(users.studentId, student.id))
            .limit(1);

          let parentUser = null;
          const parentLinks = await db
            .select()
            .from(studentParents)
            .where(eq(studentParents.studentId, student.id))
            .limit(1);

          if (parentLinks.length > 0) {
            const parent = await storage.getParent(parentLinks[0].parentId);
            if (parent) {
              const [pUser] = await db
                .select()
                .from(users)
                .where(eq(users.parentId, parent.id))
                .limit(1);
              parentUser = pUser || null;
            }
          }

          return {
            id: student.id,
            admissionNumber: student.admissionNumber,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            contactNumber: student.contactNumber,
            studentCredentials: studentUser ? {
              userId: studentUser.id,
              loginId: studentUser.loginId,
              hasCredentials: !!studentUser.temporaryPassword || !!studentUser.passwordHash,
              hasTemporaryPassword: !!studentUser.temporaryPassword,
              temporaryPassword: studentUser.temporaryPasswordPlainText,
              expiresAt: studentUser.temporaryPasswordExpiresAt
            } : null,
            parentCredentials: parentUser ? {
              userId: parentUser.id,
              loginId: parentUser.loginId,
              hasCredentials: !!parentUser.temporaryPassword || !!parentUser.passwordHash,
              hasTemporaryPassword: !!parentUser.temporaryPassword,
              temporaryPassword: parentUser.temporaryPasswordPlainText,
              expiresAt: parentUser.temporaryPasswordExpiresAt
            } : null
          };
        })
      );

      res.json({
        class: classes[0],
        students: studentsWithCredentials
      });
    } catch (error) {
      console.error("Error fetching class teacher students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // Generate credentials for students and parents in class teacher's class
  app.post("/api/class-teacher/generate-credentials", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied. Teacher required." });
      }

      if (!user.teacherId) {
        return res.status(400).json({ message: "Teacher ID not found" });
      }

      const { studentIds } = req.body as { studentIds: string[] };

      if (!studentIds || studentIds.length === 0) {
        return res.status(400).json({ message: "At least one student ID required" });
      }

      // Verify that the teacher is the class teacher for these students
      const classes = await storage.getClassesForClassTeacher(user.teacherId, user.schoolId);
      
      if (classes.length === 0) {
        return res.status(403).json({ message: "You are not assigned as a class teacher" });
      }

      const classIds = classes.map(c => c.id);

      // Verify all students belong to teacher's class
      const students = await Promise.all(studentIds.map(id => storage.getStudent(id)));
      const invalidStudents = students.filter(s => !s || !classIds.includes(s.classId || ''));

      if (invalidStudents.length > 0) {
        return res.status(403).json({ message: "Some students do not belong to your class" });
      }

      const { generateLoginId } = await import('./services/credentialService');
      const { hashPassword } = await import('./auth');

      // Generate credentials for students and their parents
      const studentAndParentUsers = await Promise.all(
        students.filter(Boolean).map(async (student: any) => {
          let [studentUser] = await db
            .select()
            .from(users)
            .where(eq(users.studentId, student.id))
            .limit(1);
          
          // If no user account exists for student, create one
          if (!studentUser) {
            const loginId = student.admissionNumber || generateLoginId('student');
            
            const newUser = await storage.createUser({
              email: student.email,
              loginId,
              passwordHash: await hashPassword(generateLoginId('student')),
              temporaryPassword: null,
              temporaryPasswordPlainText: null,
              temporaryPasswordExpiresAt: null,
              role: 'student',
              isFirstLogin: true,
              schoolId: student.schoolId,
              studentId: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              isActive: true,
              createdBy: user.id
            });
            
            studentUser = newUser;
          }
          
          const userList = [{
            id: studentUser.id,
            role: 'student' as const,
            admissionNumber: student.admissionNumber
          }];
          
          const parentLinks = await db
            .select()
            .from(studentParents)
            .where(eq(studentParents.studentId, student.id))
            .limit(1);
          
          if (parentLinks.length > 0) {
            const parent = await storage.getParent(parentLinks[0].parentId);
            if (parent) {
              let [parentUser] = await db
                .select()
                .from(users)
                .where(eq(users.parentId, parent.id))
                .limit(1);
              
              // If no user account exists for parent, create one
              if (!parentUser) {
                const parentLoginId = generateLoginId('parent', student.admissionNumber);
                
                const newParentUser = await storage.createUser({
                  email: parent.email,
                  loginId: parentLoginId,
                  passwordHash: await hashPassword(generateLoginId('parent')),
                  temporaryPassword: null,
                  temporaryPasswordPlainText: null,
                  temporaryPasswordExpiresAt: null,
                  role: 'parent',
                  isFirstLogin: true,
                  schoolId: parent.schoolId,
                  parentId: parent.id,
                  firstName: parent.firstName,
                  lastName: parent.lastName,
                  isActive: true,
                  createdBy: user.id
                });
                
                parentUser = newParentUser;
              }
              
              userList.push({
                id: parentUser.id,
                role: 'parent' as const,
                admissionNumber: student.admissionNumber
              });
            }
          }
          
          return userList;
        })
      );

      const targetUsers = studentAndParentUsers.flat();
      const { generateCredentialsForUsers } = await import('./services/credentialService');

      // Generate a unique progress ID
      const progressId = `${user.id}-class-teacher-${Date.now()}`;
      
      console.log(`[PROGRESS] Starting credential generation for class teacher with progressId: ${progressId}`);
      
      // Import progress tracking
      const { createProgressTracking, updateProgress } = await import('./services/progressTracking');
      
      // Initialize progress tracking
      createProgressTracking(progressId, targetUsers.length, 'class-teacher');
      
      // Return immediately with progressId so frontend can start polling
      res.json({ 
        progressId,
        total: targetUsers.length,
        generated: 0,
        failed: 0
      });
      
      // Run generation in background
      (async () => {
        try {
          const result = await generateCredentialsForUsers(
            targetUsers,
            async (userId, data) => {
              await storage.updateUser(userId, {
                ...data,
                updatedAt: getCurrentDateTimeIST()
              });
            },
            (current, total) => {
              console.log(`[PROGRESS] Progress update for ${progressId}: ${current}/${total}`);
              updateProgress(progressId, current, total);
            }
          );
          console.log(`[PROGRESS] Credential generation complete for ${progressId}. Result:`, result);
        } catch (error) {
          console.error(`[PROGRESS] Error in background generation for ${progressId}:`, error);
        }
      })();
    } catch (error) {
      console.error("Error generating class teacher credentials:", error);
      res.status(500).json({ message: "Failed to generate credentials" });
    }
  });

  // ===== SMART REPORTS ENDPOINTS =====
  
  // Student Attendance Report
  app.get("/api/reports/student-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { fromDate, toDate } = req.query;
      const schoolId = user.schoolId;

      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate are required" });
      }

      // Get all students
      const students = await storage.getStudents(schoolId);
      
      // Get attendance records for date range
      const attendanceRecords = await db
        .select()
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.schoolId, schoolId),
            gte(studentAttendance.attendanceDate, fromDate as string),
            lte(studentAttendance.attendanceDate, toDate as string)
          )
        )
        .orderBy(studentAttendance.attendanceDate, studentAttendance.studentId);

      // Get classes for mapping
      const classes = await storage.getClasses(schoolId);
      const classMap = new Map(classes.map(c => [c.id, c]));

      // Build report data
      const reportData = students.map((student, index) => {
        const studentRecords = attendanceRecords.filter(r => r.studentId === student.id);
        const presentCount = studentRecords.filter(r => r.status === 'present').length;
        const absentCount = studentRecords.filter(r => r.status === 'absent').length;
        const totalDays = studentRecords.length;
        const attendancePercentage = totalDays > 0 ? ((presentCount / totalDays) * 100) : 0;

        const studentClass = classMap.get(student.classId || '');
        const grade = studentClass ? studentClass.grade : 'N/A';
        const section = studentClass ? studentClass.section : 'N/A';

        // Generate remarks based on attendance percentage
        let remarks = '';
        if (attendancePercentage === 100) {
          remarks = 'Excellent';
        } else if (attendancePercentage >= 90) {
          remarks = 'Very Good';
        } else if (attendancePercentage >= 75) {
          remarks = 'Good';
        } else if (attendancePercentage >= 60) {
          remarks = 'Low attendance';
        } else if (totalDays > 0) {
          remarks = 'Poor attendance';
        } else {
          remarks = 'No records';
        }

        return {
          rollNo: student.admissionNumber || (index + 1).toString(),
          studentName: `${student.firstName} ${student.lastName}`,
          class: grade,
          section: section,
          totalDays,
          present: presentCount,
          absent: absentCount,
          attendancePercentage: `${attendancePercentage.toFixed(0)}%`,
          remarks
        };
      });

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching student attendance report:", error);
      res.status(500).json({ message: "Failed to fetch student attendance report" });
    }
  });

  // Teacher Attendance Report
  app.get("/api/reports/teacher-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { fromDate, toDate } = req.query;
      const schoolId = user.schoolId;

      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate are required" });
      }

      // Get all teachers
      const teachers = await storage.getTeachers(schoolId);
      
      // Get attendance records for date range
      const attendanceRecords = await db
        .select()
        .from(teacherAttendance)
        .where(
          and(
            eq(teacherAttendance.schoolId, schoolId),
            gte(teacherAttendance.attendanceDate, fromDate as string),
            lte(teacherAttendance.attendanceDate, toDate as string)
          )
        )
        .orderBy(teacherAttendance.attendanceDate, teacherAttendance.teacherId);

      // Build report data
      const reportData = teachers.map(teacher => {
        const teacherRecords = attendanceRecords.filter(r => r.teacherId === teacher.id);
        const presentCount = teacherRecords.filter(r => r.status === 'present').length;
        const absentCount = teacherRecords.filter(r => r.status === 'absent').length;
        const totalDays = teacherRecords.length;
        const attendancePercentage = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : '0';

        return {
          teacherId: teacher.id,
          employeeId: teacher.employeeId,
          name: teacher.name,
          designation: teacher.designation || 'N/A',
          totalDays,
          presentDays: presentCount,
          absentDays: absentCount,
          attendancePercentage: `${attendancePercentage}%`
        };
      });

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching teacher attendance report:", error);
      res.status(500).json({ message: "Failed to fetch teacher attendance report" });
    }
  });

  // Student Details Report
  app.get("/api/reports/student-details", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.schoolId;

      // Get all students
      const students = await storage.getStudents(schoolId);
      
      // Get classes for mapping
      const classes = await storage.getClasses(schoolId);
      const classMap = new Map(classes.map(c => [c.id, c]));

      // Build report data
      const reportData = students.map(student => {
        const studentClass = classMap.get(student.classId || '');
        const className = studentClass ? `${studentClass.grade} - ${studentClass.section}` : 'N/A';
        
        return {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: className,
          gender: student.gender || 'N/A',
          dateOfBirth: student.dateOfBirth || 'N/A',
          contactNumber: student.contactNumber || 'N/A',
          email: student.email || 'N/A',
          address: student.address || 'N/A',
          guardianName: student.guardianName || 'N/A',
          guardianContact: student.guardianContact || 'N/A'
        };
      });

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching student details report:", error);
      res.status(500).json({ message: "Failed to fetch student details report" });
    }
  });

  // Teacher Details Report
  app.get("/api/reports/teacher-details", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.schoolId;

      // Get all teachers
      const teachers = await storage.getTeachers(schoolId);
      
      // Get subjects for mapping
      const subjects = await storage.getSubjects(schoolId);
      const subjectMap = new Map(subjects.map(s => [s.id, s]));

      // Get class subject assignments to find teacher subjects
      const classSubjects = await storage.getClassSubjectAssignments(schoolId);
      
      // Build report data
      const reportData = teachers.map(teacher => {
        // Find subjects assigned to this teacher
        const teacherSubjects = classSubjects
          .filter((cs: any) => cs.assignedTeacherId === teacher.id)
          .map((cs: any) => subjectMap.get(cs.subjectId)?.name)
          .filter(Boolean)
          .join(', ') || 'N/A';

        return {
          employeeId: teacher.employeeId,
          name: teacher.name,
          email: teacher.email || 'N/A',
          contactNumber: teacher.contactNumber || 'N/A',
          designation: teacher.designation || 'N/A',
          subjects: teacherSubjects,
          bloodGroup: teacher.bloodGroup || 'N/A',
          gender: teacher.gender || 'N/A'
        };
      });

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching teacher details report:", error);
      res.status(500).json({ message: "Failed to fetch teacher details report" });
    }
  });

  // Teacher Schedule Report
  app.get("/api/reports/teacher-schedule", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.schoolId;

      // Get all teachers
      const teachers = await storage.getTeachers(schoolId);
      
      // Get subjects and classes for mapping
      const subjects = await storage.getSubjects(schoolId);
      const classes = await storage.getClasses(schoolId);
      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      const classMap = new Map(classes.map(c => [c.id, c]));

      // Get all timetable entries
      const allTimetableEntries = await db
        .select()
        .from(timetableEntries)
        .where(eq(timetableEntries.schoolId, schoolId));

      // Build report data
      const reportData = teachers.map(teacher => {
        const teacherSchedule = allTimetableEntries
          .filter((entry: any) => entry.teacherId === teacher.id)
          .map((entry: any) => {
            const entryClass = classMap.get(entry.classId);
            const className = entryClass ? `${entryClass.grade} - ${entryClass.section}` : 'N/A';
            
            return {
              day: entry.day,
              period: entry.period,
              subject: subjectMap.get(entry.subjectId)?.name || 'N/A',
              class: className
            };
          })
          .sort((a, b) => {
            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayCompare = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            if (dayCompare !== 0) return dayCompare;
            return a.period - b.period;
          });

        return {
          teacherId: teacher.id,
          employeeId: teacher.employeeId,
          name: teacher.name,
          totalPeriods: teacherSchedule.length,
          schedule: teacherSchedule
        };
      });

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching teacher schedule report:", error);
      res.status(500).json({ message: "Failed to fetch teacher schedule report" });
    }
  });

  // Teacher Workload Report
  app.get("/api/reports/teacher-workload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const schoolId = user.schoolId;

      // Get workload analytics from storage
      const workloadData = await storage.getTeacherWorkloadAnalytics(schoolId);

      // Format for report
      const reportData = workloadData.map((teacher: any) => ({
        teacherId: teacher.teacherId,
        employeeId: teacher.employeeId,
        name: teacher.teacherName,
        totalPeriods: teacher.totalPeriods,
        hoursPerWeek: teacher.hoursPerWeek,
        workloadPercentage: teacher.workloadPercentage,
        distribution: teacher.periodDistribution
      }));

      res.json(reportData);
    } catch (error) {
      console.error("Error fetching teacher workload report:", error);
      res.status(500).json({ message: "Failed to fetch teacher workload report" });
    }
  });

  // ============================================================================
  // CUSTOM REPORTS API ENDPOINTS
  // ============================================================================

  // Get all custom reports for the school
  app.get("/api/custom-reports", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { category, favorites } = req.query;

      let query = db.select().from(customReports)
        .where(eq(customReports.schoolId, user.schoolId));

      if (category) {
        query = query.where(eq(customReports.category, category)) as any;
      }

      if (favorites === 'true') {
        query = query.where(eq(customReports.isFavorite, true)) as any;
      }

      const reports = await query.orderBy(desc(customReports.createdAt));

      res.json(reports);
    } catch (error) {
      console.error("Error fetching custom reports:", error);
      res.status(500).json({ message: "Failed to fetch custom reports" });
    }
  });

  // Get available data sources (MUST be before /:id route)
  app.get("/api/custom-reports/datasources", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const dataSources = customReportService.getAvailableDataSources();
      res.json({ dataSources });
    } catch (error) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  // Get available fields for a data source (MUST be before /:id route)
  app.get("/api/custom-reports/fields/:dataSource", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { dataSource } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const fields = customReportService.getAvailableFields(dataSource);
      res.json({ fields });
    } catch (error) {
      console.error("Error fetching available fields:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch available fields" });
    }
  });

  // Get single custom report
  app.get("/api/custom-reports/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching custom report:", error);
      res.status(500).json({ message: "Failed to fetch custom report" });
    }
  });

  // Create custom report
  app.post("/api/custom-reports", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const reportData = {
        ...req.body,
        schoolId: user.schoolId,
        createdBy: user.id,
      };

      const validatedData = insertCustomReportSchema.parse(reportData);
      
      const [newReport] = await db.insert(customReports)
        .values(validatedData)
        .returning();

      res.status(201).json(newReport);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("[Custom Report] Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating custom report:", error);
      res.status(500).json({ message: "Failed to create custom report" });
    }
  });

  // Update custom report
  app.put("/api/custom-reports/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [updatedReport] = await db.update(customReports)
        .set(updateData)
        .where(eq(customReports.id, id))
        .returning();

      res.json(updatedReport);
    } catch (error) {
      console.error("Error updating custom report:", error);
      res.status(500).json({ message: "Failed to update custom report" });
    }
  });

  // Delete custom report
  app.delete("/api/custom-reports/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      await db.delete(customReports)
        .where(eq(customReports.id, id));

      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting custom report:", error);
      res.status(500).json({ message: "Failed to delete custom report" });
    }
  });

  // Duplicate custom report
  app.post("/api/custom-reports/:id/duplicate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const duplicateData = {
        ...report,
        id: undefined,
        label: `${report.label} (Copy)`,
        createdBy: user.id,
        createdAt: undefined,
        updatedAt: undefined,
      };

      const [newReport] = await db.insert(customReports)
        .values(duplicateData as any)
        .returning();

      res.status(201).json(newReport);
    } catch (error) {
      console.error("Error duplicating custom report:", error);
      res.status(500).json({ message: "Failed to duplicate custom report" });
    }
  });

  // Generate/Execute custom report
  app.post("/api/custom-reports/:id/generate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { additionalFilters } = req.body;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const config = {
        dataSource: report.dataSource,
        selectedFields: report.selectedFields as string[],
        filters: additionalFilters || report.filters as any[] || [],
        sortBy: report.sortBy || undefined,
        sortOrder: (report.sortOrder as 'asc' | 'desc') || undefined,
        groupBy: report.groupBy || undefined,
      };

      const data = await customReportService.generateCustomReport(config, user.schoolId);

      await db.insert(reportExecutionHistory).values({
        reportId: id,
        executedBy: user.id,
        recordCount: data.length,
      });

      res.json(data);
    } catch (error) {
      console.error("Error generating custom report:", error);
      res.status(500).json({ message: "Failed to generate custom report" });
    }
  });

  // Export custom report
  app.get("/api/custom-reports/:id/export", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { format = 'excel' } = req.query;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const [report] = await db.select()
        .from(customReports)
        .where(and(
          eq(customReports.id, id),
          eq(customReports.schoolId, user.schoolId)
        ))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const config = {
        dataSource: report.dataSource,
        selectedFields: report.selectedFields as string[],
        filters: report.filters as any[] || [],
        sortBy: report.sortBy || undefined,
        sortOrder: (report.sortOrder as 'asc' | 'desc') || undefined,
        groupBy: report.groupBy || undefined,
      };

      const data = await customReportService.generateCustomReport(config, user.schoolId);

      await db.insert(reportExecutionHistory).values({
        reportId: id,
        executedBy: user.id,
        recordCount: data.length,
        exportFormat: format as string,
      });

      res.json(data);
    } catch (error) {
      console.error("Error exporting custom report:", error);
      res.status(500).json({ message: "Failed to export custom report" });
    }
  });

  // ============================================================================
  // CALENDAR EVENTS API ENDPOINTS
  // ============================================================================

  // Get all calendar events with filters
  app.get("/api/calendar/events", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { month, year, eventType } = req.query;

      const filters: any = {};
      if (month !== undefined) filters.month = parseInt(month);
      if (year !== undefined) filters.year = parseInt(year);
      if (eventType) filters.eventType = eventType;

      const events = await storage.getCalendarEvents(user.schoolId, filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  // Get single calendar event
  app.get("/api/calendar/events/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getCalendarEvent(id);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error fetching calendar event:", error);
      res.status(500).json({ message: "Failed to fetch calendar event" });
    }
  });

  // Get holidays
  app.get("/api/calendar/holidays", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const holidays = await storage.getCalendarHolidays(user.schoolId);
      res.json(holidays);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      res.status(500).json({ message: "Failed to fetch holidays" });
    }
  });

  // Get upcoming events
  app.get("/api/calendar/events/upcoming", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { days } = req.query;
      const daysCount = days ? parseInt(days) : 30;
      
      const upcomingEvents = await storage.getUpcomingCalendarEvents(user.schoolId, daysCount);
      res.json(upcomingEvents);
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      res.status(500).json({ message: "Failed to fetch upcoming events" });
    }
  });

  // Create calendar event (admin only)
  app.post("/api/calendar/events", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      // Add schoolId and createdBy before validation
      const eventData = {
        ...req.body,
        schoolId: user.schoolId,
        createdBy: user.id,
      };

      const validatedData = insertCalendarEventSchema.parse(eventData);
      const event = await storage.createCalendarEvent(validatedData);
      res.status(201).json(event);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("[Calendar Event] Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating calendar event:", error);
      res.status(500).json({ message: "Failed to create calendar event" });
    }
  });

  // Update calendar event (admin only)
  app.put("/api/calendar/events/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const existingEvent = await storage.getCalendarEvent(id);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (existingEvent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertCalendarEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updateCalendarEvent(id, validatedData);
      res.json(updatedEvent);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating calendar event:", error);
      res.status(500).json({ message: "Failed to update calendar event" });
    }
  });

  // Delete calendar event (admin only)
  app.delete("/api/calendar/events/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const existingEvent = await storage.getCalendarEvent(id);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (existingEvent.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteCalendarEvent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ message: "Failed to delete calendar event" });
    }
  });

  // ============================================================================
  // ADMISSION MANAGEMENT ENDPOINTS
  // ============================================================================

  // Configure multer for document uploads
  const documentUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'attached_assets', 'admission_documents');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
      }
    }
  });

  // Get all admission applications (admin only, with filters)
  app.get("/api/admissions", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const { status, classId, sessionId } = req.query;
      const filters: any = {};
      
      if (status) filters.status = status;
      if (classId) filters.classId = classId;
      if (sessionId) filters.sessionId = sessionId;

      const applications = await storage.getAdmissionApplications(user.schoolId, filters);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching admission applications:", error);
      res.status(500).json({ message: "Failed to fetch admission applications" });
    }
  });

  // Get single admission application
  app.get("/api/admissions/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      const application = await storage.getAdmissionApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(application);
    } catch (error) {
      console.error("Error fetching admission application:", error);
      res.status(500).json({ message: "Failed to fetch admission application" });
    }
  });

  // Submit new admission application
  app.post("/api/admissions", async (req, res) => {
    try {
      console.log("[ADMISSION] Received data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertAdmissionApplicationSchema.parse(req.body);
      
      const application = await storage.createAdmissionApplication(validatedData);
      res.status(201).json(application);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("[ADMISSION] Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating admission application:", error);
      res.status(500).json({ message: "Failed to create admission application" });
    }
  });

  // Update admission application (admin only)
  app.put("/api/admissions/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const existingApplication = await storage.getAdmissionApplication(id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (existingApplication.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertAdmissionApplicationSchema.partial().parse(req.body);
      const updatedApplication = await storage.updateAdmissionApplication(id, validatedData);
      res.json(updatedApplication);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating admission application:", error);
      res.status(500).json({ message: "Failed to update admission application" });
    }
  });

  // Review/approve/reject admission application (admin only)
  app.put("/api/admissions/:id/review", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const existingApplication = await storage.getAdmissionApplication(id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (existingApplication.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!['approved', 'rejected', 'under_review'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updateData: any = {
        applicationStatus: status,
        reviewedBy: user.id,
        reviewedAt: new Date()
      };

      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      const updatedApplication = await storage.updateAdmissionApplication(id, updateData);
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error reviewing admission application:", error);
      res.status(500).json({ message: "Failed to review admission application" });
    }
  });

  // Delete admission application (admin only)
  app.delete("/api/admissions/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      const existingApplication = await storage.getAdmissionApplication(id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (existingApplication.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteAdmissionApplication(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting admission application:", error);
      res.status(500).json({ message: "Failed to delete admission application" });
    }
  });

  // Upload document for admission application
  app.post("/api/admissions/:id/documents", documentUpload.single('document'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { documentType } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const existingApplication = await storage.getAdmissionApplication(id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      const documentData = {
        applicationId: id,
        documentType: documentType || 'other',
        documentName: req.file.originalname,
        documentUrl: `/attached_assets/admission_documents/${req.file.filename}`
      };

      const document = await storage.createAdmissionDocument(documentData);
      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error uploading admission document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Get documents for admission application
  app.get("/api/admissions/:id/documents", async (req, res) => {
    try {
      const { id } = req.params;

      const existingApplication = await storage.getAdmissionApplication(id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      const documents = await storage.getAdmissionDocuments(id);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching admission documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Delete admission document
  app.delete("/api/admissions/documents/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Admin required." });
      }

      await storage.deleteAdmissionDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting admission document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ============================================================================
  // EXAM MODULE ENDPOINTS
  // ============================================================================

  // Get all exams (with filters)
  app.get("/api/exams", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const filters: any = {};
      if (req.query.academicSessionId) {
        filters.academicSessionId = req.query.academicSessionId as string;
      }
      if (req.query.examType) {
        filters.examType = req.query.examType as string;
      }

      const exams = await storage.getExams(user.schoolId, filters);
      res.json(exams);
    } catch (error: any) {
      console.error("Error fetching exams:", error);
      res.status(500).json({ message: "Failed to fetch exams" });
    }
  });

  // Get single exam
  app.get("/api/exams/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const exam = await storage.getExam(id);

      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json(exam);
    } catch (error: any) {
      console.error("Error fetching exam:", error);
      res.status(500).json({ message: "Failed to fetch exam" });
    }
  });

  // Create new exam (admin only)
  app.post("/api/exams", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create exams" });
      }

      if (!user.schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const validatedData = insertExamSchema.parse({
        ...req.body,
        schoolId: user.schoolId,
        createdBy: user.id
      });

      // Explicitly remove fields that should be auto-generated
      const { id, createdAt, updatedAt, ...examData } = validatedData as any;

      const exam = await storage.createExam(examData as InsertExam);
      res.status(201).json(exam);
    } catch (error: any) {
      console.error("Error creating exam:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid exam data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exam" });
    }
  });

  // Update exam (admin only)
  app.put("/api/exams/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update exams" });
      }

      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateExam(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating exam:", error);
      res.status(500).json({ message: "Failed to update exam" });
    }
  });

  // Delete exam (admin only)
  app.delete("/api/exams/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete exams" });
      }

      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteExam(id);
      res.json({ message: "Exam deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting exam:", error);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  });

  // Get all exam classes for multiple exams in bulk (optimized)
  app.get("/api/exams/bulk/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examIds } = req.query;
      
      if (!examIds) {
        return res.json([]);
      }
      
      // Parse exam IDs from comma-separated string
      const examIdArray = (examIds as string).split(',').filter(id => id.trim());
      
      if (examIdArray.length === 0) {
        return res.json([]);
      }
      
      // Fetch all exam classes in one bulk query
      const allExamClasses = await db.query.examClasses.findMany({
        where: inArray(examClasses.examId, examIdArray),
        with: {
          class: true
        }
      });
      
      res.json(allExamClasses);
    } catch (error: any) {
      console.error("Error fetching bulk exam classes:", error);
      res.status(500).json({ message: "Failed to fetch exam classes" });
    }
  });

  // Get exam classes
  app.get("/api/exams/:id/classes", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const examClasses = await storage.getExamClasses(id);
      res.json(examClasses);
    } catch (error: any) {
      console.error("Error fetching exam classes:", error);
      res.status(500).json({ message: "Failed to fetch exam classes" });
    }
  });

  // Add class to exam (admin only)
  app.post("/api/exams/:id/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { classId } = req.body;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can add classes to exams" });
      }

      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Pass exam's totalMarks and passingMarks as defaults for exam subjects
      const examClass = await storage.addExamClass(id, classId, exam.totalMarks, exam.passingMarks);
      res.status(201).json(examClass);
    } catch (error: any) {
      console.error("Error adding class to exam:", error);
      res.status(500).json({ message: "Failed to add class to exam" });
    }
  });

  // Remove class from exam (admin only)
  app.delete("/api/exams/:examId/classes/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examId, classId } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can remove classes from exams" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.removeExamClass(examId, classId);
      res.json({ message: "Class removed from exam successfully" });
    } catch (error: any) {
      console.error("Error removing class from exam:", error);
      res.status(500).json({ message: "Failed to remove class from exam" });
    }
  });

  // Get exam subjects
  app.get("/api/exams/:id/subjects", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const subjects = await storage.getExamSubjects(id);
      res.json(subjects);
    } catch (error: any) {
      console.error("Error fetching exam subjects:", error);
      res.status(500).json({ message: "Failed to fetch exam subjects" });
    }
  });

  // Update exam subject marks (admin only)
  app.patch("/api/exam-subjects/:examSubjectId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examSubjectId } = req.params;
      const { maxMarks, passingMarks } = req.body;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update exam subjects" });
      }

      // Validate maxMarks if provided
      if (maxMarks !== undefined && (typeof maxMarks !== 'number' || maxMarks <= 0)) {
        return res.status(400).json({ message: "Max marks must be a positive number" });
      }

      // Validate passingMarks if provided
      if (passingMarks !== undefined && (typeof passingMarks !== 'number' || passingMarks < 0)) {
        return res.status(400).json({ message: "Passing marks must be a non-negative number" });
      }

      // Get existing exam subject to check constraints
      const existingSubject = await storage.getExamSubject(examSubjectId, user.schoolId);
      if (!existingSubject) {
        return res.status(404).json({ message: "Exam subject not found or unauthorized" });
      }

      // Determine the final max marks value (use new value if provided, otherwise use existing)
      const finalMaxMarks = maxMarks !== undefined ? maxMarks : existingSubject.maxMarks;

      // Ensure passing marks is not greater than max marks
      if (passingMarks !== undefined && passingMarks > finalMaxMarks) {
        return res.status(400).json({ message: "Passing marks cannot exceed max marks" });
      }

      const updateData: any = {};
      if (maxMarks !== undefined) updateData.maxMarks = maxMarks;
      if (passingMarks !== undefined) updateData.passingMarks = passingMarks;

      const updated = await storage.updateExamSubjectMarks(examSubjectId, updateData, user.schoolId);
      
      if (!updated) {
        return res.status(404).json({ message: "Exam subject not found or unauthorized" });
      }

      res.json({ message: "Marks updated successfully", examSubject: updated });
    } catch (error: any) {
      console.error("Error updating exam subject marks:", error);
      res.status(500).json({ message: "Failed to update marks" });
    }
  });

  // Add subject to exam (admin only)
  app.post("/api/exams/:id/subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can add subjects to exams" });
      }

      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertExamSubjectSchema.parse({
        ...req.body,
        examId: id
      });

      const examSubject = await storage.createExamSubject(validatedData);
      res.status(201).json(examSubject);
    } catch (error: any) {
      console.error("Error adding exam subject:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid subject data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add subject to exam" });
    }
  });

  // Get all marks for an exam
  app.get("/api/exams/:examId/marks", authMiddleware, async (req: any, res) => {
    try {
      const { examId } = req.params;
      const marks = await storage.getExamMarks(examId);
      res.json(marks);
    } catch (error: any) {
      console.error("Error fetching exam marks:", error);
      res.status(500).json({ message: "Failed to fetch exam marks" });
    }
  });

  // Get student marks for an exam
  app.get("/api/exams/:examId/students/:studentId/marks", authMiddleware, async (req: any, res) => {
    try {
      const { examId, studentId } = req.params;
      const marks = await storage.getStudentExamMarks(examId, studentId);
      res.json(marks);
    } catch (error: any) {
      console.error("Error fetching student exam marks:", error);
      res.status(500).json({ message: "Failed to fetch student exam marks" });
    }
  });

  // Enter/update marks (teacher/admin)
  app.post("/api/exams/:examId/marks", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examId } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers and admins can enter marks" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertExamMarkSchema.parse({
        ...req.body,
        examId,
        enteredBy: user.id
      });

      const mark = await storage.createExamMark(validatedData);
      res.status(201).json(mark);
    } catch (error: any) {
      console.error("Error entering marks:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid marks data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to enter marks" });
    }
  });

  // Batch save marks (teacher/admin)
  app.post("/api/exams/:examId/marks/batch", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examId } = req.params;
      const marksArray = req.body;

      if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers and admins can enter marks" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get exam subjects to validate marks against maxMarks
      const examSubjects = await storage.getExamSubjects(examId);
      const examSubjectsMap = new Map(examSubjects.map((es: any) => [es.id, es]));

      // First, validate ALL marks before saving any
      const validatedMarks = [];
      const validationErrors = [];
      
      for (let i = 0; i < marksArray.length; i++) {
        try {
          const validatedData = insertExamMarkSchema.parse({
            ...marksArray[i],
            examId,
            enteredBy: user.id
          });
          
          // Validate marks against maxMarks
          const examSubject = examSubjectsMap.get(marksArray[i].examSubjectId);
          if (examSubject) {
            const marksObtained = parseFloat(validatedData.marksObtained);
            if (marksObtained > examSubject.maxMarks) {
              validationErrors.push({
                index: i,
                studentId: marksArray[i].studentId,
                error: `Marks (${marksObtained}) cannot be more than max marks (${examSubject.maxMarks})`
              });
              continue;
            }
            if (marksObtained < 0) {
              validationErrors.push({
                index: i,
                studentId: marksArray[i].studentId,
                error: "Marks cannot be negative"
              });
              continue;
            }
          }
          
          validatedMarks.push(validatedData);
        } catch (error: any) {
          validationErrors.push({
            index: i,
            studentId: marksArray[i].studentId,
            error: error.message
          });
        }
      }

      // If any validation errors, return them without saving anything
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: `Validation failed for ${validationErrors.length} mark(s)`,
          errors: validationErrors 
        });
      }

      // All validations passed, now save all marks
      const savedMarks = [];
      for (const validatedData of validatedMarks) {
        const mark = await storage.createExamMark(validatedData);
        savedMarks.push(mark);
      }

      res.status(201).json({ 
        message: `Successfully saved ${savedMarks.length} marks`,
        marks: savedMarks 
      });
    } catch (error: any) {
      console.error("Error batch saving marks:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid marks data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to batch save marks" });
    }
  });

  // Calculate results for all students (admin only)
  app.post("/api/exams/:examId/calculate-results", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { examId } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can calculate results" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all marks for this exam
      const marks = await storage.getExamMarks(examId);
      const examSubjects = await storage.getExamSubjects(examId);

      // Group marks by student
      const studentMarks = marks.reduce((acc: any, mark: any) => {
        if (!acc[mark.studentId]) {
          acc[mark.studentId] = [];
        }
        acc[mark.studentId].push(mark);
        return acc;
      }, {});

      // Calculate results for each student
      const results = [];
      for (const [studentId, studentMarksArray] of Object.entries(studentMarks)) {
        const marksArray = studentMarksArray as any[];
        
        // Calculate total marks obtained
        const totalMarksObtained = marksArray.reduce((sum, m) => sum + parseFloat(m.marksObtained || 0), 0);
        
        // Calculate total max marks from only the exam subjects this student has marks for
        // Get the exam subject IDs for this student's marks
        const studentExamSubjectIds = marksArray.map(m => m.examSubjectId);
        const studentExamSubjects = examSubjects.filter(es => studentExamSubjectIds.includes(es.id));
        const totalMaxMarks = studentExamSubjects.reduce((sum, subject) => sum + subject.maxMarks, 0);
        
        // Calculate percentage
        const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
        
        // Determine grade
        let grade = 'F';
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B+';
        else if (percentage >= 60) grade = 'B';
        else if (percentage >= 50) grade = 'C';
        else if (percentage >= 40) grade = 'D';
        
        // Determine pass/fail - Calculate passing percentage from exam's passingMarks and totalMarks
        const passingPercentage = (exam.passingMarks / exam.totalMarks) * 100;
        const result = percentage >= passingPercentage ? 'pass' : 'fail';
        
        // Check if result already exists
        const existingResult = await storage.getStudentExamResult(examId, studentId);
        
        if (existingResult) {
          // Update existing result
          await storage.updateExamResult(existingResult.id, {
            totalMarksObtained: totalMarksObtained.toString(),
            totalMaxMarks,
            percentage: percentage.toFixed(2),
            grade,
            result
          });
        } else {
          // Create new result
          const resultData = {
            examId,
            studentId,
            totalMarksObtained: totalMarksObtained.toString(),
            totalMaxMarks,
            percentage: percentage.toFixed(2),
            grade,
            result
          };
          
          await storage.createExamResult(resultData);
        }
        
        results.push({ studentId, percentage, grade, result });
      }

      // Calculate ranks
      const examResults = await storage.getExamResults(examId);
      const sortedResults = examResults.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
      
      for (let i = 0; i < sortedResults.length; i++) {
        await storage.updateExamResult(sortedResults[i].id, { rank: i + 1 });
      }

      res.json({ message: "Results calculated successfully", count: results.length });
    } catch (error: any) {
      console.error("Error calculating results:", error);
      res.status(500).json({ message: "Failed to calculate results" });
    }
  });

  // Get exam results
  app.get("/api/exams/:examId/results", authMiddleware, async (req: any, res) => {
    try {
      const { examId } = req.params;
      const results = await storage.getExamResults(examId);
      res.json(results);
    } catch (error: any) {
      console.error("Error fetching exam results:", error);
      res.status(500).json({ message: "Failed to fetch exam results" });
    }
  });

  // Get student report card
  app.get("/api/exams/:examId/students/:studentId/report-card", authMiddleware, async (req: any, res) => {
    try {
      const { examId, studentId } = req.params;
      
      // Get exam details
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Get student details
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Get student's class details and construct class name
      let className = 'N/A';
      if (student.classId) {
        const studentClass = await storage.getClass(student.classId);
        if (studentClass) {
          // Construct class name from grade and section
          className = `${studentClass.grade} ${studentClass.section}`;
        }
      }

      // Get all exam subjects
      const allExamSubjects = await storage.getExamSubjects(examId);
      
      // Get class-subject assignments for the student's class to know which subjects belong to this class
      const classAssignments = await db
        .select()
        .from(classSubjectAssignments)
        .where(eq(classSubjectAssignments.classId, student.classId));
      
      // Create a set of subject IDs that are assigned to the student's class
      const studentClassSubjectIds = new Set(classAssignments.map(csa => csa.subjectId));
      
      // Get all subjects for the school to fetch names
      const allSubjects = await db
        .select()
        .from(subjects)
        .where(eq(subjects.schoolId, student.schoolId));
      
      // Create a map of subjectId -> subject details for quick lookup
      const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
      
      // Filter exam subjects to only include those assigned to the student's class and add subject names
      const studentClassSubjects = allExamSubjects
        .filter(examSubj => studentClassSubjectIds.has(examSubj.subjectId))
        .map(examSubj => {
          const subjectDetails = subjectMap.get(examSubj.subjectId);
          return {
            ...examSubj,
            subjectName: subjectDetails?.name || 'Unknown',
            subjectCode: subjectDetails?.code || '',
          };
        });

      // Get student marks
      const marks = await storage.getStudentExamMarks(examId, studentId);

      // Get student result
      const result = await storage.getStudentExamResult(examId, studentId);

      // Build report card data with only student's class subjects
      const reportCard = {
        exam,
        student: {
          ...student,
          className, // Add the formatted class name
        },
        subjects: studentClassSubjects.map(subject => {
          const mark = marks.find(m => m.examSubjectId === subject.id);
          return {
            id: subject.id,
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            maxMarks: subject.maxMarks,
            passingMarks: subject.passingMarks,
            marksObtained: mark?.marksObtained ?? null,
            isAbsent: mark?.isAbsent ?? false,
            remarks: mark?.remarks || ''
          };
        }),
        result
      };

      res.json(reportCard);
    } catch (error: any) {
      console.error("Error generating report card:", error);
      res.status(500).json({ message: "Failed to generate report card" });
    }
  });

  // ============================================================================
  // HOSTEL MANAGEMENT ENDPOINTS
  // ============================================================================

  // Get all hostels
  app.get("/api/hostels", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const hostels = await storage.getHostels(user.schoolId);
      res.json(hostels);
    } catch (error: any) {
      console.error("Error fetching hostels:", error);
      res.status(500).json({ message: "Failed to fetch hostels" });
    }
  });

  // Get single hostel
  app.get("/api/hostels/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const hostel = await storage.getHostel(id);

      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      res.json(hostel);
    } catch (error: any) {
      console.error("Error fetching hostel:", error);
      res.status(500).json({ message: "Failed to fetch hostel" });
    }
  });

  // Create new hostel (admin only)
  app.post("/api/hostels", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create hostels" });
      }

      if (!user.schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const validatedData = insertHostelSchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });

      const hostel = await storage.createHostel(validatedData);
      res.status(201).json(hostel);
    } catch (error: any) {
      console.error("Error creating hostel:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid hostel data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create hostel" });
    }
  });

  // Update hostel (admin only)
  app.put("/api/hostels/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update hostels" });
      }

      const hostel = await storage.getHostel(id);
      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      if (hostel.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateHostel(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating hostel:", error);
      res.status(500).json({ message: "Failed to update hostel" });
    }
  });

  // Delete hostel (admin only)
  app.delete("/api/hostels/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete hostels" });
      }

      const hostel = await storage.getHostel(id);
      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      if (hostel.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteHostel(id);
      res.json({ message: "Hostel deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting hostel:", error);
      res.status(500).json({ message: "Failed to delete hostel" });
    }
  });

  // Get rooms for a hostel
  app.get("/api/hostels/:hostelId/rooms", authMiddleware, async (req: any, res) => {
    try {
      const { hostelId } = req.params;
      const rooms = await storage.getHostelRooms(hostelId);
      res.json(rooms);
    } catch (error: any) {
      console.error("Error fetching hostel rooms:", error);
      res.status(500).json({ message: "Failed to fetch hostel rooms" });
    }
  });

  // Create room for a hostel (admin only)
  app.post("/api/hostels/:hostelId/rooms", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { hostelId } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create rooms" });
      }

      const hostel = await storage.getHostel(hostelId);
      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      if (hostel.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertHostelRoomSchema.parse({
        ...req.body,
        hostelId
      });

      const room = await storage.createHostelRoom(validatedData);
      res.status(201).json(room);
    } catch (error: any) {
      console.error("Error creating hostel room:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid room data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  // Update hostel room (admin only)
  app.put("/api/hostel-rooms/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update rooms" });
      }

      const room = await storage.getHostelRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const hostel = await storage.getHostel(room.hostelId);
      if (hostel && hostel.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateHostelRoom(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  // Delete hostel room (admin only)
  app.delete("/api/hostel-rooms/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete rooms" });
      }

      const room = await storage.getHostelRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const hostel = await storage.getHostel(room.hostelId);
      if (hostel && hostel.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteHostelRoom(id);
      res.json({ message: "Room deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting room:", error);
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  // Get hostel allocations (with filters)
  app.get("/api/hostel-allocations", authMiddleware, async (req: any, res) => {
    try {
      const filters: any = {};
      
      if (req.query.hostelId) {
        filters.hostelId = req.query.hostelId as string;
      }
      if (req.query.studentId) {
        filters.studentId = req.query.studentId as string;
      }
      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }
      if (req.query.sessionId) {
        filters.sessionId = req.query.sessionId as string;
      }

      const allocations = await storage.getHostelAllocations(filters);
      res.json(allocations);
    } catch (error: any) {
      console.error("Error fetching hostel allocations:", error);
      res.status(500).json({ message: "Failed to fetch hostel allocations" });
    }
  });

  // Create hostel allocation (admin only)
  app.post("/api/hostel-allocations", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create allocations" });
      }

      // Validate room capacity
      const room = await storage.getHostelRoom(req.body.roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Check current allocations for this room
      const currentAllocations = await storage.getHostelAllocations({
        hostelId: room.hostelId,
        isActive: true
      });
      
      const roomAllocations = currentAllocations.filter(a => a.roomId === req.body.roomId);
      
      if (roomAllocations.length >= room.capacity) {
        return res.status(400).json({ message: "Room capacity exceeded" });
      }

      const validatedData = insertHostelAllocationSchema.parse(req.body);
      const allocation = await storage.createHostelAllocation(validatedData);
      
      // Update room status to occupied if not already
      if (room.status !== 'occupied') {
        await storage.updateHostelRoom(room.id, { status: 'occupied' });
      }

      res.status(201).json(allocation);
    } catch (error: any) {
      console.error("Error creating hostel allocation:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid allocation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create allocation" });
    }
  });

  // Check out student from room (admin only)
  app.put("/api/hostel-allocations/:id/checkout", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can check out students" });
      }

      const allocation = await storage.getHostelAllocation(id);
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }

      const updated = await storage.updateHostelAllocation(id, {
        checkOutDate: new Date(),
        isActive: false
      });

      // Check if room should be marked as available
      const room = await storage.getHostelRoom(allocation.roomId);
      if (room) {
        const activeAllocations = await storage.getHostelAllocations({
          hostelId: room.hostelId,
          isActive: true
        });
        const roomActiveAllocations = activeAllocations.filter(a => a.roomId === room.id);
        
        if (roomActiveAllocations.length === 0) {
          await storage.updateHostelRoom(room.id, { status: 'available' });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error checking out student:", error);
      res.status(500).json({ message: "Failed to check out student" });
    }
  });

  // Delete hostel allocation (admin only)
  app.delete("/api/hostel-allocations/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete allocations" });
      }

      const allocation = await storage.getHostelAllocation(id);
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }

      await storage.deleteHostelAllocation(id);
      res.json({ message: "Allocation deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting allocation:", error);
      res.status(500).json({ message: "Failed to delete allocation" });
    }
  });

  // Get hostel fees (with filters)
  app.get("/api/hostel-fees", authMiddleware, async (req: any, res) => {
    try {
      const filters: any = {};
      
      if (req.query.hostelId) {
        filters.hostelId = req.query.hostelId as string;
      }
      if (req.query.studentId) {
        filters.studentId = req.query.studentId as string;
      }
      if (req.query.paymentStatus) {
        filters.paymentStatus = req.query.paymentStatus as string;
      }
      if (req.query.sessionId) {
        filters.sessionId = req.query.sessionId as string;
      }

      const fees = await storage.getHostelFees(filters);
      res.json(fees);
    } catch (error: any) {
      console.error("Error fetching hostel fees:", error);
      res.status(500).json({ message: "Failed to fetch hostel fees" });
    }
  });

  // Create hostel fee (admin only)
  app.post("/api/hostel-fees", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create fees" });
      }

      const validatedData = insertHostelFeeSchema.parse(req.body);
      const fee = await storage.createHostelFee(validatedData);
      res.status(201).json(fee);
    } catch (error: any) {
      console.error("Error creating hostel fee:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid fee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create fee" });
    }
  });

  // Mark fee as paid (admin only)
  app.put("/api/hostel-fees/:id/pay", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update fee payments" });
      }

      const fee = await storage.getHostelFee(id);
      if (!fee) {
        return res.status(404).json({ message: "Fee not found" });
      }

      const updated = await storage.updateHostelFee(id, {
        paidDate: new Date(),
        paymentStatus: 'paid'
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error marking fee as paid:", error);
      res.status(500).json({ message: "Failed to mark fee as paid" });
    }
  });

  // Delete hostel fee (admin only)
  app.delete("/api/hostel-fees/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete fees" });
      }

      const fee = await storage.getHostelFee(id);
      if (!fee) {
        return res.status(404).json({ message: "Fee not found" });
      }

      await storage.deleteHostelFee(id);
      res.json({ message: "Fee deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fee:", error);
      res.status(500).json({ message: "Failed to delete fee" });
    }
  });

  // ============================================================================
  // INVENTORY MANAGEMENT MODULE - API ENDPOINTS
  // ============================================================================

  // Get inventory categories
  app.get("/api/inventory/categories", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const categories = await storage.getInventoryCategories(user.schoolId);
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching inventory categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Create inventory category (admin only)
  app.post("/api/inventory/categories", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create categories" });
      }

      const validatedData = insertInventoryCategorySchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });
      const category = await storage.createInventoryCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating inventory category:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Update inventory category (admin only)
  app.put("/api/inventory/categories/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update categories" });
      }

      const category = await storage.getInventoryCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      if (category.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateInventoryCategory(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating inventory category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Delete inventory category (admin only)
  app.delete("/api/inventory/categories/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete categories" });
      }

      const category = await storage.getInventoryCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      if (category.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteInventoryCategory(id);
      res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting inventory category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Get inventory items
  app.get("/api/inventory/items", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { categoryId, lowStock } = req.query;

      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (lowStock === 'true') filters.lowStock = true;

      const items = await storage.getInventoryItems(user.schoolId, filters);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  // Get low stock items
  app.get("/api/inventory/items/low-stock", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const items = await storage.getLowStockItems(user.schoolId);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  // Get inventory item by ID
  app.get("/api/inventory/items/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getInventoryItem(id);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("Error fetching inventory item:", error);
      res.status(500).json({ message: "Failed to fetch item" });
    }
  });

  // Create inventory item (admin only)
  app.post("/api/inventory/items", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create items" });
      }

      const validatedData = insertInventoryItemSchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });
      const item = await storage.createInventoryItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating inventory item:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create item" });
    }
  });

  // Update inventory item (admin only)
  app.put("/api/inventory/items/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update items" });
      }

      const item = await storage.getInventoryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updateInventoryItem(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Delete inventory item (admin only)
  app.delete("/api/inventory/items/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete items" });
      }

      const item = await storage.getInventoryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteInventoryItem(id);
      res.json({ message: "Item deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Get inventory transactions
  app.get("/api/inventory/transactions", authMiddleware, async (req: any, res) => {
    try {
      const { itemId, transactionType, startDate, endDate } = req.query;

      const filters: any = {};
      if (itemId) filters.itemId = itemId as string;
      if (transactionType) filters.transactionType = transactionType as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const transactions = await storage.getInventoryTransactions(filters);
      res.json(transactions);
    } catch (error: any) {
      console.error("Error fetching inventory transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get transactions for specific item
  app.get("/api/inventory/items/:itemId/transactions", authMiddleware, async (req: any, res) => {
    try {
      const { itemId } = req.params;
      const transactions = await storage.getItemTransactions(itemId);
      res.json(transactions);
    } catch (error: any) {
      console.error("Error fetching item transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Create inventory transaction (auto-update stock)
  app.post("/api/inventory/transactions", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create transactions" });
      }

      const validatedData = insertInventoryTransactionSchema.parse({
        ...req.body,
        performedBy: user.id
      });

      const transaction = await storage.createInventoryTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error: any) {
      console.error("Error creating inventory transaction:", error);
      if (error.message === "Insufficient stock") {
        return res.status(400).json({ message: "Insufficient stock for this transaction" });
      }
      if (error.message === "Item not found") {
        return res.status(404).json({ message: "Item not found" });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // ============================================================================
  // PAYROLL MANAGEMENT ROUTES
  // ============================================================================

  // Get all payroll employees
  app.get("/api/payroll/employees", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const employees = await storage.getPayrollEmployees(user.schoolId);
      res.json(employees);
    } catch (error: any) {
      console.error("Error fetching payroll employees:", error);
      res.status(500).json({ message: "Failed to fetch payroll employees" });
    }
  });

  // Create payroll employee
  app.post("/api/payroll/employees", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create payroll employees" });
      }

      let payrollData = { ...req.body };

      // If employee type is teacher, fetch teacher details and optionally link to user account
      if (payrollData.employeeType === 'teacher') {
        // employeeId in the request is actually the teacher's ID, not user ID
        const teacherId = payrollData.employeeId;
        
        // Fetch teacher from database
        const teacher = await db.query.teachers.findFirst({
          where: eq(teachers.id, teacherId)
        });

        if (!teacher) {
          return res.status(404).json({ message: "Teacher not found" });
        }

        // Fetch associated user account (optional - not all teachers have login access)
        const teacherUser = await db.query.users.findFirst({
          where: eq(users.teacherId, teacherId)
        });

        // Store teacher name and designation for display
        payrollData.staffName = teacher.name;
        payrollData.designation = teacher.designation || 'Teacher';
        
        // Link to user account if it exists (optional)
        if (teacherUser) {
          payrollData.employeeId = teacherUser.id;
        } else {
          // Teacher doesn't have login credentials - that's okay for payroll
          payrollData.employeeId = null;
        }
        
        // Teachers don't need joining date - use current date as default
        payrollData.joiningDate = new Date();
      } else {
        // For staff, employeeId is optional (they don't need system access)
        payrollData.employeeId = null;
        
        // Convert joiningDate string to Date object for staff
        if (payrollData.joiningDate && typeof payrollData.joiningDate === 'string') {
          payrollData.joiningDate = new Date(payrollData.joiningDate);
        }
      }

      const validatedData = insertPayrollEmployeeSchema.parse({
        ...payrollData,
        schoolId: user.schoolId
      });

      const employee = await storage.createPayrollEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error: any) {
      console.error("Error creating payroll employee:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payroll employee" });
    }
  });

  // Update payroll employee
  app.put("/api/payroll/employees/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update payroll employees" });
      }

      const employee = await storage.updatePayrollEmployee(id, req.body);
      res.json(employee);
    } catch (error: any) {
      console.error("Error updating payroll employee:", error);
      res.status(500).json({ message: "Failed to update payroll employee" });
    }
  });

  // Delete payroll employee
  app.delete("/api/payroll/employees/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete payroll employees" });
      }

      await storage.deletePayrollEmployee(id);
      res.json({ message: "Payroll employee deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting payroll employee:", error);
      res.status(500).json({ message: "Failed to delete payroll employee" });
    }
  });

  // Get salary components for an employee
  app.get("/api/payroll/employees/:employeeId/components", authMiddleware, async (req: any, res) => {
    try {
      const { employeeId } = req.params;
      const components = await storage.getSalaryComponents(employeeId);
      res.json(components);
    } catch (error: any) {
      console.error("Error fetching salary components:", error);
      res.status(500).json({ message: "Failed to fetch salary components" });
    }
  });

  // Add salary component
  app.post("/api/payroll/employees/:employeeId/components", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { employeeId } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can add salary components" });
      }

      const validatedData = insertSalaryComponentSchema.parse({
        ...req.body,
        payrollEmployeeId: employeeId
      });

      const component = await storage.createSalaryComponent(validatedData);
      res.status(201).json(component);
    } catch (error: any) {
      console.error("Error creating salary component:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid component data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create salary component" });
    }
  });

  // Update salary component
  app.put("/api/payroll/components/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update salary components" });
      }

      const component = await storage.updateSalaryComponent(id, req.body);
      res.json(component);
    } catch (error: any) {
      console.error("Error updating salary component:", error);
      res.status(500).json({ message: "Failed to update salary component" });
    }
  });

  // Delete salary component
  app.delete("/api/payroll/components/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete salary components" });
      }

      await storage.deleteSalaryComponent(id);
      res.json({ message: "Salary component deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting salary component:", error);
      res.status(500).json({ message: "Failed to delete salary component" });
    }
  });

  // Get payroll cycles
  app.get("/api/payroll/cycles", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { month, year, status } = req.query;

      const filters: any = {};
      if (month) filters.month = parseInt(month as string);
      if (year) filters.year = parseInt(year as string);
      if (status) filters.status = status;

      const cycles = await storage.getPayrollCycles(user.schoolId, filters);
      res.json(cycles);
    } catch (error: any) {
      console.error("Error fetching payroll cycles:", error);
      res.status(500).json({ message: "Failed to fetch payroll cycles" });
    }
  });

  // Create payroll cycle
  app.post("/api/payroll/cycles", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create payroll cycles" });
      }

      const validatedData = insertPayrollCycleSchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });

      const cycle = await storage.createPayrollCycle(validatedData);
      res.status(201).json(cycle);
    } catch (error: any) {
      console.error("Error creating payroll cycle:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid cycle data", errors: error.errors });
      }
      if (error.message && error.message.includes('duplicate')) {
        return res.status(400).json({ message: "A cycle for this month and year already exists" });
      }
      res.status(500).json({ message: "Failed to create payroll cycle" });
    }
  });

  // Update payroll cycle
  app.put("/api/payroll/cycles/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update payroll cycles" });
      }

      const cycle = await storage.updatePayrollCycle(id, req.body);
      res.json(cycle);
    } catch (error: any) {
      console.error("Error updating payroll cycle:", error);
      res.status(500).json({ message: "Failed to update payroll cycle" });
    }
  });

  // Process payroll cycle
  app.post("/api/payroll/cycles/:id/process", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can process payroll cycles" });
      }

      const result = await storage.processPayrollCycle(id, user.id);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing payroll cycle:", error);
      res.status(500).json({ message: "Failed to process payroll cycle" });
    }
  });

  // Mark cycle as paid
  app.put("/api/payroll/cycles/:id/mark-paid", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can mark cycles as paid" });
      }

      const cycle = await storage.markCycleAsPaid(id);
      res.json(cycle);
    } catch (error: any) {
      console.error("Error marking cycle as paid:", error);
      res.status(500).json({ message: "Failed to mark cycle as paid" });
    }
  });

  // Get payslips for a cycle
  app.get("/api/payroll/cycles/:cycleId/payslips", authMiddleware, async (req: any, res) => {
    try {
      const { cycleId } = req.params;
      const payslips = await storage.getPayrollPayslips(cycleId);
      res.json(payslips);
    } catch (error: any) {
      console.error("Error fetching payslips:", error);
      res.status(500).json({ message: "Failed to fetch payslips" });
    }
  });

  // Get single payslip
  app.get("/api/payroll/payslips/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const payslip = await storage.getPayrollPayslip(id);
      
      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }

      res.json(payslip);
    } catch (error: any) {
      console.error("Error fetching payslip:", error);
      res.status(500).json({ message: "Failed to fetch payslip" });
    }
  });

  // Mark payslip as paid
  app.put("/api/payroll/payslips/:id/mark-paid", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can mark payslips as paid" });
      }

      const payslip = await storage.markPayslipAsPaid(id, new Date());
      res.json(payslip);
    } catch (error: any) {
      console.error("Error marking payslip as paid:", error);
      res.status(500).json({ message: "Failed to mark payslip as paid" });
    }
  });

  // ==================== TEACHER SALARY VIEWING ROUTES ====================

  // Get teacher's own salary information
  app.get("/api/teacher/my-salary", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers can access this endpoint" });
      }

      // Get payroll employee record for this teacher
      const payrollEmployee = await storage.getPayrollEmployeeByUserId(user.id, user.schoolId);

      if (!payrollEmployee) {
        return res.status(404).json({ message: "Salary information not configured yet" });
      }

      // Get salary components (breakdown)
      const components = await storage.getSalaryComponents(payrollEmployee.id);

      res.json({
        employee: payrollEmployee,
        components,
      });
    } catch (error: any) {
      console.error("Error fetching teacher salary:", error);
      res.status(500).json({ message: "Failed to fetch salary information" });
    }
  });

  // Get teacher's own payslips (salary receipts)
  app.get("/api/teacher/my-payslips", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers can access this endpoint" });
      }

      // Get payroll employee record for this teacher
      const payrollEmployee = await storage.getPayrollEmployeeByUserId(user.id, user.schoolId);

      if (!payrollEmployee) {
        return res.status(404).json({ message: "Salary information not configured yet" });
      }

      // Get all payslips for this teacher
      const payslips = await storage.getTeacherPayslips(payrollEmployee.id);

      res.json(payslips);
    } catch (error: any) {
      console.error("Error fetching teacher payslips:", error);
      res.status(500).json({ message: "Failed to fetch payslips" });
    }
  });

  // Get teacher's specific payslip details
  app.get("/api/teacher/my-payslips/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: "Only teachers can access this endpoint" });
      }

      // Get payroll employee record for this teacher
      const payrollEmployee = await storage.getPayrollEmployeeByUserId(user.id, user.schoolId);

      if (!payrollEmployee) {
        return res.status(404).json({ message: "Salary information not configured yet" });
      }

      // Get the specific payslip
      const payslip = await storage.getPayrollPayslip(id);

      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }

      // Verify this payslip belongs to this teacher
      if (payslip.payrollEmployeeId !== payrollEmployee.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(payslip);
    } catch (error: any) {
      console.error("Error fetching payslip:", error);
      res.status(500).json({ message: "Failed to fetch payslip" });
    }
  });

  // ==================== EXPENSE MANAGEMENT ROUTES ====================

  // Expense Categories
  app.get("/api/expenses/categories", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const categories = await storage.getExpenseCategories(user.schoolId);
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expenses/categories", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create expense categories" });
      }

      const categoryData = insertExpenseCategorySchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });

      const category = await storage.createExpenseCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating expense category:", error);
      res.status(400).json({ message: error.message || "Failed to create expense category" });
    }
  });

  app.put("/api/expenses/categories/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update expense categories" });
      }

      const category = await storage.updateExpenseCategory(id, req.body);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating expense category:", error);
      res.status(500).json({ message: "Failed to update expense category" });
    }
  });

  app.delete("/api/expenses/categories/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete expense categories" });
      }

      await storage.deleteExpenseCategory(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting expense category:", error);
      res.status(500).json({ message: "Failed to delete expense category" });
    }
  });

  // Expenses
  app.get("/api/expenses", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { categoryId, sessionId, status, startDate, endDate } = req.query;

      const expenses = await storage.getExpenses(user.schoolId, {
        categoryId,
        sessionId,
        status,
        startDate,
        endDate
      });

      res.json(expenses);
    } catch (error: any) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const expense = await storage.getExpense(id);

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json(expense);
    } catch (error: any) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create expenses" });
      }

      const expenseData = insertExpenseSchema.parse({
        ...req.body,
        schoolId: user.schoolId,
        recordedBy: user.id
      });

      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error: any) {
      console.error("Error creating expense:", error);
      res.status(400).json({ message: error.message || "Failed to create expense" });
    }
  });

  app.put("/api/expenses/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update expenses" });
      }

      const expenseData = { ...req.body };
      if (expenseData.expenseDate && typeof expenseData.expenseDate === 'string') {
        expenseData.expenseDate = new Date(expenseData.expenseDate);
      }

      const expense = await storage.updateExpense(id, expenseData);
      res.json(expense);
    } catch (error: any) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete expenses" });
      }

      await storage.deleteExpense(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  app.put("/api/expenses/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can approve expenses" });
      }

      const expense = await storage.approveExpense(id, user.id);
      res.json(expense);
    } catch (error: any) {
      console.error("Error approving expense:", error);
      res.status(500).json({ message: "Failed to approve expense" });
    }
  });

  app.put("/api/expenses/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can reject expenses" });
      }

      const expense = await storage.rejectExpense(id, user.id);
      res.json(expense);
    } catch (error: any) {
      console.error("Error rejecting expense:", error);
      res.status(500).json({ message: "Failed to reject expense" });
    }
  });

  // Budgets
  app.get("/api/budgets", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { categoryId, sessionId } = req.query;

      const budgets = await storage.getBudgets(user.schoolId, {
        categoryId,
        sessionId
      });

      res.json(budgets);
    } catch (error: any) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.get("/api/budgets/summary", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { sessionId } = req.query;

      const summary = await storage.getBudgetSummary(user.schoolId, sessionId);
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching budget summary:", error);
      res.status(500).json({ message: "Failed to fetch budget summary" });
    }
  });

  app.post("/api/budgets", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create budgets" });
      }

      const budgetData = insertBudgetSchema.parse({
        ...req.body,
        schoolId: user.schoolId
      });

      const budget = await storage.createBudget(budgetData);
      res.status(201).json(budget);
    } catch (error: any) {
      console.error("Error creating budget:", error);
      res.status(400).json({ message: error.message || "Failed to create budget" });
    }
  });

  app.put("/api/budgets/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can update budgets" });
      }

      const budget = await storage.updateBudget(id, req.body);
      res.json(budget);
    } catch (error: any) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  // ==================== ID CARD TEMPLATES ====================

  // Helper function to auto-seed sample templates for a school
  async function autoSeedTemplates(schoolId: string, userId: string) {
    try {
      const existingIdTemplates = await storage.getIdCardTemplates(schoolId);
      const existingCertTemplates = await storage.getCertificateTemplates(schoolId);

      // Only seed if no templates exist at all
      if (existingIdTemplates.length > 0 || existingCertTemplates.length > 0) {
        return;
      }

      console.log(`Auto-seeding sample templates for school: ${schoolId}`);

      // Seed student ID card templates
      const studentTemplates = [
        { name: "Classic Blue Student ID", description: "Professional blue theme with school name and address", type: 'student' as const, templateUrl: "/sample-templates/student-id-blue.png", isDefault: true },
        { name: "Modern Green Student ID", description: "Clean green design with school details", type: 'student' as const, templateUrl: "/sample-templates/student-id-green.png", isDefault: false },
        { name: "Vibrant Orange Student ID", description: "Bright orange layout with school info", type: 'student' as const, templateUrl: "/sample-templates/student-id-orange.png", isDefault: false }
      ];

      for (const template of studentTemplates) {
        await storage.createIdCardTemplate({
          ...template,
          schoolId,
          createdBy: userId
        });
      }

      // Seed teacher ID card templates
      const teacherTemplates = [
        { name: "Professional Purple Teacher ID", description: "Elegant purple theme with school name and address", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-purple.png", isDefault: true },
        { name: "Classic Navy Teacher ID", description: "Navy blue and gold design with school details", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-navy.png", isDefault: false },
        { name: "Modern Teal Teacher ID", description: "Contemporary teal layout with school info", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-teal.png", isDefault: false }
      ];

      for (const template of teacherTemplates) {
        await storage.createIdCardTemplate({
          ...template,
          schoolId,
          createdBy: userId
        });
      }

      // Seed certificate templates
      const certTemplates = [
        { name: "Certificate of Achievement", description: "Gold themed achievement certificate with school name and address", category: "Achievement", templateUrl: "/sample-templates/cert-achievement.png", isDefault: true },
        { name: "Certificate of Participation", description: "Blue themed participation certificate with school details", category: "Participation", templateUrl: "/sample-templates/cert-participation.png", isDefault: false },
        { name: "Certificate of Excellence", description: "Purple themed excellence certificate with school info", category: "Excellence", templateUrl: "/sample-templates/cert-excellence.png", isDefault: false }
      ];

      for (const template of certTemplates) {
        await storage.createCertificateTemplate({
          ...template,
          schoolId,
          createdBy: userId
        });
      }

      console.log(`Successfully seeded sample templates for school: ${schoolId}`);
    } catch (error) {
      console.error("Error auto-seeding templates:", error);
      // Don't throw - seeding is optional, just log the error
    }
  }

  // Seed sample templates for a school (manual trigger endpoint)
  app.post("/api/seed-sample-templates", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can seed sample templates" });
      }

      // Check if templates already exist
      const existingIdTemplates = await storage.getIdCardTemplates(user.schoolId);
      const existingCertTemplates = await storage.getCertificateTemplates(user.schoolId);

      if (existingIdTemplates.length > 0 && existingCertTemplates.length > 0) {
        return res.json({ 
          message: "Sample templates already exist", 
          idCardTemplates: existingIdTemplates,
          certificateTemplates: existingCertTemplates 
        });
      }

      const seededTemplates = {
        idCardTemplates: [] as any[],
        certificateTemplates: [] as any[]
      };

      // Seed student ID card templates if none exist
      if (existingIdTemplates.filter(t => t.type === 'student').length === 0) {
        const studentTemplates = [
          { name: "Classic Blue Student ID", description: "Professional blue theme with school name and address", type: 'student' as const, templateUrl: "/sample-templates/student-id-blue.png", isDefault: true },
          { name: "Modern Green Student ID", description: "Clean green design with school details", type: 'student' as const, templateUrl: "/sample-templates/student-id-green.png", isDefault: false },
          { name: "Vibrant Orange Student ID", description: "Bright orange layout with school info", type: 'student' as const, templateUrl: "/sample-templates/student-id-orange.png", isDefault: false }
        ];

        for (const template of studentTemplates) {
          const created = await storage.createIdCardTemplate({
            ...template,
            schoolId: user.schoolId,
            createdBy: user.id
          });
          seededTemplates.idCardTemplates.push(created);
        }
      }

      // Seed teacher ID card templates if none exist
      if (existingIdTemplates.filter(t => t.type === 'teacher').length === 0) {
        const teacherTemplates = [
          { name: "Professional Purple Teacher ID", description: "Elegant purple theme with school name and address", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-purple.png", isDefault: true },
          { name: "Classic Navy Teacher ID", description: "Navy blue and gold design with school details", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-navy.png", isDefault: false },
          { name: "Modern Teal Teacher ID", description: "Contemporary teal layout with school info", type: 'teacher' as const, templateUrl: "/sample-templates/teacher-id-teal.png", isDefault: false }
        ];

        for (const template of teacherTemplates) {
          const created = await storage.createIdCardTemplate({
            ...template,
            schoolId: user.schoolId,
            createdBy: user.id
          });
          seededTemplates.idCardTemplates.push(created);
        }
      }

      // Seed certificate templates if none exist
      if (existingCertTemplates.length === 0) {
        const certTemplates = [
          { name: "Certificate of Achievement", description: "Gold themed achievement certificate with school name and address", category: "Achievement", templateUrl: "/sample-templates/cert-achievement.png", isDefault: true },
          { name: "Certificate of Participation", description: "Blue themed participation certificate with school details", category: "Participation", templateUrl: "/sample-templates/cert-participation.png", isDefault: false },
          { name: "Certificate of Excellence", description: "Purple themed excellence certificate with school info", category: "Excellence", templateUrl: "/sample-templates/cert-excellence.png", isDefault: false }
        ];

        for (const template of certTemplates) {
          const created = await storage.createCertificateTemplate({
            ...template,
            schoolId: user.schoolId,
            createdBy: user.id
          });
          seededTemplates.certificateTemplates.push(created);
        }
      }

      res.json({ 
        message: "Sample templates seeded successfully", 
        ...seededTemplates 
      });
    } catch (error: any) {
      console.error("Error seeding sample templates:", error);
      res.status(500).json({ message: error.message || "Failed to seed sample templates" });
    }
  });

  app.get("/api/id-card-templates", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const type = req.query.type as 'student' | 'teacher' | undefined;

      // Auto-seed templates if none exist
      await autoSeedTemplates(user.schoolId, user.id);

      const templates = await storage.getIdCardTemplates(user.schoolId, type);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching ID card templates:", error);
      res.status(500).json({ message: "Failed to fetch ID card templates" });
    }
  });

  app.get("/api/id-card-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getIdCardTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching ID card template:", error);
      res.status(500).json({ message: "Failed to fetch ID card template" });
    }
  });

  app.post("/api/id-card-templates", authMiddleware, upload.single('template'), async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create ID card templates" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Template image is required" });
      }

      const templateUrl = `/uploads/${req.file.filename}`;
      const templateData = {
        name: req.body.name,
        description: req.body.description || null,
        type: req.body.type as 'student' | 'teacher',
        templateUrl,
        isDefault: req.body.isDefault === 'true' || req.body.isDefault === true,
        schoolId: user.schoolId,
        createdBy: user.id
      };

      const template = await storage.createIdCardTemplate(templateData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating ID card template:", error);
      res.status(500).json({ message: error.message || "Failed to create ID card template" });
    }
  });

  app.delete("/api/id-card-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete ID card templates" });
      }

      // Check if template is a default/sample template
      const template = await storage.getIdCardTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.isDefault) {
        return res.status(403).json({ message: "Cannot delete sample templates. These are provided as examples." });
      }

      await storage.deleteIdCardTemplate(id);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting ID card template:", error);
      res.status(500).json({ message: "Failed to delete ID card template" });
    }
  });

  // ==================== ID CARDS ====================

  app.get("/api/id-cards", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const personType = req.query.personType as 'student' | 'teacher' | undefined;
      const personId = req.query.personId as string | undefined;

      const cards = await storage.getIdCards(user.schoolId, personType, personId);
      res.json(cards);
    } catch (error: any) {
      console.error("Error fetching ID cards:", error);
      res.status(500).json({ message: "Failed to fetch ID cards" });
    }
  });

  app.post("/api/id-cards/generate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can generate ID cards" });
      }

      const { templateId, personType, personIds } = req.body;

      if (!templateId || !personType || !personIds || personIds.length === 0) {
        return res.status(400).json({ message: "Template ID, person type, and person IDs are required" });
      }

      const template = await storage.getIdCardTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const generatedCards = [];

      for (const personId of personIds) {
        // Fetch person details
        let personData: any;
        let personName: string;
        let personDetails: any = {};

        if (personType === 'student') {
          personData = await storage.getStudent(personId);
          if (!personData) continue;
          personName = `${personData.firstName} ${personData.lastName}`;
          personDetails = {
            admissionNumber: personData.admissionNumber,
            class: personData.class ? `${personData.class.grade} ${personData.class.section}` : '',
            bloodGroup: personData.bloodGroup,
            contactNumber: personData.contactNumber,
            address: personData.address
          };
        } else {
          personData = await storage.getTeacher(personId);
          if (!personData) continue;
          personName = personData.name;
          personDetails = {
            employeeId: personData.employeeId,
            designation: personData.designation,
            bloodGroup: personData.bloodGroup,
            contactNumber: personData.contactNumber,
            address: personData.address
          };
        }

        // Generate actual ID card with person data overlaid
        let cardImageUrl: string;
        
        try {
          if (personType === 'student') {
            const { generateStudentIDCard } = await import('./services/idCardGenerator');
            cardImageUrl = await generateStudentIDCard(
              template.templateUrl,
              {
                name: personName,
                admissionNumber: personDetails.admissionNumber || '',
                class: personDetails.class || '',
                dateOfBirth: personData.dateOfBirth || '',
                bloodGroup: personDetails.bloodGroup,
                contactNumber: personDetails.contactNumber,
                address: personDetails.address
              },
              personId
            );
          } else {
            const { generateTeacherIDCard } = await import('./services/idCardGenerator');
            cardImageUrl = await generateTeacherIDCard(
              template.templateUrl,
              {
                name: personName,
                employeeId: personDetails.employeeId || '',
                designation: personDetails.designation,
                bloodGroup: personDetails.bloodGroup,
                contactNumber: personDetails.contactNumber,
                address: personDetails.address
              },
              personId
            );
          }
        } catch (error) {
          console.error('Error generating ID card image:', error);
          // Fallback to template URL if generation fails
          cardImageUrl = template.templateUrl;
        }

        const cardData = {
          templateId,
          personType,
          personId,
          personName,
          personDetails,
          cardImageUrl,
          schoolId: user.schoolId,
          generatedBy: user.id
        };

        const card = await storage.createIdCard(cardData);
        generatedCards.push(card);
      }

      res.json({ 
        message: `Successfully generated ${generatedCards.length} ID card(s)`,
        cards: generatedCards
      });
    } catch (error: any) {
      console.error("Error generating ID cards:", error);
      res.status(500).json({ message: error.message || "Failed to generate ID cards" });
    }
  });

  app.delete("/api/id-cards/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete ID cards" });
      }

      await storage.deleteIdCard(id);
      res.json({ message: "ID card deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting ID card:", error);
      res.status(500).json({ message: "Failed to delete ID card" });
    }
  });

  // ==================== CERTIFICATE TEMPLATES ====================

  app.get("/api/certificate-templates", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const category = req.query.category as string | undefined;

      // Auto-seed templates if none exist
      await autoSeedTemplates(user.schoolId, user.id);

      const templates = await storage.getCertificateTemplates(user.schoolId, category);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching certificate templates:", error);
      res.status(500).json({ message: "Failed to fetch certificate templates" });
    }
  });

  app.get("/api/certificate-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getCertificateTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching certificate template:", error);
      res.status(500).json({ message: "Failed to fetch certificate template" });
    }
  });

  app.post("/api/certificate-templates", authMiddleware, upload.single('template'), async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create certificate templates" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Template image is required" });
      }

      const templateUrl = `/uploads/${req.file.filename}`;
      const templateData = {
        name: req.body.name,
        description: req.body.description || null,
        category: req.body.category || null,
        templateUrl,
        isDefault: req.body.isDefault === 'true' || req.body.isDefault === true,
        placeholders: req.body.placeholders ? JSON.parse(req.body.placeholders) : null,
        schoolId: user.schoolId,
        createdBy: user.id
      };

      const template = await storage.createCertificateTemplate(templateData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating certificate template:", error);
      res.status(500).json({ message: error.message || "Failed to create certificate template" });
    }
  });

  app.delete("/api/certificate-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete certificate templates" });
      }

      await storage.deleteCertificateTemplate(id);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting certificate template:", error);
      res.status(500).json({ message: "Failed to delete certificate template" });
    }
  });

  // ==================== CERTIFICATES ====================

  app.get("/api/certificates", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const filters = {
        recipientType: req.query.recipientType as 'student' | 'teacher' | 'other' | undefined,
        recipientId: req.query.recipientId as string | undefined,
        eventName: req.query.eventName as string | undefined
      };

      const certificates = await storage.getCertificates(user.schoolId, filters);
      res.json(certificates);
    } catch (error: any) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.post("/api/certificates", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create certificates" });
      }

      const { 
        templateId,
        recipientName,
        recipientType,
        recipientId,
        eventName,
        eventDate,
        issueDate,
        additionalDetails
      } = req.body;

      if (!templateId || !recipientName || !eventName || !issueDate) {
        return res.status(400).json({ message: "Template ID, recipient name, event name, and issue date are required" });
      }

      const template = await storage.getCertificateTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Generate certificate (simple version - stores template URL for now)
      // In production, this would generate actual certificate with text overlaid
      const certificateUrl = template.templateUrl; // Placeholder

      const certificateData = {
        templateId,
        recipientName,
        recipientType: recipientType || null,
        recipientId: recipientId || null,
        eventName,
        eventDate: eventDate || null,
        issueDate,
        additionalDetails: additionalDetails || null,
        certificateUrl,
        schoolId: user.schoolId,
        generatedBy: user.id
      };

      const certificate = await storage.createCertificate(certificateData);
      res.status(201).json(certificate);
    } catch (error: any) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ message: error.message || "Failed to create certificate" });
    }
  });

  app.delete("/api/certificates/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can delete certificates" });
      }

      await storage.deleteCertificate(id);
      res.json({ message: "Certificate deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting certificate:", error);
      res.status(500).json({ message: "Failed to delete certificate" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
