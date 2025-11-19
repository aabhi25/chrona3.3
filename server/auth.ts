import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { loginSchema } from "@shared/schema";
import { getCurrentDateTimeIST } from "@shared/utils/dateUtils";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-jwt-secret-change-in-production' : (() => {
  console.error("FATAL: JWT_SECRET environment variable is required for secure token signing");
  process.exit(1);
})());

// Define custom user type with all fields (including sensitive fields for internal use)
interface AuthUser {
  id: string;
  email: string | null;
  loginId: string;
  passwordHash: string;
  temporaryPassword: string | null;
  temporaryPasswordExpiresAt?: Date | null;
  role: "super_admin" | "admin" | "teacher" | "student" | "parent";
  isFirstLogin: boolean;
  schoolId?: string | null;
  teacherId?: string | null;
  studentId?: string | null;
  parentId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  passwordChangedAt?: Date | null;
  lastLoginAt?: Date | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export async function hashTemporaryPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function compareTemporaryPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateTemporaryPasswordExpiry(hoursFromNow: number = 48): Date {
  const expiryDate = getCurrentDateTimeIST();
  expiryDate.setHours(expiryDate.getHours() + hoursFromNow);
  return expiryDate;
}

export function isTemporaryPasswordExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return getCurrentDateTimeIST() > expiresAt;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      schoolId: user.schoolId 
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate requests
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

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
    
    req.user = user as AuthUser;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication failed" });
  }
}

// Middleware to check user roles
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Middleware to check school access (for non-super admins)
export function requireSchoolAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Super admins can access any school
  if (req.user.role === "super_admin") {
    return next();
  }

  // Check if user belongs to the school they're trying to access
  const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
  
  if (schoolId && req.user.schoolId !== schoolId) {
    return res.status(403).json({ message: "Access denied to this school" });
  }

  next();
}

