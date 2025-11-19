import { db } from "../db";
import { schools, classes, students, teachers, subjects } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { getISTDateString } from "../../shared/utils/dateUtils";

/**
 * School Context Service
 * Provides aggregated school data and statistics for Chroney AI context
 */

export interface SchoolContext {
  school: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
  };
  statistics: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    absentTeachersToday: number;
    absentStudentsToday: number;
    activeAcademicYear: string;
  };
  recentActivity: {
    lastAttendanceUpdate: string | null;
    pendingSubstitutions: number;
  };
}

export class SchoolContextService {
  /**
   * Get comprehensive school context for Chroney
   */
  static async getSchoolContext(schoolId: string): Promise<SchoolContext> {
    const [
      schoolData,
      stats,
      activity,
    ] = await Promise.all([
      this.getSchoolBasicInfo(schoolId),
      this.getSchoolStatistics(schoolId),
      this.getRecentActivity(schoolId),
    ]);

    return {
      school: schoolData,
      statistics: stats,
      recentActivity: activity,
    };
  }

  /**
   * Get basic school information
   */
  private static async getSchoolBasicInfo(schoolId: string) {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: {
        id: true,
        name: true,
        address: true,
        contactPhone: true,
      },
    });

    if (!school) {
      throw new Error("School not found");
    }

    return {
      id: school.id,
      name: school.name,
      address: school.address || undefined,
      phone: school.contactPhone || undefined,
    };
  }

  /**
   * Get school statistics
   */
  private static async getSchoolStatistics(schoolId: string) {
    const today = getISTDateString(new Date());

    const [
      studentCount,
      teacherCount,
      classCount,
      subjectCount,
      absentTeachersResult,
      absentStudentsResult,
    ] = await Promise.all([
      // Count students
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM ${students} 
        WHERE school_id = ${schoolId}
      `),
      // Count teachers
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM ${teachers} 
        WHERE school_id = ${schoolId}
      `),
      // Count classes
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM ${classes} 
        WHERE school_id = ${schoolId}
      `),
      // Count subjects
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM ${subjects} 
        WHERE school_id = ${schoolId}
      `),
      // Count absent teachers today
      db.execute(sql`
        SELECT COUNT(DISTINCT teacher_id)::int as count
        FROM teacher_attendance
        WHERE school_id = ${schoolId}
        AND attendance_date = ${today}
        AND status = 'absent'
      `),
      // Count absent students today
      db.execute(sql`
        SELECT COUNT(DISTINCT student_id)::int as count
        FROM student_attendance
        WHERE school_id = ${schoolId}
        AND attendance_date = ${today}
        AND status = 'absent'
      `),
    ]);

    // Get current academic year (simplified - you may have a better way)
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    return {
      totalStudents: (studentCount.rows[0] as any)?.count || 0,
      totalTeachers: (teacherCount.rows[0] as any)?.count || 0,
      totalClasses: (classCount.rows[0] as any)?.count || 0,
      totalSubjects: (subjectCount.rows[0] as any)?.count || 0,
      absentTeachersToday: (absentTeachersResult.rows[0] as any)?.count || 0,
      absentStudentsToday: (absentStudentsResult.rows[0] as any)?.count || 0,
      activeAcademicYear: academicYear,
    };
  }

  /**
   * Get recent activity information
   */
  private static async getRecentActivity(schoolId: string) {
    const [lastAttendance, pendingSubstitutions] = await Promise.all([
      // Get last attendance update
      db.execute(sql`
        SELECT MAX(created_at)::text as last_update
        FROM (
          SELECT created_at FROM teacher_attendance WHERE school_id = ${schoolId}
          UNION ALL
          SELECT created_at FROM student_attendance WHERE school_id = ${schoolId}
        ) combined
      `),
      // Count pending substitutions (unassigned)
      db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM teacher_substitutions
        WHERE school_id = ${schoolId}
        AND substitute_teacher_id IS NULL
        AND date >= ${getISTDateString(new Date())}
      `),
    ]);

    return {
      lastAttendanceUpdate: (lastAttendance.rows[0] as any)?.last_update || null,
      pendingSubstitutions: (pendingSubstitutions.rows[0] as any)?.count || 0,
    };
  }

  /**
   * Generate context summary for system prompt (OPTIMIZED - compact format)
   */
  static async getContextSummary(schoolId: string): Promise<string> {
    const context = await this.getSchoolContext(schoolId);

    // Compact format: only critical info, no formatting
    return `${context.school.name} | ${context.statistics.totalStudents}S/${context.statistics.totalTeachers}T/${context.statistics.totalClasses}C | Today: ${context.statistics.absentTeachersToday}T/${context.statistics.absentStudentsToday}S absent${context.recentActivity.pendingSubstitutions > 0 ? ` | ${context.recentActivity.pendingSubstitutions} pending subs` : ''}`;
  }
}
