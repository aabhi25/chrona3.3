import { storage } from '../storage.js';
import { isWorkingDay } from '../utils/workingDayUtils.js';

/**
 * Service to automatically mark all teachers and students as present for each new day
 * This ensures that attendance records exist by default, and admins can manually mark absences later
 */
export class AutoAttendanceService {
  private static isRunning = false;

  /**
   * Check if attendance records exist for today, and create them if missing
   * This method is safe to call multiple times per day
   */
  static async ensureDailyAttendance(): Promise<void> {
    // Prevent multiple simultaneous runs
    if (this.isRunning) {
      console.log('[AUTO ATTENDANCE] Service already running, skipping...');
      return;
    }

    // Use IST timezone since school operations are in Indian Standard Time
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    this.isRunning = true;
    console.log('[AUTO ATTENDANCE] Starting daily attendance check for:', today);

    try {
      // Get all schools to process each one
      const schools = await storage.getSchools();
      
      for (const school of schools) {
        await this.processSchoolAttendance(school.id, today);
      }

      console.log('[AUTO ATTENDANCE] Successfully completed daily attendance for all schools');
    } catch (error) {
      console.error('[AUTO ATTENDANCE] Error in daily attendance process:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process attendance for a single school
   */
  private static async processSchoolAttendance(schoolId: string, date: string): Promise<void> {
    try {
      console.log(`[AUTO ATTENDANCE] Processing school: ${schoolId} for date: ${date}`);

      // Check if today is a working day for this school
      const isWorkingDayToday = await isWorkingDay(schoolId, date);
      if (!isWorkingDayToday) {
        console.log(`[AUTO ATTENDANCE] Skipping school ${schoolId} - ${date} is not a working day`);
        return;
      }

      // Process teacher attendance
      await this.ensureTeacherAttendance(schoolId, date);
      
      // Process student attendance
      await this.ensureStudentAttendance(schoolId, date);
      
      console.log(`[AUTO ATTENDANCE] Completed processing school: ${schoolId}`);
    } catch (error) {
      console.error(`[AUTO ATTENDANCE] Error processing school ${schoolId}:`, error);
    }
  }

  /**
   * Ensure all teachers have attendance records for the given date
   */
  private static async ensureTeacherAttendance(schoolId: string, date: string): Promise<void> {
    try {
      // Get all teachers for this school
      const teachers = await storage.getTeachers(schoolId);
      
      // Get existing attendance records for today
      const existingAttendance = await storage.getTeacherAttendance(schoolId, date);
      const markedTeacherIds = new Set(existingAttendance.map(att => att.teacherId));
      
      // Find teachers without attendance records
      const unmarkedTeachers = teachers.filter(teacher => !markedTeacherIds.has(teacher.id));
      
      console.log(`[AUTO ATTENDANCE] School ${schoolId}: ${teachers.length} teachers total, ${existingAttendance.length} already marked, ${unmarkedTeachers.length} need marking`);
      
      // Mark unmarked teachers as present
      for (const teacher of unmarkedTeachers) {
        try {
          await storage.markTeacherAttendance({
            teacherId: teacher.id,
            schoolId: schoolId,
            attendanceDate: date,
            status: 'present',
            reason: 'Automatically marked present by system'
            // markedBy is optional and will be null for system-generated records
          });
          
          console.log(`[AUTO ATTENDANCE] Marked teacher ${teacher.name} (${teacher.id}) as present`);
        } catch (error) {
          console.error(`[AUTO ATTENDANCE] Failed to mark teacher ${teacher.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`[AUTO ATTENDANCE] Error in teacher attendance for school ${schoolId}:`, error);
    }
  }

  /**
   * Ensure all students have attendance records for the given date
   */
  private static async ensureStudentAttendance(schoolId: string, date: string): Promise<void> {
    try {
      // Get all students for this school
      const students = await storage.getStudents(schoolId);
      
      // Get existing attendance records for today
      const existingAttendance = await storage.getStudentAttendance(schoolId, date);
      const markedStudentIds = new Set(existingAttendance.map(att => att.studentId));
      
      // Find students without attendance records
      const unmarkedStudents = students.filter(student => !markedStudentIds.has(student.id));
      
      console.log(`[AUTO ATTENDANCE] School ${schoolId}: ${students.length} students total, ${existingAttendance.length} already marked, ${unmarkedStudents.length} need marking`);
      
      // Mark unmarked students as present
      for (const student of unmarkedStudents) {
        try {
          // Ensure student has a classId
          if (!student.classId) {
            console.warn(`[AUTO ATTENDANCE] Student ${student.firstName} ${student.lastName} has no class assigned, skipping`);
            continue;
          }

          await storage.markStudentAttendance({
            studentId: student.id,
            schoolId: schoolId,
            classId: student.classId,
            attendanceDate: date,
            status: 'present',
            reason: 'Automatically marked present by system'
            // markedBy is optional and will be null for system-generated records
          });
          
          console.log(`[AUTO ATTENDANCE] Marked student ${student.firstName} ${student.lastName} (${student.id}) as present`);
        } catch (error) {
          console.error(`[AUTO ATTENDANCE] Failed to mark student ${student.firstName} ${student.lastName}:`, error);
        }
      }
    } catch (error) {
      console.error(`[AUTO ATTENDANCE] Error in student attendance for school ${schoolId}:`, error);
    }
  }

  /**
   * Start the daily attendance service with periodic checks
   * This will run the attendance check every hour to catch new days
   */
  static startService(): void {
    console.log('[AUTO ATTENDANCE] Starting automatic attendance service...');
    
    // Run immediately on startup
    this.ensureDailyAttendance();
    
    // Set up periodic check every hour (3600000 ms)
    setInterval(() => {
      this.ensureDailyAttendance();
    }, 3600000); // Run every hour
    
    console.log('[AUTO ATTENDANCE] Service started with hourly checks');
  }

  /**
   * Manual trigger for testing purposes
   */
  static async triggerManually(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureDailyAttendance();
      return {
        success: true,
        message: 'Daily attendance processing completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error in manual trigger: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}