// Middleware to check module-level permissions
export function requireModulePermission(
  moduleNameOrId: string,
  action: 'read' | 'write' | 'delete' | 'export' = 'read'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Super admins have all permissions
    if (req.user.role === "super_admin") {
      return next();
    }

    try {
      // Get the module ID (could be passed as name or ID)
      let moduleId = moduleNameOrId;
      
      // If it looks like a module name (not a UUID), fetch the module to get ID
      if (!moduleNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const modules = await storage.getSystemModules(true);
        const module = modules.find(m => m.name === moduleNameOrId);
        if (!module) {
          return res.status(403).json({ 
            message: `Module '${moduleNameOrId}' not found` 
          });
        }
        moduleId = module.id;
      }

      // Check user's permission
      const hasPermission = await storage.checkUserPermission(
        req.user.id,
        moduleId,
        action,
        req.user.schoolId
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `You don't have ${action} permission for this module` 
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

// Middleware to force password change on first login
export function requirePasswordChange(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Skip password change requirement for the password change endpoint itself
  if (req.path === '/api/auth/change-password' || req.path === '/api/auth/first-login-password-change') {
    return next();
  }

  // Check if user has a temporary password or is first login
  if (req.user.isFirstLogin || req.user.temporaryPassword) {
    // Check if temporary password is expired
    if (req.user.temporaryPassword && req.user.temporaryPasswordExpiresAt && isTemporaryPasswordExpired(req.user.temporaryPasswordExpiresAt)) {
      return res.status(401).json({ 
        message: "Temporary password has expired. Please contact your administrator.",
        requiresPasswordReset: true
      });
    }

    return res.status(423).json({ 
      message: "Password change required. Please change your password to continue.",
      requiresPasswordChange: true,
      isFirstLogin: req.user.isFirstLogin
    });
  }

  next();
}

// Login endpoint
export async function login(req: Request, res: Response) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Try to get user by email first, then by loginId, then by phone number
    let user = await storage.getUserByEmail(email);
    if (!user) {
      // Try loginId authentication as fallback
      user = await storage.getUserByLoginId(email);
    }
    if (!user) {
      // Try phone number authentication as final fallback (for teachers)
      user = await storage.getUserByPhone(email);
    }
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const authUser = user as AuthUser;
    
    // Check for temporary password first
    let isValidPassword = false;
    let usingTemporaryPassword = false;
    
    if (authUser.temporaryPassword) {
      // Check if temporary password is expired
      if (isTemporaryPasswordExpired(authUser.temporaryPasswordExpiresAt)) {
        return res.status(401).json({ 
          message: "Temporary password has expired. Please contact your administrator.",
          temporaryPasswordExpired: true
        });
      }
      
      // Try temporary password first
      const tempPasswordValid = await compareTemporaryPassword(password, authUser.temporaryPassword);
      if (tempPasswordValid) {
        isValidPassword = true;
        usingTemporaryPassword = true;
      }
    }
    
    // If temporary password didn't work, try regular password
    if (!isValidPassword) {
      isValidPassword = await comparePasswords(password, authUser.passwordHash);
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user's school is active (skip for super admin)
    if (authUser.role !== "super_admin" && authUser.schoolId) {
      const school = await storage.getSchool(authUser.schoolId);
      if (!school || !school.isActive) {
        return res.status(403).json({ 
          message: "Account access is currently unavailable. Please contact support." 
        });
      }
    }

    // Update last login time
    await storage.updateUser(authUser.id, { lastLoginAt: getCurrentDateTimeIST() });

    const token = generateToken(authUser);
    
    // Don't send sensitive fields in response - build safe user object explicitly  
    const safeUser = {
      id: authUser.id,
      email: authUser.email,
      loginId: authUser.loginId,
      role: authUser.role,
      isFirstLogin: authUser.isFirstLogin,
      schoolId: authUser.schoolId,
      teacherId: authUser.teacherId,
      studentId: authUser.studentId,
      parentId: authUser.parentId,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      passwordChangedAt: authUser.passwordChangedAt,
      lastLoginAt: authUser.lastLoginAt,
      isActive: authUser.isActive,
      createdBy: authUser.createdBy,
      createdAt: authUser.createdAt,
      updatedAt: authUser.updatedAt,
    };
    
    res.json({
      token,
      user: safeUser,
      requiresPasswordChange: authUser.isFirstLogin || usingTemporaryPassword,
      usingTemporaryPassword
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
}

// Get current user endpoint
export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Don't send sensitive fields - build safe user object explicitly
  const safeUser = {
    id: req.user.id,
    email: req.user.email,
    loginId: req.user.loginId,
    role: req.user.role,
    isFirstLogin: req.user.isFirstLogin,
    schoolId: req.user.schoolId,
    teacherId: req.user.teacherId,
    studentId: req.user.studentId,
    parentId: req.user.parentId,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    passwordChangedAt: req.user.passwordChangedAt,
    lastLoginAt: req.user.lastLoginAt,
    isActive: req.user.isActive,
    createdBy: req.user.createdBy,
    createdAt: req.user.createdAt,
    updatedAt: req.user.updatedAt,
  };
  
  res.json(safeUser);
}

// Password change endpoint for first-time users
export async function changePassword(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    // Validate new password strength (basic validation)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" });
    }

    const authUser = req.user as AuthUser;
    
    // Verify current password (could be regular password or temporary password)
    let isCurrentPasswordValid = false;
    
    if (authUser.temporaryPassword) {
      // If user has temporary password, check if they're using it
      if (!isTemporaryPasswordExpired(authUser.temporaryPasswordExpiresAt)) {
        const tempPasswordValid = await compareTemporaryPassword(currentPassword, authUser.temporaryPassword);
        if (tempPasswordValid) {
          isCurrentPasswordValid = true;
        }
      }
    }
    
    // If temporary password didn't work, try regular password
    if (!isCurrentPasswordValid) {
      isCurrentPasswordValid = await comparePasswords(currentPassword, authUser.passwordHash);
    }
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedNewPassword = await hashPassword(newPassword);
    
    // Update user with new password and clear temporary password
    await storage.updateUser(authUser.id, {
      passwordHash: hashedNewPassword,
      passwordChangedAt: getCurrentDateTimeIST(),
      updatedAt: getCurrentDateTimeIST()
    });
    
    // Clear temporary password if it exists
    if (authUser.temporaryPassword) {
      await storage.clearTemporaryPassword(authUser.id);
    }
    
    // Always clear first login flag after successful password change
    if (authUser.isFirstLogin) {
      await storage.updateUser(authUser.id, {
        isFirstLogin: false,
        passwordChangedAt: getCurrentDateTimeIST(),
        updatedAt: getCurrentDateTimeIST()
      });
    }

    res.json({ 
      message: "Password changed successfully",
      passwordChanged: true
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Password change failed" });
  }
}

// First-time login password change endpoint (doesn't require current password)
export async function firstLoginPasswordChange(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Validate new password strength (basic validation)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" });
    }

    const authUser = req.user as AuthUser;
    
    // Only allow this endpoint for first-time logins or users with temporary passwords
    if (!authUser.isFirstLogin && !authUser.temporaryPassword) {
      return res.status(403).json({ message: "This endpoint is only for first-time login password changes" });
    }

    // Hash the new password
    const hashedNewPassword = await hashPassword(newPassword);
    
    // Update user with new password and clear temporary password
    await storage.updateUser(authUser.id, {
      passwordHash: hashedNewPassword,
      passwordChangedAt: getCurrentDateTimeIST(),
      isFirstLogin: false,
      updatedAt: getCurrentDateTimeIST()
    });
    
    // Clear temporary password if it exists
    if (authUser.temporaryPassword) {
      await storage.clearTemporaryPassword(authUser.id);
    }

    res.json({ 
      message: "Password changed successfully",
      passwordChanged: true
    });
  } catch (error) {
    console.error("First login password change error:", error);
    res.status(500).json({ message: "Password change failed" });
  }
}

// Endpoint for admins to set temporary password for users
// Auto-generate login ID based on user type
function generateLoginId(type: 'teacher' | 'student' | 'parent', admissionNumber?: string): string {
  if (type === 'teacher') {
    // Generate Employee ID: EMP + 6 digit number
    const empNumber = Math.floor(100000 + Math.random() * 900000);
    return `EMP${empNumber}`;
  } else if (type === 'student') {
    // Use provided admission number or generate one
    return admissionNumber || `ADM${Math.floor(100000 + Math.random() * 900000)}`;
  } else if (type === 'parent') {
    // Parent login: P + Admission Number
    if (!admissionNumber) {
      throw new Error('Admission number required for parent login ID');
    }
    return `P${admissionNumber}`;
  }
  throw new Error('Invalid user type');
}

// Generate secure temporary password using crypto-secure random
function generateTemporaryPasswordString(): string {
  const crypto = require('crypto');
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {  // Increased to 12 characters for better security
    const randomIndex = crypto.randomInt(0, chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
}

export async function setTemporaryPassword(req: Request, res: Response) {
  try {
    if (!req.user || !["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }

    const { userId, temporaryPassword, expiryHours = 48 } = req.body;
    
    if (!userId || !temporaryPassword) {
      return res.status(400).json({ message: "User ID and temporary password are required" });
    }

    // Validate temporary password strength
    if (temporaryPassword.length < 6) {
      return res.status(400).json({ message: "Temporary password must be at least 6 characters long" });
    }

    // Check if user exists and belongs to same school (for non-super admins)
    const targetUser = await storage.getUser(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user.role === "admin" && targetUser.schoolId !== req.user.schoolId) {
      return res.status(403).json({ message: "Access denied. User belongs to different school." });
    }

    // Hash temporary password and set expiry
    const hashedTempPassword = await hashTemporaryPassword(temporaryPassword);
    const expiresAt = generateTemporaryPasswordExpiry(expiryHours);
    
    // Set temporary password
    await storage.setTemporaryPassword(userId, hashedTempPassword, expiresAt);
    
    // Also mark as first login to force password change
    await storage.updateUser(userId, { isFirstLogin: true });

    res.json({ 
      message: "Temporary password set successfully",
      expiresAt: expiresAt.toISOString(),
      temporaryPasswordSet: true
    });
  } catch (error) {
    console.error("Set temporary password error:", error);
    res.status(500).json({ message: "Setting temporary password failed" });
  }
}

// Register endpoint for creating school admin accounts
export async function registerSchoolAdmin(req: Request, res: Response) {
  try {
    // Only super admins can create school admin accounts
    if (!req.user || req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied. Super Admin required." });
    }

    const { email, password, firstName, lastName, schoolId } = req.body;
    
    if (!email || !password || !schoolId) {
      return res.status(400).json({ message: "Email, password, and school ID are required" });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create school admin user
    const hashedPassword = await hashPassword(password);
    const newUser = await storage.createUser({
      email,
      passwordHash: hashedPassword,
      role: "admin",
      schoolId,
      firstName: firstName || null,
      lastName: lastName || null,
      teacherId: null
    });

    // Don't send sensitive fields in response - build safe user object explicitly
    const safeUser = {
      id: newUser.id,
      email: newUser.email,
      loginId: newUser.loginId,
      role: newUser.role,
      isFirstLogin: newUser.isFirstLogin,
      schoolId: newUser.schoolId,
      teacherId: newUser.teacherId,
      studentId: newUser.studentId,
      parentId: newUser.parentId,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      passwordChangedAt: newUser.passwordChangedAt,
      lastLoginAt: newUser.lastLoginAt,
      isActive: newUser.isActive,
      createdBy: newUser.createdBy,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
    
    res.status(201).json({
      message: "School admin account created successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
}

// Create Teacher Account
export async function createTeacher(req: Request, res: Response) {
  try {
    const { email, firstName, lastName, schoolId } = req.body;
    
    if (!firstName || !lastName || !schoolId) {
      return res.status(400).json({ message: "First name, last name, and school ID are required" });
    }

    // Verify school access for non-super admins
    if (req.user!.role === "admin" && req.user!.schoolId !== schoolId) {
      return res.status(403).json({ message: "Access denied to this school" });
    }

    // Generate login ID and temporary password
    const loginId = generateLoginId('teacher');
    const tempPassword = generateTemporaryPasswordString();
    const hashedTempPassword = await hashTemporaryPassword(tempPassword);
    const tempPasswordExpiry = generateTemporaryPasswordExpiry(48);

    // Create teacher record first with proper employee ID
    const newTeacher = await storage.createTeacher({
      name: `${firstName} ${lastName}`,
      employeeId: await storage.generateNextTeacherEmployeeId(),
      email: email || null,
      contactNumber: null,
      schoolIdNumber: null,
      classes: [],
      subjects: [],
      schoolId,
      availability: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      },
      isActive: true
    });
    const teacherId = newTeacher.id;

    // Create user account
    const newUser = await storage.createUser({
      email: email || null,
      loginId,
      passwordHash: await hashPassword(generateTemporaryPasswordString()), // Random secure default
      temporaryPassword: hashedTempPassword,
      temporaryPasswordExpiresAt: tempPasswordExpiry,
      role: "teacher",
      isFirstLogin: true,
      schoolId,
      teacherId,
      firstName,
      lastName,
      isActive: true,
      createdBy: req.user!.id
    });

    res.status(201).json({
      message: "Teacher account created successfully",
      user: {
        id: newUser.id,
        loginId: newUser.loginId,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        schoolId: newUser.schoolId,
        teacherId: newUser.teacherId
      },
      credentials: {
        loginId,
        temporaryPassword: tempPassword,
        expiresAt: tempPasswordExpiry.toISOString()
      }
    });
  } catch (error) {
    console.error("Create teacher error:", error);
    res.status(500).json({ message: "Teacher creation failed" });
  }
}

// Create Student Account
export async function createStudent(req: Request, res: Response) {
  try {
    const { firstName, lastName, schoolId, admissionNumber, classId, email, parentInfo } = req.body;
    
    if (!firstName || !lastName || !schoolId) {
      return res.status(400).json({ message: "First name, last name, and school ID are required" });
    }

    // Verify school access for non-super admins
    if (req.user!.role === "admin" && req.user!.schoolId !== schoolId) {
      return res.status(403).json({ message: "Access denied to this school" });
    }

    const finalAdmissionNumber = admissionNumber || `ADM${Math.floor(100000 + Math.random() * 900000)}`;
    const loginId = generateLoginId('student', finalAdmissionNumber);
    const tempPassword = generateTemporaryPasswordString();
    const hashedTempPassword = await hashTemporaryPassword(tempPassword);
    const tempPasswordExpiry = generateTemporaryPasswordExpiry(48);

    // Create student record
    const newStudent = await storage.createStudent({
      admissionNumber: finalAdmissionNumber,
      firstName,
      lastName,
      email: email || null,
      schoolId,
      classId: classId || null,
      isActive: true,
      status: "active"
    });

    // Create user account
    const newUser = await storage.createUser({
      email: email || null,
      loginId,
      passwordHash: await hashPassword(generateTemporaryPasswordString()), // Random secure default
      temporaryPassword: hashedTempPassword,
      temporaryPasswordExpiresAt: tempPasswordExpiry,
      role: "student",
      isFirstLogin: true,
      schoolId,
      studentId: newStudent.id,
      firstName,
      lastName,
      isActive: true,
      createdBy: req.user!.id
    });

    res.status(201).json({
      message: "Student account created successfully",
      user: {
        id: newUser.id,
        loginId: newUser.loginId,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        schoolId: newUser.schoolId,
        studentId: newUser.studentId,
        admissionNumber: finalAdmissionNumber
      },
      credentials: {
        loginId,
        temporaryPassword: tempPassword,
        expiresAt: tempPasswordExpiry.toISOString()
      }
    });
  } catch (error) {
    console.error("Create student error:", error);
    res.status(500).json({ message: "Student creation failed" });
  }
}

// Create Parent Account
export async function createParent(req: Request, res: Response) {
  try {
    const { firstName, lastName, schoolId, studentAdmissionNumber, email, contactNumber, relation } = req.body;
    
    if (!firstName || !lastName || !schoolId || !studentAdmissionNumber) {
      return res.status(400).json({ message: "First name, last name, school ID, and student admission number are required" });
    }

    // Verify school access for non-super admins
    if (req.user!.role === "admin" && req.user!.schoolId !== schoolId) {
      return res.status(403).json({ message: "Access denied to this school" });
    }

    // Find student by admission number
    const student = await storage.getStudentByAdmissionNumber(studentAdmissionNumber, schoolId);
    if (!student) {
      return res.status(404).json({ message: "Student not found with this admission number" });
    }

    const loginId = generateLoginId('parent', studentAdmissionNumber);
    const tempPassword = generateTemporaryPasswordString();
    const hashedTempPassword = await hashTemporaryPassword(tempPassword);
    const tempPasswordExpiry = generateTemporaryPasswordExpiry(48);

    // Create parent record
    const newParent = await storage.createParent({
      firstName,
      lastName,
      email: email || null,
      contactNumber: contactNumber || null,
      schoolId,
      relation: relation || 'parent'
    });

    // Link parent to student
    await storage.linkParentToStudent(newParent.id, student.id);

    // Create user account
    const newUser = await storage.createUser({
      email: email || null,
      loginId,
      passwordHash: await hashPassword(generateTemporaryPasswordString()), // Random secure default
      temporaryPassword: hashedTempPassword,
      temporaryPasswordExpiresAt: tempPasswordExpiry,
      role: "parent",
      isFirstLogin: true,
      schoolId,
      parentId: newParent.id,
      firstName,
      lastName,
      isActive: true,
      createdBy: req.user!.id
    });

    res.status(201).json({
      message: "Parent account created successfully",
      user: {
        id: newUser.id,
        loginId: newUser.loginId,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        schoolId: newUser.schoolId,
        parentId: newUser.parentId
      },
      credentials: {
        loginId,
        temporaryPassword: tempPassword,
        expiresAt: tempPasswordExpiry.toISOString()
      },
      linkedStudent: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber
      }
    });
  } catch (error) {
    console.error("Create parent error:", error);
    res.status(500).json({ message: "Parent creation failed" });
  }
}

// Setup authentication routes
export function setupCustomAuth(app: any): void {
  app.post("/api/auth/login", login);
  app.post("/api/auth/register-school-admin", authenticateToken, registerSchoolAdmin);
  app.post("/api/auth/change-password", authenticateToken, changePassword);
  app.post("/api/auth/first-login-password-change", authenticateToken, firstLoginPasswordChange);
  app.post("/api/auth/set-temporary-password", authenticateToken, setTemporaryPassword);
  
  // User management endpoints
  app.post("/api/auth/create-teacher", authenticateToken, requireRole("super_admin", "admin"), createTeacher);
  app.post("/api/auth/create-student", authenticateToken, requireRole("super_admin", "admin"), createStudent);
  app.post("/api/auth/create-parent", authenticateToken, requireRole("super_admin", "admin"), createParent);
}

// Export middleware
export const authMiddleware = authenticateToken;